import { Prisma, type ApprovalRiskLevel } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { RecommendationDecisionInput } from "./action-centre.validation.js";

type Candidate = {
  fingerprint: string;
  serviceCode: string;
  actionCode: string;
  sourceType: string;
  sourceId: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  impactSummary: string | null;
  priority: ApprovalRiskLevel;
  evidence: Prisma.InputJsonValue;
};

export class ActionCentreService {
  private async detect(organizationId: string, permissions: string[]) {
    const enabled = new Set((await prisma.organizationService.findMany({
      where: { organizationId, status: "ENABLED", deletedAt: null, service: { status: "ACTIVE", archivedAt: null } },
      select: { service: { select: { code: true } } },
    })).map((item) => item.service.code));
    const can = (service: string, permission: string) => enabled.has(service) && permissions.includes(permission);
    const visibleServices = [
      ...(can("LEADS", "INQUIRY_VIEW") ? ["LEADS"] : []),
      ...(can("FINANCE", "FINANCE_VIEW") ? ["FINANCE"] : []),
      ...(can("PROJECTS", "TASK_VIEW") ? ["PROJECTS"] : []),
      ...(can("SALES", "DEAL_VIEW") ? ["SALES"] : []),
    ];
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const stalledAt = new Date(now.getTime() - 14 * 86_400_000);
    const [inquiries, invoices, tasks, deals] = await Promise.all([
      can("LEADS", "INQUIRY_VIEW") ? prisma.inquiry.findMany({ where: { organizationId, deletedAt: null, status: { in: ["NEW", "REVIEWING", "QUALIFIED"] }, nextFollowUpAt: null, createdAt: { lt: dayAgo } }, select: { id: true, contactName: true, subject: true, priority: true, createdAt: true } }) : [],
      can("FINANCE", "FINANCE_VIEW") ? prisma.invoice.findMany({ where: { organizationId, deletedAt: null, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } }, include: { customer: { select: { displayName: true } }, payments: { where: { deletedAt: null }, select: { amount: true } } } }) : [],
      can("PROJECTS", "TASK_VIEW") ? prisma.projectTask.findMany({ where: { organizationId, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELED"] }, dueDate: { lt: now } }, include: { project: { select: { name: true } } } }) : [],
      can("SALES", "DEAL_VIEW") ? prisma.deal.findMany({ where: { organizationId, deletedAt: null, stage: { notIn: ["WON", "LOST"] }, OR: [{ expectedCloseDate: { lt: now } }, { updatedAt: { lt: stalledAt } }] }, include: { customer: { select: { displayName: true } } } }) : [],
    ]);
    const candidates: Candidate[] = [];
    for (const item of inquiries) candidates.push({ fingerprint: `LEAD_FOLLOW_UP:${item.id}`, serviceCode: "LEADS", actionCode: "LEAD_FOLLOW_UP", sourceType: "INQUIRY", sourceId: item.id, title: `Follow up with ${item.contactName}`, explanation: `The “${item.subject}” inquiry has been open for more than 24 hours without a scheduled follow-up.`, recommendedAction: "Schedule a follow-up for the next business day and record it in the inquiry timeline.", impactSummary: "Reduces the risk of losing an unattended lead.", priority: item.priority === "URGENT" ? "CRITICAL" : item.priority === "HIGH" ? "HIGH" : "MEDIUM", evidence: { subject: item.subject, createdAt: item.createdAt.toISOString(), followUpScheduled: false } });
    for (const item of invoices) {
      const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = Math.max(0, Number(item.total) - paid);
      if (outstanding <= 0) continue;
      candidates.push({ fingerprint: `INVOICE_COLLECTION:${item.id}`, serviceCode: "FINANCE", actionCode: "INVOICE_COLLECTION", sourceType: "INVOICE", sourceId: item.id, title: `Collect overdue ${item.invoiceNumber}`, explanation: `${item.customer.displayName} has ${item.currency} ${outstanding.toFixed(2)} outstanding after the invoice due date.`, recommendedAction: "Create a collection follow-up for tomorrow and notify the approving owner.", impactSummary: `${item.currency} ${outstanding.toFixed(2)} cash at risk.`, priority: "HIGH", evidence: { invoiceNumber: item.invoiceNumber, dueDate: item.dueDate.toISOString(), outstanding, currency: item.currency } });
    }
    for (const item of tasks) candidates.push({ fingerprint: `PROJECT_ESCALATION:${item.id}`, serviceCode: "PROJECTS", actionCode: "PROJECT_ESCALATION", sourceType: "PROJECT_TASK", sourceId: item.id, title: `Escalate overdue task: ${item.title}`, explanation: `This task in ${item.project.name} is overdue and still ${item.status.toLowerCase().replaceAll("_", " ")}.`, recommendedAction: "Notify the responsible owner to review the task immediately.", impactSummary: "Protects the project delivery date.", priority: item.priority === "URGENT" ? "CRITICAL" : item.priority === "HIGH" ? "HIGH" : "MEDIUM", evidence: { project: item.project.name, dueDate: item.dueDate?.toISOString() ?? null, status: item.status } });
    for (const item of deals) candidates.push({ fingerprint: `DEAL_REVIEW:${item.id}`, serviceCode: "SALES", actionCode: "DEAL_REVIEW", sourceType: "DEAL", sourceId: item.id, title: `Review stalled deal: ${item.name}`, explanation: `${item.customer.displayName}'s deal is overdue or has had no update for at least 14 days.`, recommendedAction: "Notify the deal owner to review the next step and expected close date.", impactSummary: `${item.currency} ${Number(item.amount).toFixed(2)} pipeline requires attention.`, priority: Number(item.amount) > 100000 ? "HIGH" : "MEDIUM", evidence: { stage: item.stage, amount: Number(item.amount), currency: item.currency, expectedCloseDate: item.expectedCloseDate?.toISOString() ?? null } });
    return { candidates, visibleServices };
  }

  async list(organizationId: string, permissions: string[]) {
    const { candidates, visibleServices } = await this.detect(organizationId, permissions);
    const now = new Date();
    for (const candidate of candidates) {
      await prisma.businessRecommendation.upsert({
        where: { organizationId_fingerprint: { organizationId, fingerprint: candidate.fingerprint } },
        create: { organizationId, ...candidate, lastDetectedAt: now },
        update: { title: candidate.title, explanation: candidate.explanation, recommendedAction: candidate.recommendedAction, impactSummary: candidate.impactSummary, priority: candidate.priority, evidence: candidate.evidence, lastDetectedAt: now },
      });
      await prisma.businessRecommendation.updateMany({ where: { organizationId, fingerprint: candidate.fingerprint, status: "RESOLVED" }, data: { status: "OPEN", resolvedAt: null } });
    }
    for (const serviceCode of visibleServices) {
      const active = candidates.filter((item) => item.serviceCode === serviceCode).map((item) => item.fingerprint);
      await prisma.businessRecommendation.updateMany({ where: { organizationId, serviceCode, status: "OPEN", ...(active.length ? { fingerprint: { notIn: active } } : {}) }, data: { status: "RESOLVED", resolvedAt: now } });
    }
    const items = await prisma.businessRecommendation.findMany({ where: { organizationId, ...(visibleServices.length ? { serviceCode: { in: visibleServices } } : { id: { equals: "00000000-0000-0000-0000-000000000000" } }) }, include: { decidedBy: { select: { firstName: true, lastName: true } } }, orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }] });
    return { items, metrics: { open: items.filter((item) => item.status === "OPEN").length, critical: items.filter((item) => item.status === "OPEN" && item.priority === "CRITICAL").length, executed: items.filter((item) => item.status === "EXECUTED").length, dismissed: items.filter((item) => item.status === "DISMISSED").length } };
  }

