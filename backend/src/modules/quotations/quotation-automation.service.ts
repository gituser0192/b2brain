import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AutomationPolicyService } from "../automation-policies/automation-policy.service.js";

type Config = { validDays?: unknown; taxPercent?: unknown; discount?: unknown; terms?: unknown };
export function quotationAutomationConfig(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Config : {};
  const finite = (candidate: unknown, fallback: number) => typeof candidate === "number" && Number.isFinite(candidate) ? candidate : fallback;
  return {
    validDays: Math.min(90, Math.max(1, Math.round(finite(input.validDays, 7)))),
    taxPercent: Math.min(100, Math.max(0, finite(input.taxPercent, 0))),
    discount: Math.max(0, finite(input.discount, 0)),
    terms: typeof input.terms === "string" && input.terms.trim() ? input.terms.trim().slice(0, 4000) : "Subject to approval and the agreed scope of work.",
  };
}

export class QuotationAutomationService {
  private policies = new AutomationPolicyService();

  async prepare(organizationId: string, actorUserId: string, eventId: string, inquiryId: string, customerId: string, dealId: string) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId, customerId, deletedAt: null }, include: { customer: { select: { displayName: true, email: true } } } });
    if (!deal) return { matched: false, reason: "DEAL_NOT_FOUND" };
    const evaluation = await this.policies.evaluate(organizationId, actorUserId, {
      eventCode: "SALES.DEAL_CREATED_FROM_WEBSITE",
      sourceType: "DEAL",
      sourceId: deal.id,
      dedupeKey: `quotation:${deal.id}`,
      payload: { source: "WEBSITE", amount: Number(deal.amount), currency: deal.currency, hasEmail: Boolean(deal.customer.email) },
    }, { simulation: false, forceApproval: true, actionCodes: ["PREPARE_QUOTATION_FOR_APPROVAL"] });
    if (!evaluation.matched || !evaluation.execution || evaluation.duplicate) return evaluation;
    const policy = await prisma.automationPolicy.findFirst({ where: { id: evaluation.execution.policyId, organizationId, status: "ACTIVE", archivedAt: null }, select: { actionConfig: true } });
    if (!policy) return { matched: false, reason: "POLICY_NOT_ACTIVE" };
    const config = quotationAutomationConfig(policy.actionConfig);
    const issueDate = new Date(), validUntil = new Date(issueDate.getTime() + config.validDays * 86_400_000);
    const subtotal = Number(deal.amount), discount = Math.min(config.discount, subtotal), tax = Math.max(0, (subtotal - discount) * config.taxPercent / 100), total = subtotal - discount + tax;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.quotation.findFirst({ where: { organizationId, dealId: deal.id, archivedAt: null, status: { notIn: ["CANCELED", "REJECTED"] } } });
        if (existing) return { quotationId: existing.id, approvalId: null, existing: true };
        const quotation = await tx.quotation.create({ data: {
          organizationId, customerId, inquiryId, dealId: deal.id,
          quotationNumber: `AUTO-${deal.id.slice(0, 8).toUpperCase()}`, issueDate, validUntil, currency: deal.currency,
          subtotal: new Prisma.Decimal(subtotal), discount: new Prisma.Decimal(discount), tax: new Prisma.Decimal(tax), total: new Prisma.Decimal(total),
          notes: `Automatically prepared from sales opportunity: ${deal.name}`, terms: config.terms,
          createdById: actorUserId, updatedById: actorUserId,
          items: { create: [{ organizationId, description: deal.name, quantity: new Prisma.Decimal(1), unitPrice: new Prisma.Decimal(subtotal), amount: new Prisma.Decimal(subtotal) }] },
        } });
        const approval = await tx.approvalRequest.create({ data: {
          organizationId, serviceCode: "SALES", actionCode: "APPROVE_AND_SEND_QUOTATION",
          title: `Approve quotation ${quotation.quotationNumber}`, description: `Review the ${deal.currency} ${total.toFixed(2)} quotation for ${deal.customer.displayName}. Approval will send it by email.`,
          riskLevel: "MEDIUM", sourceType: "QUOTATION_AUTOMATION", sourceId: evaluation.execution.id,
          requestedById: actorUserId, dueAt: new Date(Date.now() + 4 * 3_600_000),
          context: { quotationId: quotation.id, customerId, dealId: deal.id, deliveryChannel: "EMAIL", externalDeliveryPerformed: false },
        } });
        const owner = await tx.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" }, user: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } });
        if (owner) await tx.notification.create({ data: { organizationId, recipientId: owner.userId, type: "APPROVAL_REQUIRED", title: `Quotation ${quotation.quotationNumber} is ready`, message: `Review and approve the quotation for ${deal.customer.displayName}.`, sourceType: "QUOTATION_AUTOMATION", sourceId: evaluation.execution.id, actionPath: "/dashboard?view=governance", createdById: actorUserId, updatedById: actorUserId } });
        await tx.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { status: "AWAITING_APPROVAL", completedAt: null, output: { quotationId: quotation.id, approvalId: approval.id, deliveryPerformed: false } } });
        await tx.auditEvent.create({ data: { organizationId, actorType: "SYSTEM", serviceCode: "SALES", actionCode: "QUOTATION_PREPARED_FOR_APPROVAL", sourceType: "QUOTATION", sourceId: quotation.id, summary: `Prepared quotation ${quotation.quotationNumber} for approval.`, afterState: { status: "DRAFT", total, approvalId: approval.id }, metadata: { policyExecutionId: evaluation.execution.id, eventId } } });
        return { quotationId: quotation.id, approvalId: approval.id, existing: false };
      });
      return { ...evaluation, result };
    } catch (error) {
      await prisma.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { status: "FAILED", completedAt: null, failureMessage: error instanceof Error ? error.message : "Quotation preparation failed" } });
      throw error;
    }
  }
}
