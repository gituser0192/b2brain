import { AppError } from "../../shared/errors/app-error.js";
import { prisma } from "../../database/prisma.js";
import { AgentRepository } from "./agent.repository.js";
import { benchmarkLeadAgent, evaluateLead } from "./lead-agent.engine.js";
import { benchmarkCollectionAgent, evaluateCollection } from "./collection-agent.engine.js";
import type { AgentInput, LeadAgentPreviewInput } from "./agent.validation.js";

export class AgentService {
  constructor(private readonly repository = new AgentRepository()) {}
  list(organizationId: string) { return this.repository.list(organizationId); }
  async get(organizationId: string, id: string) { const agent = await this.repository.find(organizationId, id); if (!agent) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); return agent; }
  create(organizationId: string, actorUserId: string, input: AgentInput) { return this.repository.create(organizationId, actorUserId, input); }
  async update(organizationId: string, actorUserId: string, id: string, input: AgentInput) { if ((await this.repository.update(organizationId, id, actorUserId, input)).count !== 1) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); return this.get(organizationId, id); }
  async archive(organizationId: string, actorUserId: string, id: string) { if ((await this.repository.archive(organizationId, id, actorUserId)).count !== 1) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); }
  async runs(organizationId: string, id: string) { await this.get(organizationId, id); return this.repository.runs(organizationId, id); }
  async runCentre(organizationId: string) {
    const runs = await this.repository.centreRuns(organizationId);
    const approvals = runs.length ? await prisma.approvalRequest.findMany({ where: { organizationId, sourceType: "COLLECTION_AGENT_RUN", sourceId: { in: runs.map((run) => run.id) } }, select: { id: true, sourceId: true, status: true, decisionNote: true, decidedAt: true, context: true } }) : [];
    const approvalByRun = new Map(approvals.map((approval) => [approval.sourceId, approval]));
    const items = runs.map((run) => {
      const approval = approvalByRun.get(run.id) ?? null;
      const context = approval?.context && typeof approval.context === "object" && !Array.isArray(approval.context) ? approval.context as Record<string, unknown> : null;
      const safety = { externalDeliveryPerformed: context?.externalDeliveryPerformed === true, paymentStatusChanged: context?.paymentStatusChanged === true, deliveryState: typeof context?.deliveryState === "string" ? context.deliveryState : null };
      const effectiveStatus = run.status === "AWAITING_APPROVAL" && !approval && ["MANUAL_PREVIEW", "COLLECTION_PREVIEW"].includes(run.triggerType) ? "COMPLETED" : run.status;
      const nextStep = effectiveStatus === "FAILED" ? "Review the failure, update the agent configuration, then run it again." : approval?.status === "RETURNED" ? "Update the agent instructions and run a new collection scan." : approval?.status === "REJECTED" || effectiveStatus === "CANCELED" ? "No action will continue from this run." : approval?.status === "APPROVED" ? "Ready for a configured delivery provider. Nothing has been sent yet." : effectiveStatus === "AWAITING_APPROVAL" ? "Review this run in Approval & Audit." : "No further action is required.";
      return { ...run, status: effectiveStatus, approval, safety, nextStep };
    });
    return { items, metrics: { total: items.length, awaitingApproval: items.filter((item) => item.status === "AWAITING_APPROVAL" && item.approval?.status === "PENDING").length, completed: items.filter((item) => item.status === "COMPLETED").length, failed: items.filter((item) => item.status === "FAILED").length, safeRuns: items.filter((item) => !item.safety.externalDeliveryPerformed && !item.safety.paymentStatusChanged).length } };
  }
  async previewLead(organizationId: string, actorUserId: string, id: string, input: LeadAgentPreviewInput) {
    const agent = await this.get(organizationId, id);
    if (agent.status !== "ACTIVE") throw new AppError(409, "Activate the agent before running a preview.", "AGENT_NOT_ACTIVE");
    if (!["LEADS", "CRM"].includes(agent.supportedService)) throw new AppError(409, "This agent is not configured for lead intake.", "AGENT_SERVICE_MISMATCH");
    const allowedActions = Array.isArray(agent.allowedActions) ? agent.allowedActions.filter((value): value is string => typeof value === "string") : [];
    if (!allowedActions.includes("INQUIRY_CLASSIFY")) throw new AppError(403, "The agent is not allowed to classify inquiries.", "AGENT_ACTION_NOT_ALLOWED");
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    if (agent.dailyRunLimit > 0) {
      const used = await prisma.agentRun.count({ where: { organizationId, agentId: id, createdAt: { gte: startOfDay } } });
      if (used >= agent.dailyRunLimit) throw new AppError(429, "The agent daily run limit has been reached.", "AGENT_DAILY_LIMIT_REACHED");
    }
    const run = await prisma.agentRun.create({ data: { organizationId, agentId: id, status: "RUNNING", triggerType: "MANUAL_PREVIEW", initiatedById: actorUserId, startedAt: new Date() } });
    try {
      const contactFilters = [...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : []), ...(input.phone ? [{ phone: input.phone }] : [])];
      const [customers, inquiries] = await Promise.all([
        allowedActions.includes("CRM_CUSTOMER_READ") ? prisma.customer.findMany({ where: { organizationId, deletedAt: null, OR: contactFilters }, select: { id: true, displayName: true, email: true, phone: true }, take: 5 }) : [],
        allowedActions.includes("INQUIRY_READ") ? prisma.inquiry.findMany({ where: { organizationId, deletedAt: null, status: { in: ["NEW", "REVIEWING", "QUALIFIED"] }, OR: contactFilters }, select: { id: true, contactName: true, subject: true, status: true }, take: 5 }) : [],
      ]);
      const analysis = evaluateLead(input);
      const canDraft = allowedActions.includes("INQUIRY_RESPONSE_DRAFT") || allowedActions.includes("MESSAGE_DRAFT");
      const output = { ...analysis, responseDraft: canDraft ? analysis.responseDraft : null, requiresApproval: canDraft && Boolean(analysis.responseDraft), existingCustomerMatches: customers, possibleDuplicateInquiries: inquiries, externalActionPerformed: false };
      const status = "COMPLETED" as const;
      await prisma.agentRun.update({ where: { id: run.id }, data: { status, summary: `${output.type} inquiry classified as ${output.priority}; ${customers.length} customer match(es), ${inquiries.length} possible duplicate(s). Preview completed with no external action.`, completedAt: new Date() } });
      return { runId: run.id, status, output };
    } catch (error) {
      await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Agent preview failed.", completedAt: new Date() } });
      throw error;
    }
  }
  async benchmark(organizationId: string, id: string, iterations: number) {
    const agent = await this.get(organizationId, id);
    const result = agent.supportedService === "FINANCE" ? benchmarkCollectionAgent(iterations) : ["LEADS", "CRM"].includes(agent.supportedService) ? benchmarkLeadAgent(iterations) : null;
    if (!result) throw new AppError(409, "No benchmark is available for this agent.", "AGENT_BENCHMARK_NOT_APPLICABLE");
    return { agent: { id: agent.id, name: agent.name, status: agent.status }, ...result };
  }
  async previewCollection(organizationId: string, actorUserId: string, id: string, invoiceId: string) {
    const agent = await this.get(organizationId, id);
    if (agent.status !== "ACTIVE" || agent.supportedService !== "FINANCE") throw new AppError(409, "Select an active Finance agent.", "AGENT_SERVICE_MISMATCH");
    const actions = Array.isArray(agent.allowedActions) ? agent.allowedActions.filter((value): value is string => typeof value === "string") : [];
    if (!actions.includes("FINANCE_INVOICE_READ") || !actions.includes("COLLECTION_PRIORITIZE")) throw new AppError(403, "The agent cannot read and prioritize invoices.", "AGENT_ACTION_NOT_ALLOWED");
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (agent.dailyRunLimit > 0 && await prisma.agentRun.count({ where: { organizationId, agentId: id, createdAt: { gte: start } } }) >= agent.dailyRunLimit) throw new AppError(429, "The agent daily run limit has been reached.", "AGENT_DAILY_LIMIT_REACHED");
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId, deletedAt: null, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { customer: { select: { displayName: true } }, payments: { where: { deletedAt: null }, select: { amount: true, refundedAmount: true } } } });
    if (!invoice) throw new AppError(404, "Collectible invoice was not found.", "INVOICE_NOT_FOUND");
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0), refunded = invoice.payments.reduce((sum, payment) => sum + Number(payment.refundedAmount), 0);
    const analysis = evaluateCollection({ total: Number(invoice.total), paid, refunded, dueDate: invoice.dueDate, customerName: invoice.customer.displayName, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency });
    const canDraft = actions.includes("COLLECTION_DRAFT") || actions.includes("MESSAGE_DRAFT");
    const output = { ...analysis, responseDraft: canDraft ? analysis.responseDraft : null, requiresApproval: canDraft && Boolean(analysis.responseDraft), invoiceId: invoice.id, externalActionPerformed: false, paymentStatusChanged: false };
    const status = "COMPLETED" as const;
    const run = await prisma.agentRun.create({ data: { organizationId, agentId: id, status, triggerType: "COLLECTION_PREVIEW", summary: `${invoice.invoiceNumber}: ${invoice.currency} ${output.outstanding.toFixed(2)} outstanding, ${output.risk} risk. Preview completed with no contact sent and no payment status changed.`, initiatedById: actorUserId, startedAt: new Date(), completedAt: new Date() } });
    return { runId: run.id, status, output };
  }
  async runCollection(organizationId: string, actorUserId: string, id: string, invoiceId?: string | null, triggerType = "MANUAL_COLLECTION_SCAN") {
    const agent = await this.get(organizationId, id);
    if (agent.status !== "ACTIVE" || agent.supportedService !== "FINANCE") throw new AppError(409, "Select an active Finance agent.", "AGENT_SERVICE_MISMATCH");
    const actions = Array.isArray(agent.allowedActions) ? agent.allowedActions.filter((value): value is string => typeof value === "string") : [];
    const required = ["FINANCE_INVOICE_READ", "COLLECTION_PRIORITIZE", "COLLECTION_DRAFT", "COLLECTION_FOLLOWUP_REQUEST"];
    if (required.some((action) => !actions.includes(action))) throw new AppError(403, "Enable all four collection actions before running this agent.", "AGENT_ACTION_NOT_ALLOWED");
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    if (agent.dailyRunLimit > 0 && await prisma.agentRun.count({ where: { organizationId, agentId: id, createdAt: { gte: startOfDay } } }) >= agent.dailyRunLimit) throw new AppError(429, "The agent daily run limit has been reached.", "AGENT_DAILY_LIMIT_REACHED");

    const now = new Date();
    const invoices = await prisma.invoice.findMany({
      where: { organizationId, deletedAt: null, ...(invoiceId ? { id: invoiceId } : {}), status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } },
      include: { customer: { select: { id: true, displayName: true } }, payments: { where: { deletedAt: null }, select: { amount: true, refundedAmount: true } } },
      take: invoiceId ? 1 : 250,
    });
    const ranked = invoices.map((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const refunded = invoice.payments.reduce((sum, payment) => sum + Number(payment.refundedAmount), 0);
      const analysis = evaluateCollection({ total: Number(invoice.total), paid, refunded, dueDate: invoice.dueDate, customerName: invoice.customer.displayName, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency }, now);
      return { invoice, analysis };
    }).filter(({ analysis }) => analysis.outstanding > 0);
    const rankedInvoiceIds = ranked.map(({ invoice }) => invoice.id);
    const legacyTitles = ranked.flatMap(({ invoice }) => [`Collect ${invoice.invoiceNumber}`, `Payment follow-up: ${invoice.invoiceNumber}`]);
    const pending = await prisma.customerFollowUp.findMany({ where: { organizationId, deletedAt: null, status: "PENDING", OR: [{ invoiceId: { in: rankedInvoiceIds } }, { invoiceId: null, title: { in: legacyTitles } }] }, select: { id: true, invoiceId: true, title: true } });
    const pendingAgentInvoiceIds = new Set(pending.filter((item) => item.title.startsWith("Collect ")).map((item) => item.invoiceId).filter((value): value is string => Boolean(value)));
    const riskRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, SETTLED: 0 };
    const eligible = ranked.filter(({ invoice }) => !pendingAgentInvoiceIds.has(invoice.id) && !pending.some((item) => !item.invoiceId && item.title === `Collect ${invoice.invoiceNumber}`)).sort((left, right) => (riskRank[right.analysis.risk] ?? 0) - (riskRank[left.analysis.risk] ?? 0) || right.analysis.outstanding - left.analysis.outstanding || left.invoice.dueDate.getTime() - right.invoice.dueDate.getTime());

    if (!eligible.length) {
      const run = await prisma.agentRun.create({ data: { organizationId, agentId: id, status: "COMPLETED", triggerType, summary: invoices.length ? "No eligible overdue invoice: every outstanding invoice already has a pending collection follow-up." : "No overdue collectible invoice was found.", initiatedById: actorUserId, startedAt: now, completedAt: new Date() } });
      return { runId: run.id, status: "COMPLETED", matched: false, reason: invoices.length ? "FOLLOW_UP_ALREADY_PENDING" : "NO_ELIGIBLE_OVERDUE_INVOICE", externalActionPerformed: false, paymentStatusChanged: false };
    }

    const { invoice, analysis } = eligible[0]!;
    const previousAttempts = await prisma.customerFollowUp.count({ where: { organizationId, customerId: invoice.customerId, deletedAt: null, title: `Collect ${invoice.invoiceNumber}` } });
    const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.create({ data: { organizationId, agentId: id, status: "AWAITING_APPROVAL", triggerType, summary: `${invoice.invoiceNumber}: ${invoice.currency} ${analysis.outstanding.toFixed(2)} outstanding, ${analysis.risk} risk. Reminder drafted and internal follow-up created; nothing was sent and no payment record changed.`, initiatedById: actorUserId, startedAt: now } });
      const approval = await tx.approvalRequest.create({ data: { organizationId, serviceCode: "FINANCE", actionCode: "COLLECTION_REMINDER_DRAFT", title: `Review reminder for ${invoice.invoiceNumber}`, description: analysis.responseDraft, riskLevel: analysis.risk === "CRITICAL" ? "CRITICAL" : analysis.risk === "HIGH" ? "HIGH" : "MEDIUM", sourceType: "COLLECTION_AGENT_RUN", sourceId: run.id, requestedById: actorUserId, dueAt, context: { agentId: id, agentRunId: run.id, invoiceId: invoice.id, customerId: invoice.customerId, outstanding: analysis.outstanding, currency: invoice.currency, daysOverdue: analysis.daysOverdue, risk: analysis.risk, previousAttempts, proposedMessage: analysis.responseDraft, externalDeliveryPerformed: false, paymentStatusChanged: false } } });
      const existingFollowUp = pending.find((item) => item.invoiceId === invoice.id || (!item.invoiceId && item.title === `Payment follow-up: ${invoice.invoiceNumber}`));
      const followUp = existingFollowUp ? await tx.customerFollowUp.update({ where: { id: existingFollowUp.id }, data: { invoiceId: invoice.id, description: `${invoice.customer.displayName} has ${invoice.currency} ${analysis.outstanding.toFixed(2)} outstanding. Review approval ${approval.id} before contacting the customer.`, dueAt, updatedById: actorUserId } }) : await tx.customerFollowUp.create({ data: { organizationId, customerId: invoice.customerId, invoiceId: invoice.id, title: `Collect ${invoice.invoiceNumber}`, description: `${invoice.customer.displayName} has ${invoice.currency} ${analysis.outstanding.toFixed(2)} outstanding. Review approval ${approval.id} before contacting the customer.`, dueAt, assignedToId: actorUserId, createdById: actorUserId, updatedById: actorUserId } });
      const owner = await tx.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" } }, select: { userId: true } });
      if (owner) await tx.notification.create({ data: { organizationId, recipientId: owner.userId, type: "APPROVAL_REQUIRED", title: "Collection reminder ready", message: `${invoice.invoiceNumber} has ${invoice.currency} ${analysis.outstanding.toFixed(2)} outstanding. Review the agent draft.`, sourceType: "COLLECTION_AGENT_RUN", sourceId: run.id, actionPath: "/dashboard?view=governance", createdById: actorUserId, updatedById: actorUserId } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "AI_AGENT", actorUserId, serviceCode: "FINANCE", actionCode: "COLLECTION_AGENT_PREPARED", sourceType: "INVOICE", sourceId: invoice.id, summary: `Collection agent prepared an approval-gated reminder and internal follow-up for ${invoice.invoiceNumber}.`, metadata: { agentId: id, agentRunId: run.id, approvalId: approval.id, followUpId: followUp.id, externalActionPerformed: false, paymentStatusChanged: false } } });
      return { run, approval, followUp };
    });
    return { runId: result.run.id, status: result.run.status, matched: true, invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, customerName: invoice.customer.displayName, currency: invoice.currency, outstanding: analysis.outstanding, daysOverdue: analysis.daysOverdue, risk: analysis.risk }, previousAttempts, proposedMessage: analysis.responseDraft, approvalId: result.approval.id, followUpId: result.followUp.id, externalActionPerformed: false, paymentStatusChanged: false };
  }
}