  async decide(organizationId: string, actorUserId: string, permissions: string[], id: string, input: RecommendationDecisionInput) {
    return prisma.$transaction(async (tx) => {
      const recommendation = await tx.businessRecommendation.findFirst({ where: { id, organizationId, status: "OPEN" } });
      if (!recommendation) throw new AppError(404, "Open recommendation was not found.", "RECOMMENDATION_NOT_FOUND");
      if (input.decision === "DISMISS") {
        const dismissed = await tx.businessRecommendation.update({ where: { id }, data: { status: "DISMISSED", decisionNote: input.note ?? null, decidedById: actorUserId, decidedAt: new Date() } });
        await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: recommendation.serviceCode, actionCode: "RECOMMENDATION_DISMISSED", sourceType: "BUSINESS_RECOMMENDATION", sourceId: id, summary: `Dismissed recommendation: ${recommendation.title}`, beforeState: { status: "OPEN" }, afterState: { status: "DISMISSED" }, metadata: { note: input.note ?? null } } });
        return dismissed;
      }
      const requiredPermission: Record<string, string> = { LEADS: "INQUIRY_MANAGE", FINANCE: "FINANCE_MANAGE", PROJECTS: "TASK_MANAGE", SALES: "DEAL_MANAGE" };
      if (!permissions.includes(requiredPermission[recommendation.serviceCode] ?? ""))
        throw new AppError(403, "You do not have permission to execute actions for this service.", "ACTION_PERMISSION_REQUIRED");
      const tomorrow = new Date(Date.now() + 86_400_000);
      if (recommendation.actionCode === "LEAD_FOLLOW_UP") {
        const result = await tx.inquiry.updateMany({ where: { id: recommendation.sourceId, organizationId, deletedAt: null, status: { in: ["NEW", "REVIEWING", "QUALIFIED"] }, nextFollowUpAt: null }, data: { nextFollowUpAt: tomorrow, followUpNote: "Follow up on unattended inquiry", followUpCompletedAt: null, updatedById: actorUserId } });
        if (result.count !== 1) throw new AppError(409, "The inquiry no longer requires this action.", "RECOMMENDATION_SOURCE_CHANGED");
        await tx.inquiryTimeline.create({ data: { organizationId, inquiryId: recommendation.sourceId, type: "FOLLOW_UP_SCHEDULED", summary: `Follow-up scheduled by Business Action Centre for ${tomorrow.toISOString()}`, details: recommendation.explanation, createdById: actorUserId } });
      } else if (recommendation.actionCode === "INVOICE_COLLECTION") {
        const invoice = await tx.invoice.findFirst({ where: { id: recommendation.sourceId, organizationId, deletedAt: null }, include: { customer: { select: { displayName: true } }, payments: { where: { deletedAt: null } } } });
        if (!invoice) throw new AppError(409, "The invoice is no longer available.", "RECOMMENDATION_SOURCE_CHANGED");
        const outstanding = Number(invoice.total) - invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        if (outstanding <= 0) throw new AppError(409, "The invoice no longer has an outstanding balance.", "RECOMMENDATION_SOURCE_CHANGED");
        const followUp = await tx.customerFollowUp.create({ data: { organizationId, customerId: invoice.customerId, title: `Collect ${invoice.invoiceNumber}`, description: `${invoice.customer.displayName} has ${invoice.currency} ${outstanding.toFixed(2)} outstanding.`, dueAt: tomorrow, assignedToId: actorUserId, createdById: actorUserId, updatedById: actorUserId } });
        await tx.notification.create({ data: { organizationId, recipientId: actorUserId, type: "FOLLOW_UP_DUE", title: followUp.title, message: followUp.description ?? "Collection follow-up created.", sourceType: "BUSINESS_RECOMMENDATION", sourceId: id, actionPath: "/dashboard?view=crm", availableAt: tomorrow, createdById: actorUserId, updatedById: actorUserId } });
      } else if (recommendation.actionCode === "PROJECT_ESCALATION") {
        const task = await tx.projectTask.findFirst({ where: { id: recommendation.sourceId, organizationId, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELED"] } } });
        if (!task) throw new AppError(409, "The task no longer requires escalation.", "RECOMMENDATION_SOURCE_CHANGED");
        await tx.notification.create({ data: { organizationId, recipientId: task.assignedToId ?? actorUserId, type: "AGENT_ALERT", title: `Overdue task: ${task.title}`, message: recommendation.explanation, sourceType: "BUSINESS_RECOMMENDATION", sourceId: id, actionPath: "/dashboard?view=projects", createdById: actorUserId, updatedById: actorUserId } });
      } else if (recommendation.actionCode === "DEAL_REVIEW") {
        const deal = await tx.deal.findFirst({ where: { id: recommendation.sourceId, organizationId, deletedAt: null, stage: { notIn: ["WON", "LOST"] } } });
        if (!deal) throw new AppError(409, "The deal no longer requires review.", "RECOMMENDATION_SOURCE_CHANGED");
        await tx.notification.create({ data: { organizationId, recipientId: deal.ownerId, type: "AGENT_ALERT", title: `Review deal: ${deal.name}`, message: recommendation.explanation, sourceType: "BUSINESS_RECOMMENDATION", sourceId: id, actionPath: "/dashboard?view=sales", createdById: actorUserId, updatedById: actorUserId } });
      } else throw new AppError(400, "This recommendation action is not supported.", "UNSUPPORTED_RECOMMENDATION");
      const executed = await tx.businessRecommendation.update({ where: { id }, data: { status: "EXECUTED", decisionNote: input.note ?? null, decidedById: actorUserId, decidedAt: new Date(), executedAt: new Date() } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: recommendation.serviceCode, actionCode: "RECOMMENDATION_EXECUTED", sourceType: "BUSINESS_RECOMMENDATION", sourceId: id, summary: `Executed recommendation: ${recommendation.title}`, beforeState: { status: "OPEN" }, afterState: { status: "EXECUTED", actionCode: recommendation.actionCode } } });
      return executed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
