import { prisma } from "../../database/prisma.js";

export class DashboardService {
  async summary(organizationId: string, membershipId: string, roleCode: string, permissions: string[], days: number | null) {
    const organization = await prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { currency: true } });
    const organizationPlan = await prisma.organizationPlan.findUnique({ where: { organizationId } });
    const planExpired = Boolean(organizationPlan && (["PAST_DUE", "EXPIRED", "CANCELED"].includes(organizationPlan.status) || (organizationPlan.status === "TRIAL" && organizationPlan.trialEndsAt && organizationPlan.trialEndsAt <= new Date()) || (organizationPlan.expiresAt && organizationPlan.expiresAt <= new Date())));
    const since = days === null ? undefined : new Date(Date.now() - days * 86400000);
    const assignedServiceIds = roleCode === "ORGANIZATION_OWNER" ? null : new Set((await prisma.membershipServiceAccess.findMany({ where: { organizationId, membershipId }, select: { serviceId: true } })).map((item) => item.serviceId));
    const enabled = new Set(planExpired ? [] : (await prisma.organizationService.findMany({ where: { organizationId, status: "ENABLED", deletedAt: null, service: { status: "ACTIVE", archivedAt: null }, ...(assignedServiceIds ? { serviceId: { in: [...assignedServiceIds] } } : {}) }, select: { service: { select: { code: true } } } })).map((item) => item.service.code));
    const can = (service: string, permission: string) => enabled.has(service) && permissions.includes(permission);
    const date = since ? { gte: since } : undefined;
    const [customers, followUps, deals, quotations, projects, overdueTasks, employees, invoices, payments, unmatchedPayments, expenses, orders, stockLevels, campaigns, campaignLeads, supportTickets, websiteRequests, websiteDeployments, purchaseOrders, calendarEvents, inquiries] = await Promise.all([
      can("CRM", "CRM_VIEW") ? prisma.customer.findMany({ where: { organizationId, deletedAt: null, ...(date ? { createdAt: date } : {}) }, select: { status: true } }) : [],
      can("CRM", "CRM_ACTIVITY_VIEW") ? prisma.customerFollowUp.count({ where: { organizationId, status: "PENDING", deletedAt: null, dueAt: { lt: new Date() } } }) : 0,
      can("SALES", "DEAL_VIEW") ? prisma.deal.findMany({ where: { organizationId, deletedAt: null, ...(date ? { createdAt: date } : {}) }, select: { stage: true, amount: true, probability: true, currency: true } }) : [],
      can("SALES", "DEAL_VIEW") ? prisma.quotation.findMany({ where: { organizationId, archivedAt: null, status: { in: ["DRAFT", "SENT", "EXPIRED"] } }, select: { status: true, total: true, validUntil: true } }) : [],
      can("PROJECTS", "PROJECT_VIEW") ? prisma.project.count({ where: { organizationId, status: "ACTIVE", deletedAt: null } }) : 0,
      can("PROJECTS", "TASK_VIEW") ? prisma.projectTask.count({ where: { organizationId, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELED"] }, dueDate: { lt: new Date() } } }) : 0,
      can("PEOPLE", "EMPLOYEE_VIEW") ? prisma.employee.count({ where: { organizationId, status: "ACTIVE", deletedAt: null } }) : 0,
      can("FINANCE", "FINANCE_VIEW") ? prisma.invoice.findMany({ where: { organizationId, deletedAt: null, status: { not: "CANCELED" }, ...(date ? { issueDate: date } : {}) }, include: { payments: { where: { deletedAt: null } } } }) : [],
      can("FINANCE", "FINANCE_VIEW") ? prisma.payment.findMany({ where: { organizationId, deletedAt: null, ...(date ? { paidAt: date } : {}) }, select: { amount: true, currency: true } }) : [],
      can("FINANCE", "FINANCE_VIEW") ? prisma.incomingPaymentTransaction.count({ where: { organizationId, status: "UNMATCHED", deletedAt: null } }) : 0,
      can("FINANCE", "FINANCE_VIEW") ? prisma.expense.findMany({ where: { organizationId, status: "RECORDED", deletedAt: null, ...(date ? { expenseDate: date } : {}) }, select: { amount: true, currency: true } }) : [],
      can("ORDERS", "ORDER_VIEW") ? prisma.order.findMany({ where: { organizationId, deletedAt: null, ...(date ? { createdAt: date } : {}) }, select: { status: true, total: true, currency: true } }) : [],
      can("INVENTORY", "INVENTORY_VIEW") ? prisma.stockLevel.findMany({ where: { organizationId }, select: { onHand: true, reserved: true, reorderPoint: true } }) : [],
      can("MARKETING", "MARKETING_VIEW") ? prisma.marketingCampaign.findMany({ where: { organizationId, deletedAt: null, ...(date ? { createdAt: date } : {}) }, select: { status: true, spend: true, currency: true } }) : [],
      can("MARKETING", "MARKETING_VIEW") ? prisma.campaignLead.findMany({ where: { organizationId, ...(date ? { capturedAt: date } : {}) }, include: { deal: { select: { stage: true, amount: true, currency: true } } } }) : [],
      can("SUPPORT", "SUPPORT_VIEW") ? prisma.supportTicket.findMany({ where: { organizationId, deletedAt: null }, select: { status: true, responseDueAt: true, resolutionDueAt: true, firstRespondedAt: true } }) : [],
      can("WEBSITES", "WEBSITE_VIEW") ? prisma.websiteChangeRequest.findMany({ where: { organizationId, deletedAt: null }, select: { status: true, deadline: true } }) : [],
      can("WEBSITES", "WEBSITE_VIEW") ? prisma.websiteDeployment.findMany({ where: { organizationId }, select: { status: true } }) : [],
      can("PROCUREMENT", "PROCUREMENT_VIEW") ? prisma.purchaseOrder.findMany({ where: { organizationId, deletedAt: null }, select: { status: true, expectedDelivery: true, total: true } }) : [],
      can("CALENDAR", "CALENDAR_VIEW") ? prisma.calendarEvent.findMany({ where: { organizationId, deletedAt: null, startAt: { gte: new Date(new Date().setHours(0,0,0,0)) } }, select: { status: true, startAt: true } }) : [],
      can("LEADS", "INQUIRY_VIEW") ? prisma.inquiry.findMany({ where: { organizationId, deletedAt: null, status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] } }, select: { nextFollowUpAt: true, followUpCompletedAt: true } }) : [],
    ]);
    const invoiceTotal = invoices.reduce((sum, item) => sum + Number(item.total), 0);
    const invoicePaid = invoices.reduce((sum, item) => sum + item.payments.reduce((paid, payment) => paid + Number(payment.amount), 0), 0);
    const received = payments.reduce((sum, item) => sum + Number(item.amount), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const openDeals = deals.filter((item) => !["WON", "LOST"].includes(item.stage));
    const wonDeals = deals.filter((item) => item.stage === "WON");
    const convertedLeads = campaignLeads.filter((item) => item.status === "CONVERTED");
    const attributedRevenue = convertedLeads.filter((item) => item.deal?.stage === "WON").reduce((sum, item) => sum + Number(item.deal!.amount), 0);
    const marketingSpend = campaigns.reduce((sum, item) => sum + Number(item.spend), 0);
    const alerts = [
      followUps ? { type: "FOLLOW_UP", count: followUps, label: "Overdue CRM follow-ups", view: "crm" } : null,
      overdueTasks ? { type: "TASK", count: overdueTasks, label: "Overdue project tasks", view: "projects" } : null,
      stockLevels.filter((item) => Number(item.onHand) - Number(item.reserved) <= Number(item.reorderPoint)).length ? { type: "STOCK", count: stockLevels.filter((item) => Number(item.onHand) - Number(item.reserved) <= Number(item.reorderPoint)).length, label: "Low-stock products", view: "inventory" } : null,
      orders.filter((item) => ["CONFIRMED", "PROCESSING"].includes(item.status)).length ? { type: "ORDER", count: orders.filter((item) => ["CONFIRMED", "PROCESSING"].includes(item.status)).length, label: "Orders requiring fulfilment", view: "orders" } : null,
      supportTickets.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status) && ((!item.firstRespondedAt && item.responseDueAt && item.responseDueAt < new Date()) || (item.resolutionDueAt && item.resolutionDueAt < new Date()))).length ? { type: "SUPPORT", count: supportTickets.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status) && ((!item.firstRespondedAt && item.responseDueAt && item.responseDueAt < new Date()) || (item.resolutionDueAt && item.resolutionDueAt < new Date()))).length, label: "Overdue support tickets", view: "support" } : null,
      websiteRequests.filter((item) => item.status === "AWAITING_APPROVAL").length ? { type: "WEBSITE_APPROVAL", count: websiteRequests.filter((item) => item.status === "AWAITING_APPROVAL").length, label: "Website changes awaiting approval", view: "websites" } : null,
      websiteDeployments.filter((item) => item.status === "FAILED").length ? { type: "DEPLOYMENT_FAILED", count: websiteDeployments.filter((item) => item.status === "FAILED").length, label: "Failed website deployments", view: "websites" } : null,
      purchaseOrders.filter((item) => item.status === "AWAITING_APPROVAL").length ? { type: "PURCHASE_APPROVAL", count: purchaseOrders.filter((item) => item.status === "AWAITING_APPROVAL").length, label: "Purchase orders awaiting approval", view: "procurement" } : null,
      purchaseOrders.filter((item) => ["ORDERED", "PARTIALLY_RECEIVED"].includes(item.status) && item.expectedDelivery && item.expectedDelivery < new Date()).length ? { type: "DELIVERY_OVERDUE", count: purchaseOrders.filter((item) => ["ORDERED", "PARTIALLY_RECEIVED"].includes(item.status) && item.expectedDelivery && item.expectedDelivery < new Date()).length, label: "Overdue supplier deliveries", view: "procurement" } : null,
      inquiries.filter((item) => item.nextFollowUpAt && item.nextFollowUpAt < new Date() && !item.followUpCompletedAt).length ? { type: "LEAD_FOLLOW_UP", count: inquiries.filter((item) => item.nextFollowUpAt && item.nextFollowUpAt < new Date() && !item.followUpCompletedAt).length, label: "Overdue lead follow-ups", view: "inquiries" } : null,
      quotations.filter((item) => item.status === "EXPIRED" || item.validUntil <= new Date(Date.now() + 3 * 86_400_000)).length ? { type: "QUOTATION", count: quotations.filter((item) => item.status === "EXPIRED" || item.validUntil <= new Date(Date.now() + 3 * 86_400_000)).length, label: "Quotations expiring or expired", view: "sales" } : null,
      unmatchedPayments ? { type: "PAYMENT_RECONCILIATION", count: unmatchedPayments, label: "Incoming payments awaiting reconciliation", view: "finance" } : null,
    ].filter(Boolean);
    return { periodDays: days, enabledServices: [...enabled], currency: organization?.currency ?? "INR", metrics: {
      customers: customers.length, leads: customers.filter((item) => item.status === "LEAD").length, activeCustomers: customers.filter((item) => item.status === "ACTIVE").length, overdueFollowUps: followUps,
      openDeals: openDeals.length, pipelineValue: openDeals.reduce((sum, item) => sum + Number(item.amount), 0), weightedForecast: openDeals.reduce((sum, item) => sum + Number(item.amount) * item.probability / 100, 0), wonRevenue: wonDeals.reduce((sum, item) => sum + Number(item.amount), 0),
      openQuotations: quotations.length, quotationValue: quotations.reduce((sum, item) => sum + Number(item.total), 0),
      activeProjects: projects, overdueTasks, activeEmployees: employees,
      invoiced: invoiceTotal, received, outstanding: Math.max(0, invoiceTotal - invoicePaid), expenses: expenseTotal, netCash: received - expenseTotal,
      orders: orders.length, activeOrders: orders.filter((item) => !["FULFILLED", "CANCELED", "REFUNDED"].includes(item.status)).length, orderValue: orders.filter((item) => !["CANCELED", "REFUNDED"].includes(item.status)).reduce((sum, item) => sum + Number(item.total), 0),
      stockOnHand: stockLevels.reduce((sum, item) => sum + Number(item.onHand), 0), stockReserved: stockLevels.reduce((sum, item) => sum + Number(item.reserved), 0), lowStock: stockLevels.filter((item) => Number(item.onHand) - Number(item.reserved) <= Number(item.reorderPoint)).length,
      activeCampaigns: campaigns.filter((item) => item.status === "ACTIVE").length, marketingSpend, marketingLeads: campaignLeads.length, conversions: convertedLeads.length, attributedRevenue, returnOnSpend: marketingSpend > 0 ? attributedRevenue / marketingSpend : 0,
      openTickets: supportTickets.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length, overdueTickets: supportTickets.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status) && ((!item.firstRespondedAt && item.responseDueAt && item.responseDueAt < new Date()) || (item.resolutionDueAt && item.resolutionDueAt < new Date()))).length,
      pendingWebsiteApprovals: websiteRequests.filter((item) => item.status === "AWAITING_APPROVAL").length, failedDeployments: websiteDeployments.filter((item) => item.status === "FAILED").length,
      pendingPurchaseApprovals: purchaseOrders.filter((item) => item.status === "AWAITING_APPROVAL").length, overdueSupplierDeliveries: purchaseOrders.filter((item) => ["ORDERED", "PARTIALLY_RECEIVED"].includes(item.status) && item.expectedDelivery && item.expectedDelivery < new Date()).length,
      todayEvents: calendarEvents.filter((item) => item.startAt < new Date(new Date().setHours(24,0,0,0)) && item.status !== "CANCELED").length, calendarNoShows: calendarEvents.filter((item) => item.status === "NO_SHOW").length,
    }, alerts };
  }
}
