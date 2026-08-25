import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { EmailService } from "../../shared/email/email.service.js";
import type { CollectionEmailDeliveryInput, EmailDeliveryPolicyInput } from "./bridge.validation.js";
import { emailPolicy, isQuietHours } from "./email-policy.engine.js";
import { logger } from "../../config/logger.js";

type CollectionContext = {
  agentRunId?: string;
  invoiceId?: string;
  customerId?: string;
  proposedMessage?: string;
  deliveryState?: string;
  externalDeliveryPerformed?: boolean;
  paymentStatusChanged?: boolean;
};
const htmlEscape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export class EmailDeliveryService {
  private readonly email = new EmailService();

  async workspace(organizationId: string) {
    const [connectors, approvals, deliveries] = await Promise.all([
      prisma.integrationConnector.findMany({
        where: { organizationId, type: "EMAIL", deletedAt: null },
        select: { id: true, name: true, provider: true, status: true, configuration: true, lastSuccessfulAt: true, lastErrorAt: true, lastErrorMessage: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalRequest.findMany({
        where: { organizationId, sourceType: "COLLECTION_AGENT_RUN", status: "APPROVED" },
        select: { id: true, title: true, description: true, context: true, decidedAt: true },
        orderBy: { decidedAt: "desc" },
        take: 100,
      }),
      prisma.automationMessageDraft.findMany({
        where: { organizationId, sourceType: "COLLECTION_APPROVAL" },
        select: { id: true, connectorId: true, sourceId: true, recipient: true, subject: true, status: true, externalMessageId: true, failureMessage: true, attemptCount: true, nextRetryAt: true, providerStatus: true, sentAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const invoiceIds = approvals.map((item) => (item.context as CollectionContext | null)?.invoiceId).filter((id): id is string => Boolean(id));
    const invoices = invoiceIds.length ? await prisma.invoice.findMany({
      where: { organizationId, id: { in: invoiceIds }, deletedAt: null },
      select: { id: true, invoiceNumber: true, currency: true, total: true, customer: { select: { displayName: true, email: true } } },
    }) : [];
    const invoiceMap = new Map(invoices.map((item) => [item.id, item]));
    const deliveryMap = new Map(deliveries.map((item) => [item.sourceId, item]));
    return {
      smtpConfigured: this.email.configured(),
      connectors: connectors.map((connector) => ({ ...connector, policy: emailPolicy(connector.configuration), configuration: undefined })),
      ready: approvals.map((approval) => {
        const context = approval.context as CollectionContext | null;
        const invoice = context?.invoiceId ? invoiceMap.get(context.invoiceId) : undefined;
        return { ...approval, context, invoice: invoice ?? null, delivery: deliveryMap.get(approval.id) ?? null };
      }),
      deliveries,
    };
  }

  async savePolicy(organizationId: string, actorUserId: string, connectorId: string, input: EmailDeliveryPolicyInput) {
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(new Date()); } catch { throw new AppError(400, "Select a valid IANA timezone.", "INVALID_TIMEZONE"); }
    const connector = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId, type: "EMAIL", deletedAt: null } });
    if (!connector) throw new AppError(404, "Email connector not found.", "EMAIL_CONNECTOR_NOT_FOUND");
    if (input.mode === "SEND_AFTER_APPROVAL") {
      const others = await prisma.integrationConnector.findMany({ where: { organizationId, id: { not: connector.id }, type: "EMAIL", status: "ACTIVE", deletedAt: null }, select: { configuration: true } });
      if (others.some((item) => emailPolicy(item.configuration).mode === "SEND_AFTER_APPROVAL")) throw new AppError(409, "Only one active email connector can send automatically for an organization.", "AUTO_EMAIL_CONNECTOR_EXISTS");
    }
    const configuration = connector.configuration && typeof connector.configuration === "object" && !Array.isArray(connector.configuration) ? connector.configuration as Record<string, unknown> : {};
    await prisma.integrationConnector.update({ where: { id: connector.id }, data: { configuration: { ...configuration, emailDeliveryPolicy: input }, updatedById: actorUserId } });
    await prisma.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "AUTOMATION", actionCode: "EMAIL_DELIVERY_POLICY_UPDATED", sourceType: "INTEGRATION_CONNECTOR", sourceId: connector.id, summary: `Email delivery policy changed to ${input.mode.toLowerCase().replaceAll("_", " ")}.`, metadata: { ...input } } });
    return input;
  }

  async deliver(organizationId: string, actorUserId: string, input: CollectionEmailDeliveryInput, automatic = false) {
    const connector = await prisma.integrationConnector.findFirst({ where: { id: input.connectorId, organizationId, type: "EMAIL", status: "ACTIVE", deletedAt: null } });
    if (!connector) throw new AppError(404, "Select an active email connector.", "EMAIL_CONNECTOR_NOT_FOUND");
    const policy = emailPolicy(connector.configuration);
    if (policy.emergencyPaused) throw new AppError(409, "Email delivery is emergency-paused for this organization.", "EMAIL_DELIVERY_PAUSED");
    if (isQuietHours(policy)) {
      if (automatic) return { status: "DEFERRED_QUIET_HOURS" as const, externalDeliveryPerformed: false, paymentStatusChanged: false };
      throw new AppError(409, "Email delivery is blocked during configured quiet hours.", "EMAIL_QUIET_HOURS");
    }
    const contacts = await prisma.automationMessageDraft.count({ where: { organizationId, connectorId: connector.id, status: "SENT", sentAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } });
    if (contacts >= policy.dailyContactLimit) throw new AppError(429, "The email connector daily contact limit has been reached.", "EMAIL_DAILY_LIMIT_REACHED");
    if (!this.email.configured()) throw new AppError(503, "SMTP is not configured on the B² Brain server.", "SMTP_NOT_CONFIGURED");
    const approval = await prisma.approvalRequest.findFirst({ where: { id: input.approvalId, organizationId, sourceType: "COLLECTION_AGENT_RUN", status: "APPROVED" } });
    if (!approval) throw new AppError(409, "This collection reminder is not approved for delivery.", "DELIVERY_NOT_APPROVED");
    const context = approval.context as CollectionContext | null;
    if (!context?.invoiceId || !context.customerId || !context.agentRunId || !["READY_FOR_PROVIDER", "FAILED"].includes(context.deliveryState ?? "")) throw new AppError(409, "The approved reminder is not ready for provider delivery.", "DELIVERY_NOT_READY");
    const agentRunId = context.agentRunId;
    const invoice = await prisma.invoice.findFirst({ where: { id: context.invoiceId, organizationId, customerId: context.customerId, deletedAt: null }, include: { customer: { select: { displayName: true, email: true } } } });
    if (!invoice) throw new AppError(404, "The organization invoice was not found.", "INVOICE_NOT_FOUND");
    if (!invoice.customer.email) throw new AppError(409, "Add an email address to this CRM customer before delivery.", "CUSTOMER_EMAIL_REQUIRED");
    const existing = await prisma.automationMessageDraft.findFirst({ where: { organizationId, sourceType: "COLLECTION_APPROVAL", sourceId: approval.id } });
    if (existing?.status === "SENT") throw new AppError(409, "This approved reminder has already been sent.", "DELIVERY_ALREADY_SENT");
    if (existing?.status === "SENDING") throw new AppError(409, "This reminder is already being delivered.", "DELIVERY_IN_PROGRESS");
    if ((existing?.attemptCount ?? 0) >= policy.maxAttempts) throw new AppError(409, "This reminder reached its maximum delivery attempts.", "EMAIL_MAX_ATTEMPTS_REACHED");
    const subject = `Payment reminder: invoice ${invoice.invoiceNumber}`;
    const body = context.proposedMessage?.trim() || approval.description?.trim();
    if (!body) throw new AppError(409, "The approved reminder has no message body.", "DELIVERY_BODY_MISSING");
    let draft;
    try {
      draft = existing ? await prisma.automationMessageDraft.update({ where: { id: existing.id }, data: { connectorId: connector.id, recipient: invoice.customer.email, subject, body, status: "SENDING", failureMessage: null, nextRetryAt: null, attemptCount: { increment: 1 }, updatedById: actorUserId } }) : await prisma.automationMessageDraft.create({ data: { organizationId, connectorId: connector.id, recipient: invoice.customer.email, subject, body, sourceType: "COLLECTION_APPROVAL", sourceId: approval.id, status: "SENDING", attemptCount: 1, approvedById: approval.decidedById, approvedAt: approval.decidedAt, createdById: actorUserId, updatedById: actorUserId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "This approved reminder already has a delivery attempt.", "DUPLICATE_DELIVERY");
      throw error;
    }
    const result = await this.email.send({ to: invoice.customer.email, subject, text: body, html: `<p>${htmlEscape(body).replaceAll("\n", "<br>")}</p>` });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.automationMessageDraft.update({ where: { id: draft.id }, data: { status: result.delivered ? "SENT" : "FAILED", providerStatus: result.delivered ? "ACCEPTED_PENDING_BOUNCE" : "FAILED", externalMessageId: result.messageId, failureMessage: result.error, nextRetryAt: result.delivered || draft.attemptCount >= policy.maxAttempts ? null : new Date(now.getTime() + Math.min(60, 5 * 2 ** (draft.attemptCount - 1)) * 60_000), sentAt: result.delivered ? now : null, updatedById: actorUserId } });
      await tx.integrationConnector.update({ where: { id: connector.id }, data: result.delivered ? { lastSuccessfulAt: now, lastErrorMessage: null, updatedById: actorUserId } : { lastErrorAt: now, lastErrorMessage: result.error, updatedById: actorUserId } });
      const updatedContext = { ...context, deliveryState: result.delivered ? "SENT" : "FAILED", externalDeliveryPerformed: result.delivered, deliveredAt: result.delivered ? now.toISOString() : null, deliveryId: draft.id, providerMessageId: result.messageId, paymentStatusChanged: false };
      await tx.approvalRequest.update({ where: { id: approval.id }, data: { context: updatedContext } });
      await tx.agentRun.updateMany({ where: { id: agentRunId, organizationId }, data: { summary: result.delivered ? `${invoice.invoiceNumber}: approved collection reminder emailed to ${invoice.customer.displayName}. No payment record was changed.` : `${invoice.invoiceNumber}: email delivery failed. ${result.error ?? "Provider error."}` } });
      await tx.customerActivity.create({ data: { organizationId, customerId: invoice.customerId, type: "NOTE", summary: result.delivered ? `Collection reminder emailed for ${invoice.invoiceNumber}.` : `Email delivery failed for ${invoice.invoiceNumber}.`, details: result.delivered ? `Delivered to ${invoice.customer.email}. Provider reference: ${result.messageId ?? "not supplied"}.` : result.error, createdById: actorUserId, updatedById: actorUserId } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "AUTOMATION", actionCode: result.delivered ? "COLLECTION_EMAIL_SENT" : "COLLECTION_EMAIL_FAILED", sourceType: "INVOICE", sourceId: invoice.id, summary: result.delivered ? `Approved collection reminder sent for ${invoice.invoiceNumber}.` : `Collection email delivery failed for ${invoice.invoiceNumber}.`, metadata: { approvalId: approval.id, connectorId: connector.id, deliveryId: draft.id, recipient: invoice.customer.email, providerMessageId: result.messageId, externalDeliveryPerformed: result.delivered, paymentStatusChanged: false } } });
    });
    if (!result.delivered) throw new AppError(502, result.error ?? "Email provider rejected the message.", "EMAIL_DELIVERY_FAILED");
    return { deliveryId: draft.id, status: "SENT", recipient: invoice.customer.email, messageId: result.messageId, externalDeliveryPerformed: true, paymentStatusChanged: false };
  }

  async dispatchAfterApproval(organizationId: string, actorUserId: string, approvalId: string) {
    const connectors = await prisma.integrationConnector.findMany({ where: { organizationId, type: "EMAIL", status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "asc" } });
    const connector = connectors.find((item) => { const policy = emailPolicy(item.configuration); return policy.mode === "SEND_AFTER_APPROVAL" && !policy.emergencyPaused; });
    if (!connector) return { status: "MANUAL" as const };
    return this.deliver(organizationId, actorUserId, { connectorId: connector.id, approvalId }, true);
  }

  async retryTick() {
    const automaticConnectors = await prisma.integrationConnector.findMany({ where: { type: "EMAIL", status: "ACTIVE", deletedAt: null }, select: { id: true, organizationId: true, configuration: true, updatedById: true } });
    for (const connector of automaticConnectors) {
      const policy = emailPolicy(connector.configuration);
      if (policy.mode !== "SEND_AFTER_APPROVAL" || policy.emergencyPaused || isQuietHours(policy)) continue;
      const approvals = await prisma.approvalRequest.findMany({ where: { organizationId: connector.organizationId, sourceType: "COLLECTION_AGENT_RUN", status: "APPROVED", context: { path: ["deliveryState"], equals: "READY_FOR_PROVIDER" } }, select: { id: true }, take: 10, orderBy: { decidedAt: "asc" } });
      for (const approval of approvals) try { await this.deliver(connector.organizationId, connector.updatedById, { connectorId: connector.id, approvalId: approval.id }, true); } catch (error) { logger.error({ err: error, approvalId: approval.id }, "Automatic approved email dispatch failed"); }
    }
    const failed = await prisma.automationMessageDraft.findMany({ where: { sourceType: "COLLECTION_APPROVAL", status: "FAILED", nextRetryAt: { lte: new Date() } }, select: { organizationId: true, connectorId: true, sourceId: true }, take: 25 });
    for (const item of failed) if (item.sourceId) try { await this.deliver(item.organizationId, (await prisma.integrationConnector.findUnique({ where: { id: item.connectorId }, select: { updatedById: true } }))?.updatedById ?? "", { connectorId: item.connectorId, approvalId: item.sourceId }, true); } catch (error) { logger.error({ err: error, deliverySourceId: item.sourceId }, "Automatic email retry failed"); }
  }
}

export function startEmailDeliveryDispatcher() { const service = new EmailDeliveryService(); const timer = setInterval(() => void service.retryTick().catch((error) => logger.error({ err: error }, "Email retry tick failed")), 60_000); timer.unref(); return () => clearInterval(timer); }
