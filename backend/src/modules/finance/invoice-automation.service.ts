import { prisma } from "../../database/prisma.js";
import { EmailService } from "../../shared/email/email.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AutomationPolicyService } from "../automation-policies/automation-policy.service.js";
import { FinanceService } from "./finance.service.js";

type Config = { dueDays?: unknown; emailNote?: unknown };
export function invoiceAutomationConfig(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Config : {};
  return {
    dueDays: Math.min(90, Math.max(1, Math.round(typeof input.dueDays === "number" && Number.isFinite(input.dueDays) ? input.dueDays : 7))),
    emailNote: typeof input.emailNote === "string" && input.emailNote.trim() ? input.emailNote.trim().slice(0, 2000) : "Please use the agreed payment method and include the invoice number as the payment reference.",
  };
}

export class InvoiceAutomationService {
  private policies = new AutomationPolicyService();
  private email = new EmailService();
  private finance = new FinanceService();

  async prepare(organizationId: string, actorUserId: string, quotationId: string) {
    const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, organizationId, archivedAt: null, status: "ACCEPTED", invoiceId: null }, include: { items: true, customer: { select: { displayName: true, email: true } } } });
    if (!quotation) return { matched: false, reason: "QUOTATION_NOT_ELIGIBLE" };
    const evaluation = await this.policies.evaluate(organizationId, actorUserId, { eventCode: "FINANCE.QUOTATION_ACCEPTED", sourceType: "QUOTATION", sourceId: quotation.id, dedupeKey: `invoice:${quotation.id}`, payload: { currency: quotation.currency, total: Number(quotation.total), hasEmail: Boolean(quotation.customer.email) } }, { simulation: false, forceApproval: true, actionCodes: ["PREPARE_INVOICE_FOR_APPROVAL"] });
    if (!evaluation.matched || !evaluation.execution || evaluation.duplicate) return evaluation;
    const policy = await prisma.automationPolicy.findFirst({ where: { id: evaluation.execution.policyId, organizationId, status: "ACTIVE", archivedAt: null }, select: { actionConfig: true } });
    if (!policy) return { matched: false, reason: "POLICY_NOT_ACTIVE" };
    const config = invoiceAutomationConfig(policy.actionConfig), issueDate = new Date(), dueDate = new Date(issueDate.getTime() + config.dueDays * 86_400_000);
    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.quotation.findFirst({ where: { id: quotation.id, organizationId, archivedAt: null, status: "ACCEPTED", invoiceId: null }, include: { items: true } });
        if (!current) return null;
        const invoice = await tx.invoice.create({ data: { organizationId, customerId: current.customerId, projectId: null, invoiceNumber: `INV-${current.id.slice(0, 8).toUpperCase()}`, status: "DRAFT", issueDate, dueDate, currency: current.currency, subtotal: current.subtotal, discount: current.discount, tax: current.tax, total: current.total, notes: config.emailNote, createdById: actorUserId, updatedById: actorUserId, items: { create: current.items.map(item => ({ organizationId, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })) } } });
        await tx.quotation.update({ where: { id: current.id, organizationId }, data: { status: "CONVERTED", invoiceId: invoice.id, convertedAt: new Date(), updatedById: actorUserId } });
        const approval = await tx.approvalRequest.create({ data: { organizationId, serviceCode: "FINANCE", actionCode: "APPROVE_AND_SEND_INVOICE", title: `Approve invoice ${invoice.invoiceNumber}`, description: `Review the ${invoice.currency} ${Number(invoice.total).toFixed(2)} invoice for ${quotation.customer.displayName}. Approval will issue and email it.`, riskLevel: "MEDIUM", sourceType: "INVOICE_AUTOMATION", sourceId: evaluation.execution.id, requestedById: actorUserId, dueAt: new Date(Date.now() + 4 * 3_600_000), context: { invoiceId: invoice.id, customerId: invoice.customerId, quotationId: current.id, deliveryChannel: "EMAIL", externalDeliveryPerformed: false } } });
        const owner = await tx.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" }, user: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } });
        if (owner) await tx.notification.create({ data: { organizationId, recipientId: owner.userId, type: "APPROVAL_REQUIRED", title: `Invoice ${invoice.invoiceNumber} is ready`, message: `Approve and email the invoice for ${quotation.customer.displayName}.`, sourceType: "INVOICE_AUTOMATION", sourceId: evaluation.execution.id, actionPath: "/dashboard?view=governance", createdById: actorUserId, updatedById: actorUserId } });
        await tx.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { status: "AWAITING_APPROVAL", completedAt: null, output: { invoiceId: invoice.id, approvalId: approval.id, deliveryPerformed: false } } });
        await tx.auditEvent.create({ data: { organizationId, actorType: "SYSTEM", serviceCode: "FINANCE", actionCode: "INVOICE_PREPARED_FOR_APPROVAL", sourceType: "INVOICE", sourceId: invoice.id, summary: `Prepared invoice ${invoice.invoiceNumber} from accepted quotation ${current.quotationNumber}.`, afterState: { status: "DRAFT", total: Number(invoice.total), approvalId: approval.id } } });
        return { invoiceId: invoice.id, approvalId: approval.id };
      });
      return { ...evaluation, result };
    } catch (error) {
      await prisma.automationPolicyExecution.update({ where: { id: evaluation.execution.id }, data: { status: "FAILED", completedAt: null, failureMessage: error instanceof Error ? error.message : "Invoice preparation failed" } });
      throw error;
    }
  }

  async deliverApproved(organizationId: string, actorUserId: string, approvalId: string) {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, organizationId, sourceType: "INVOICE_AUTOMATION", status: "APPROVED" } });
    const context = approval?.context as { invoiceId?: string; customerId?: string } | null;
    if (!approval || !context?.invoiceId || !context.customerId) throw new AppError(404, "Approved invoice delivery was not found.", "INVOICE_APPROVAL_NOT_FOUND");
    const invoice = await prisma.invoice.findFirst({ where: { id: context.invoiceId, organizationId, customerId: context.customerId, deletedAt: null, status: "ISSUED" }, include: { customer: { select: { displayName: true, email: true } } } });
    if (!invoice?.customer.email) throw new AppError(409, "Customer email is required for invoice delivery.", "CUSTOMER_EMAIL_REQUIRED");
    const body = `Hello ${invoice.customer.displayName},\n\nInvoice ${invoice.invoiceNumber} for ${invoice.currency} ${Number(invoice.total).toFixed(2)} is due on ${invoice.dueDate.toISOString().slice(0, 10)}.\n\n${invoice.notes ?? "Please include the invoice number with your payment."}`;
    const result = await this.email.send({ to: invoice.customer.email, subject: `Invoice ${invoice.invoiceNumber}`, text: body, html: `<p>${body.replaceAll("\n", "<br>")}</p>` });
    await prisma.$transaction(async tx => {
      await tx.customerActivity.create({ data: { organizationId, customerId: invoice.customerId, type: "NOTE", summary: result.delivered ? `Invoice ${invoice.invoiceNumber} emailed.` : `Invoice ${invoice.invoiceNumber} email delivery failed.`, details: result.delivered ? `Delivered to ${invoice.customer.email}.` : result.error, createdById: actorUserId, updatedById: actorUserId } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "FINANCE", actionCode: result.delivered ? "INVOICE_EMAIL_SENT" : "INVOICE_EMAIL_FAILED", sourceType: "INVOICE", sourceId: invoice.id, summary: result.delivered ? `Approved invoice ${invoice.invoiceNumber} emailed.` : `Email delivery failed for invoice ${invoice.invoiceNumber}.`, metadata: { approvalId, recipient: invoice.customer.email, providerMessageId: result.messageId, externalDeliveryPerformed: result.delivered } } });
    });
    const followUp = await this.finance.createCollectionFollowUp(organizationId, actorUserId, invoice.id);
    return { status: result.delivered ? "SENT" : "FAILED", recipient: invoice.customer.email, messageId: result.messageId, followUpId: followUp.id, error: result.error };
  }
}
