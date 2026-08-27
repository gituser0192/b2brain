import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AutomationPolicyService } from "../automation-policies/automation-policy.service.js";
import { QuotationAutomationService } from "../quotations/quotation-automation.service.js";

type ActionConfig = {
  dealAmount?: unknown;
  currency?: unknown;
  probability?: unknown;
  followUpHours?: unknown;
};

export function leadToCashConfig(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as ActionConfig : {};
  const number = (candidate: unknown, fallback: number) => typeof candidate === "number" && Number.isFinite(candidate) ? candidate : fallback;
  return {
    dealAmount: Math.max(0, number(input.dealAmount, 0)),
    currency: typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency) ? input.currency.toUpperCase() : "INR",
    probability: Math.min(100, Math.max(0, Math.round(number(input.probability, 20)))),
    followUpHours: Math.min(720, Math.max(1, Math.round(number(input.followUpHours, 24)))),
  };
}

export class LeadToCashAutomationService {
  private policies = new AutomationPolicyService();
  private quotations = new QuotationAutomationService();

  async run(organizationId: string, actorUserId: string, inquiryId: string, eventId: string) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, organizationId, deletedAt: null },
      include: { assignedEmployee: { select: { linkedUserId: true } } },
    });
    if (!inquiry || !["NEW", "REVIEWING", "QUALIFIED"].includes(inquiry.status)) return { matched: false };

    const salesEnabled = await prisma.organizationService.findFirst({
      where: { organizationId, status: "ENABLED", deletedAt: null, service: { code: "SALES", status: "ACTIVE", archivedAt: null } },
      select: { id: true },
    });
    if (!salesEnabled) return { matched: false, reason: "SALES_NOT_ENABLED" };

    const evaluation = await this.policies.evaluate(organizationId, actorUserId, {
      eventCode: "LEAD.WEBSITE_CAPTURED",
      sourceType: "INTEGRATION_EVENT",
      sourceId: eventId,
      dedupeKey: `lead-to-cash:${eventId}`,
      payload: { source: inquiry.source, type: inquiry.type, priority: inquiry.priority },
    }, { simulation: false, actionCodes: ["CREATE_LEAD_TO_CASH_PIPELINE"] });
    if (!evaluation.matched || !evaluation.execution || evaluation.duplicate || evaluation.execution.status !== "COMPLETED") return evaluation;

    const policy = await prisma.automationPolicy.findFirst({
      where: { id: evaluation.execution.policyId, organizationId, status: "ACTIVE", archivedAt: null },
      select: { actionConfig: true },
    });
    if (!policy) return { matched: false, reason: "POLICY_NOT_ACTIVE" };
    const config = leadToCashConfig(policy.actionConfig);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.inquiry.findFirst({
          where: { id: inquiryId, organizationId, deletedAt: null, status: { in: ["NEW", "REVIEWING", "QUALIFIED"] } },
          include: { assignedEmployee: { select: { linkedUserId: true } } },
        });
        if (!current) return null;
        let customer = current.customerId ? await tx.customer.findFirst({ where: { id: current.customerId, organizationId, deletedAt: null } }) : null;
        if (!customer) customer = await tx.customer.findFirst({
          where: { organizationId, deletedAt: null, OR: [
            ...(current.email ? [{ email: { equals: current.email, mode: "insensitive" as const } }] : []),
            ...(current.phone ? [{ phone: current.phone }] : []),
          ] }, orderBy: { createdAt: "asc" },
        });
        if (!customer) customer = await tx.customer.create({ data: {
          organizationId, type: current.companyName ? "COMPANY" : "PERSON",
          displayName: current.companyName || current.contactName, companyName: current.companyName,
          email: current.email, phone: current.phone, status: "LEAD", createdById: actorUserId, updatedById: actorUserId,
        } });
        const dealName = current.subject;
        let deal = await tx.deal.findFirst({ where: { organizationId, customerId: customer.id, name: { equals: dealName, mode: "insensitive" }, stage: { notIn: ["WON", "LOST"] }, deletedAt: null } });
        if (!deal) deal = await tx.deal.create({ data: {
          organizationId, customerId: customer.id, name: dealName, amount: new Prisma.Decimal(config.dealAmount),
          currency: config.currency, probability: config.probability,
          ownerId: current.assignedEmployee?.linkedUserId ?? actorUserId, createdById: actorUserId, updatedById: actorUserId,
        } });
        const followUp = await tx.customerFollowUp.findFirst({ where: { organizationId, customerId: customer.id, status: "PENDING", deletedAt: null, title: { equals: `Follow up: ${dealName}`, mode: "insensitive" } } })
          ?? await tx.customerFollowUp.create({ data: {
            organizationId, customerId: customer.id, title: `Follow up: ${dealName}`,
            description: "Automatically scheduled from a website inquiry.", dueAt: new Date(Date.now() + config.followUpHours * 3_600_000),
            assignedToId: current.assignedEmployee?.linkedUserId ?? actorUserId, createdById: actorUserId, updatedById: actorUserId,
          } });
        await tx.inquiry.update({ where: { id: current.id }, data: {
          customerId: customer.id, convertedDealId: deal.id, status: "CONVERTED", nextFollowUpAt: null,
          followUpCompletedAt: new Date(), updatedById: actorUserId,
          timeline: { create: { organizationId, type: "CONVERTED", summary: "Automatically converted to CRM customer and sales deal", createdById: actorUserId } },
        } });
        await tx.customerActivity.create({ data: { organizationId, customerId: customer.id, type: "NOTE", summary: "Website inquiry automatically entered the sales pipeline", details: current.subject, createdById: actorUserId, updatedById: actorUserId } });
        await tx.auditEvent.create({ data: { organizationId, actorType: "SYSTEM", serviceCode: "SALES", actionCode: "LEAD_TO_CASH_PIPELINE_CREATED", sourceType: "INQUIRY", sourceId: current.id, summary: `Created CRM customer, deal and follow-up for ${current.contactName}.`, afterState: { customerId: customer.id, dealId: deal.id, followUpId: followUp.id }, metadata: { eventId, policyExecutionId: evaluation.execution.id } } });
        await tx.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { output: { customerId: customer.id, dealId: deal.id, followUpId: followUp.id, inquiryId: current.id, simulated: false } } });
        return { customerId: customer.id, dealId: deal.id, followUpId: followUp.id };
      });
      const quotation = result ? await this.quotations.prepare(organizationId, actorUserId, eventId, inquiryId, result.customerId, result.dealId) : null;
      return { ...evaluation, result, quotation };
    } catch (error) {
      await prisma.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { status: "FAILED", completedAt: null, failureMessage: error instanceof Error ? error.message : "Lead-to-cash automation failed" } });
      throw error;
    }
  }
}
