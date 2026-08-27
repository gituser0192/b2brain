import { prisma } from "../../database/prisma.js";

const DAY = 86_400_000;
const openStages = ["PROSPECTING", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;
const round = (value: number) => Math.round(value * 100) / 100;
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const name = (first: string, last: string | null) => [first, last].filter(Boolean).join(" ");

export class SalesIntelligenceService {
  async analyze(organizationId: string, permissions: string[], days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY);
    const enabled = new Set((await prisma.organizationService.findMany({
      where: { organizationId, status: "ENABLED", deletedAt: null, service: { status: "ACTIVE", archivedAt: null } },
      select: { service: { select: { code: true } } },
    })).map((entry) => entry.service.code));
    const canLeads = enabled.has("LEADS") && permissions.includes("INQUIRY_VIEW");
    const canFinance = enabled.has("FINANCE") && permissions.includes("FINANCE_VIEW");

    const [organization, deals, inquiries, quotations, payments] = await Promise.all([
      prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { currency: true } }),
      prisma.deal.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, stage: true, amount: true, probability: true, expectedCloseDate: true, closedAt: true, createdAt: true, lostReason: true, owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      canLeads ? prisma.inquiry.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: start, lte: end } },
        select: { source: true, status: true, createdAt: true, responseDueAt: true, firstRespondedAt: true, convertedDealId: true, campaign: { select: { name: true } }, assignedEmployee: { select: { linkedUserId: true, firstName: true, lastName: true } } },
      }) : [],
      prisma.quotation.findMany({
        where: { organizationId, archivedAt: null, createdAt: { gte: start, lte: end } },
        select: { status: true, total: true, createdAt: true },
      }),
      canFinance ? prisma.payment.findMany({
        where: { organizationId, deletedAt: null, paidAt: { gte: start, lte: end } },
        select: { amount: true, refundedAmount: true, paidAt: true },
      }) : [],
    ]);

    const periodDeals = deals.filter((deal) => {
      const activityDate = deal.closedAt ?? deal.createdAt;
      return activityDate >= start && activityDate <= end;
    });
    const openDeals = deals.filter((deal) => openStages.includes(deal.stage as typeof openStages[number]));
    const closedDeals = periodDeals.filter((deal) => deal.stage === "WON" || deal.stage === "LOST");
    const wonDeals = closedDeals.filter((deal) => deal.stage === "WON");
    const lostDeals = closedDeals.filter((deal) => deal.stage === "LOST");
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const weightedForecast = openDeals.reduce((sum, deal) => sum + Number(deal.amount) * deal.probability / 100, 0);
    const overduePipeline = openDeals.filter((deal) => deal.expectedCloseDate && deal.expectedCloseDate < end);
    const actualReceived = payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) - Number(payment.refundedAmount)), 0);
    const converted = inquiries.filter((inquiry) => inquiry.status === "CONVERTED" || inquiry.convertedDealId).length;
    const responded = inquiries.filter((inquiry) => inquiry.firstRespondedAt);
    const responseMinutes = responded.reduce((sum, inquiry) => sum + (inquiry.firstRespondedAt!.getTime() - inquiry.createdAt.getTime()) / 60_000, 0);
    const missedResponses = inquiries.filter((inquiry) => inquiry.responseDueAt && ((!inquiry.firstRespondedAt && inquiry.responseDueAt < end) || (inquiry.firstRespondedAt && inquiry.firstRespondedAt > inquiry.responseDueAt))).length;
    const consideredQuotes = quotations.filter((quote) => ["SENT", "ACCEPTED", "REJECTED", "CONVERTED"].includes(quote.status));
    const acceptedQuotes = quotations.filter((quote) => quote.status === "ACCEPTED" || quote.status === "CONVERTED").length;
    const salesCycles = closedDeals.filter((deal) => deal.closedAt).map((deal) => (deal.closedAt!.getTime() - deal.createdAt.getTime()) / DAY);

    const monthCount = Math.min(12, Math.max(6, Math.ceil(days / 30)));
    const pastMonths = Math.floor(monthCount / 2);
    const months = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + index - pastMonths, 1));
      return monthKey(date);
    });
    const monthly = months.map((month) => ({
      month,
      forecast: round(openDeals.filter((deal) => deal.expectedCloseDate && monthKey(deal.expectedCloseDate) === month).reduce((sum, deal) => sum + Number(deal.amount) * deal.probability / 100, 0)),
      received: round(payments.filter((payment) => monthKey(payment.paidAt) === month).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) - Number(payment.refundedAmount)), 0)),
    }));

    const sourceMap = new Map<string, { leads: number; converted: number; wonRevenue: number }>();
    const dealById = new Map(deals.map((deal) => [deal.id, deal]));
    for (const inquiry of inquiries) {
      const key = inquiry.campaign?.name ? `Campaign: ${inquiry.campaign.name}` : inquiry.source;
      const item = sourceMap.get(key) ?? { leads: 0, converted: 0, wonRevenue: 0 };
      item.leads += 1;
      if (inquiry.status === "CONVERTED" || inquiry.convertedDealId) item.converted += 1;
      const deal = inquiry.convertedDealId ? dealById.get(inquiry.convertedDealId) : undefined;
      if (deal?.stage === "WON") item.wonRevenue += Number(deal.amount);
      sourceMap.set(key, item);
    }

    const peopleMap = new Map<string, { name: string; open: number; won: number; lost: number; wonRevenue: number; weighted: number }>();
    for (const deal of deals) {
      const item = peopleMap.get(deal.owner.id) ?? { name: name(deal.owner.firstName, deal.owner.lastName), open: 0, won: 0, lost: 0, wonRevenue: 0, weighted: 0 };
      if (openStages.includes(deal.stage as typeof openStages[number])) { item.open += 1; item.weighted += Number(deal.amount) * deal.probability / 100; }
      if (deal.stage === "WON" && (deal.closedAt ?? deal.createdAt) >= start) { item.won += 1; item.wonRevenue += Number(deal.amount); }
      if (deal.stage === "LOST" && (deal.closedAt ?? deal.createdAt) >= start) item.lost += 1;
      peopleMap.set(deal.owner.id, item);
    }

    const insights: { tone: "POSITIVE" | "WARNING" | "INFO"; title: string; detail: string }[] = [];
    if (overduePipeline.length) insights.push({ tone: "WARNING", title: "Forecast at risk", detail: `${overduePipeline.length} open deal${overduePipeline.length === 1 ? " is" : "s are"} past the expected close date.` });
    if (inquiries.length && missedResponses) insights.push({ tone: "WARNING", title: "Lead response gap", detail: `${missedResponses} lead${missedResponses === 1 ? " has" : "s have"} missed the first-response deadline.` });
    if (consideredQuotes.length && acceptedQuotes / consideredQuotes.length < 0.35) insights.push({ tone: "WARNING", title: "Quotation acceptance is low", detail: `Only ${Math.round(acceptedQuotes / consideredQuotes.length * 100)}% of decided or sent quotations were accepted.` });
    if (weightedForecast > actualReceived) insights.push({ tone: "INFO", title: "Revenue opportunity ahead", detail: `Weighted open pipeline is ${round(weightedForecast - actualReceived)} above received revenue in this reporting period; close dates and next actions should be verified.` });
    if (wonDeals.length > lostDeals.length && closedDeals.length) insights.push({ tone: "POSITIVE", title: "Positive close balance", detail: `${wonDeals.length} deals were won versus ${lostDeals.length} lost in the selected period.` });
    if (!insights.length) insights.push({ tone: "INFO", title: "More activity needed", detail: "Add and progress real leads, deals, quotations, and payments to generate evidence-based explanations." });

    return {
      currency: organization?.currency ?? "INR", period: { days, start, end }, access: { leads: canLeads, finance: canFinance },
      metrics: {
        leadsReceived: inquiries.length, leadsConverted: converted, leadConversionRate: inquiries.length ? round(converted / inquiries.length * 100) : 0,
        averageResponseMinutes: responded.length ? round(responseMinutes / responded.length) : null, missedResponses,
        openDeals: openDeals.length, pipelineValue: round(pipelineValue), weightedForecast: round(weightedForecast), overduePipeline: overduePipeline.length,
        wonDeals: wonDeals.length, lostDeals: lostDeals.length, wonRevenue: round(wonDeals.reduce((sum, deal) => sum + Number(deal.amount), 0)),
        averageSalesCycleDays: salesCycles.length ? round(salesCycles.reduce((sum, value) => sum + value, 0) / salesCycles.length) : null,
        quotationAcceptanceRate: consideredQuotes.length ? round(acceptedQuotes / consideredQuotes.length * 100) : 0, quotationsConsidered: consideredQuotes.length,
        actualReceived: round(actualReceived), forecastGap: round(weightedForecast - actualReceived),
      },
      monthly,
      sources: [...sourceMap.entries()].map(([source, values]) => ({ source, ...values, wonRevenue: round(values.wonRevenue) })).sort((a, b) => b.wonRevenue - a.wonRevenue || b.leads - a.leads),
      salespeople: [...peopleMap.values()].map((item) => ({ ...item, wonRevenue: round(item.wonRevenue), weighted: round(item.weighted) })).sort((a, b) => b.wonRevenue - a.wonRevenue || b.weighted - a.weighted),
      lossReasons: [...new Map(lostDeals.map((deal) => [deal.lostReason ?? "Not recorded", 0])).keys()].map((reason) => ({ reason, count: lostDeals.filter((deal) => (deal.lostReason ?? "Not recorded") === reason).length })).sort((a, b) => b.count - a.count),
      insights,
    };
  }
}
