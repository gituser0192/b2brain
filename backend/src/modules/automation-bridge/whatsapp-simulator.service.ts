import { createHash } from "node:crypto";
import { Prisma, type InquiryType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { WhatsappSimulatorInput, WhatsappTakeoverInput } from "./bridge.validation.js";

type ConnectorConfiguration = { simulator?: boolean; humanTakeoverInquiryIds?: string[] };

export function normalizeWhatsappPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function classifyWhatsappMessage(message: string): InquiryType {
  const text = message.toLowerCase();
  if (/\b(spam|lottery|crypto profit|click here|free money)\b/.test(text)) return "SPAM";
  if (/\b(complaint|angry|unhappy|terrible|fraud|broken|not working)\b/.test(text)) return "COMPLAINT";
  if (/\b(order|buy|purchase|book|deliver|quantity)\b/.test(text)) return "ORDER_REQUEST";
  if (/\b(help|support|issue|problem|error|repair|return)\b/.test(text)) return "SUPPORT";
  if (/\b(price|cost|available|availability|size|colour|color|feature|product|specification)\b/.test(text)) return "PRODUCT_QUESTION";
  if (/\b(quote|quotation|interested|demo|service|sales|plan)\b/.test(text)) return "SALES";
  return "UNCLASSIFIED";
}

function needsHuman(type: InquiryType) {
  return ["COMPLAINT", "SUPPORT", "ORDER_REQUEST", "UNCLASSIFIED"].includes(type);
}

function highRisk(message: string, type: InquiryType) {
  return ["COMPLAINT", "ORDER_REQUEST"].includes(type) || /\b(price|discount|refund|promise|guarantee|payment link|upi)\b/i.test(message);
}

function replyFor(name: string, type: InquiryType) {
  const safeName = name.slice(0, 80);
  const replies: Partial<Record<InquiryType, string>> = {
    SALES: `Hello ${safeName}, thank you for your interest. Our team will review your requirement and contact you shortly.`,
    PRODUCT_QUESTION: `Hello ${safeName}, thank you for your product question. A team member will confirm the correct details before replying.`,
    SUPPORT: `Hello ${safeName}, we have received your support request and a team member will review it.`,
    COMPLAINT: `Hello ${safeName}, we are sorry you faced this issue. Your complaint has been escalated for human review.`,
    ORDER_REQUEST: `Hello ${safeName}, we received your order request. A team member will confirm availability, price and payment details.`,
    UNCLASSIFIED: `Hello ${safeName}, thank you for contacting us. A team member will review your message and respond.`,
  };
  return replies[type] ?? `Hello ${safeName}, thank you for your message. Our team will review it.`;
}

export class WhatsappSimulatorService {
  async receive(organizationId: string, userId: string, input: WhatsappSimulatorInput) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { id: input.connectorId, organizationId, type: "WHATSAPP", status: "ACTIVE", deletedAt: null },
    });
    if (!connector) throw new AppError(404, "Active WhatsApp connector was not found.", "CONNECTOR_NOT_FOUND");
    const configuration = connector.configuration as ConnectorConfiguration;
    if (!configuration.simulator && connector.provider.toUpperCase() !== "B2BRAIN_SIMULATOR")
      throw new AppError(409, "This endpoint only accepts simulator connectors.", "SIMULATOR_CONNECTOR_REQUIRED");

    const duplicate = await prisma.integrationEvent.findFirst({
      where: { organizationId, connectorId: connector.id, externalEventId: input.externalMessageId },
      select: { id: true, status: true, resultId: true },
    });
    if (duplicate) return { duplicate: true, eventId: duplicate.id, inquiryId: duplicate.resultId, status: duplicate.status };

    const phone = normalizeWhatsappPhone(input.from);
    const [customers, openInquiries, owner] = await Promise.all([
      prisma.customer.findMany({ where: { organizationId, phone: { not: null }, deletedAt: null }, select: { id: true, phone: true } }),
      prisma.inquiry.findMany({ where: { organizationId, source: "WHATSAPP", phone: { not: null }, deletedAt: null, status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] } }, select: { id: true, phone: true, assignedEmployee: { select: { linkedUserId: true } } }, orderBy: { updatedAt: "desc" } }),
      prisma.organizationMembership.findFirst({ where: { organizationId, status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null }, role: { code: "ORGANIZATION_OWNER" } }, select: { userId: true } }),
    ]);
    if (!owner) throw new AppError(409, "No active organization owner is available.", "OWNER_NOT_FOUND");
    const matched = customers.find((item) => item.phone && normalizeWhatsappPhone(item.phone) === phone);
    const existingInquiry = openInquiries.find((item) => item.phone && normalizeWhatsappPhone(item.phone) === phone);
    const classification = classifyWhatsappMessage(input.message);
    const takeover = existingInquiry ? (configuration.humanTakeoverInquiryIds ?? []).includes(existingInquiry.id) : false;
    const occurredAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const payload = { phone, contactName: input.contactName, message: input.message, receivedAt: occurredAt.toISOString(), simulator: true };
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return prisma.$transaction(async (tx) => {
      const customer = matched ?? await tx.customer.create({ data: { organizationId, type: "PERSON", displayName: input.contactName, firstName: input.contactName, phone, status: "LEAD", notes: "Created by WhatsApp CRM Intake Simulator", createdById: userId, updatedById: userId }, select: { id: true } });
      const inquiry = existingInquiry
        ? await tx.inquiry.update({ where: { id: existingInquiry.id }, data: { customerId: customer.id, type: classification, message: input.message, priority: classification === "COMPLAINT" ? "HIGH" : "MEDIUM", status: classification === "SPAM" ? "SPAM" : "REVIEWING", ...(needsHuman(classification) ? { nextFollowUpAt: new Date(Date.now() + 60 * 60_000) } : {}), updatedById: userId } })
        : await tx.inquiry.create({ data: { organizationId, customerId: customer.id, source: "WHATSAPP", type: classification, status: classification === "SPAM" ? "SPAM" : "NEW", priority: classification === "COMPLAINT" ? "HIGH" : "MEDIUM", contactName: input.contactName, phone, subject: `WhatsApp: ${classification.replaceAll("_", " ")}`, message: input.message, nextFollowUpAt: needsHuman(classification) ? new Date(Date.now() + 60 * 60_000) : null, followUpNote: needsHuman(classification) ? "Human review required for WhatsApp inquiry." : null, createdById: userId, updatedById: userId } });
      const event = await tx.integrationEvent.create({ data: { organizationId, connectorId: connector.id, externalEventId: input.externalMessageId, eventName: "whatsapp.simulator.message.received", kind: classification === "SPAM" ? "SPAM" : classification === "COMPLAINT" ? "COMPLAINT" : classification === "ORDER_REQUEST" ? "ORDER_REQUEST" : classification === "SUPPORT" ? "SUPPORT_REQUEST" : classification === "SALES" ? "SALES_OPPORTUNITY" : "INQUIRY", status: "COMPLETED", signatureVerified: true, payload: payload as Prisma.InputJsonValue, payloadHash, attemptCount: 1, processedAt: new Date(), resultType: "INQUIRY", resultId: inquiry.id, createdById: userId, updatedById: userId } });
      await tx.inquiryTimeline.create({ data: { organizationId, inquiryId: inquiry.id, type: "CLASSIFIED", summary: `WhatsApp message classified as ${classification}`, details: input.message, createdById: userId } });
      await tx.customerActivity.create({ data: { organizationId, customerId: customer.id, type: "WHATSAPP", summary: "Incoming WhatsApp simulator message", details: input.message, occurredAt, createdById: userId, updatedById: userId } });
      const recipientId = existingInquiry?.assignedEmployee?.linkedUserId ?? owner.userId;
      if (needsHuman(classification)) await tx.customerFollowUp.create({ data: { organizationId, customerId: customer.id, title: `Review ${classification.replaceAll("_", " ").toLowerCase()} inquiry`, description: input.message, dueAt: new Date(Date.now() + 60 * 60_000), assignedToId: recipientId, createdById: userId, updatedById: userId } });
      let draftId: string | null = null;
      if (classification !== "SPAM" && !takeover) {
        const body = replyFor(input.contactName, classification);
        const draft = await tx.automationMessageDraft.create({ data: { organizationId, connectorId: connector.id, eventId: event.id, recipient: phone, body, sourceType: "WHATSAPP_SIMULATOR", sourceId: inquiry.id, status: "PENDING_APPROVAL", providerStatus: "SIMULATED_NOT_SENDABLE", createdById: userId, updatedById: userId } });
        draftId = draft.id;
        await tx.approvalRequest.create({ data: { organizationId, serviceCode: "AUTOMATION", actionCode: "WHATSAPP_REPLY", title: `Review WhatsApp reply for ${input.contactName}`, description: body, riskLevel: highRisk(input.message, classification) ? "HIGH" : "MEDIUM", sourceType: "WHATSAPP_MESSAGE_DRAFT", sourceId: draft.id, requestedById: userId, context: { simulator: true, inquiryId: inquiry.id, classification, noExternalSend: true } } });
      }
      await tx.notification.upsert({ where: { organizationId_recipientId_sourceType_sourceId: { organizationId, recipientId, sourceType: "WHATSAPP_INQUIRY", sourceId: inquiry.id } }, update: { title: `WhatsApp ${classification.replaceAll("_", " ").toLowerCase()}`, message: takeover ? "Human takeover is active; no automated reply was drafted." : "A new message and approval draft require review.", readAt: null, deletedAt: null, updatedById: userId }, create: { organizationId, recipientId, type: "APPROVAL_REQUIRED", title: `WhatsApp ${classification.replaceAll("_", " ").toLowerCase()}`, message: takeover ? "Human takeover is active; no automated reply was drafted." : "A new message and approval draft require review.", sourceType: "WHATSAPP_INQUIRY", sourceId: inquiry.id, actionPath: "/dashboard?view=automation", createdById: userId, updatedById: userId } });
      await tx.integrationConnector.update({ where: { id: connector.id }, data: { lastReceivedAt: new Date(), lastSuccessfulAt: new Date(), updatedById: userId } });
      return { duplicate: false, eventId: event.id, customerId: customer.id, customerCreated: !matched, inquiryId: inquiry.id, inquiryUpdated: Boolean(existingInquiry), classification, humanAttentionRequired: needsHuman(classification), humanTakeover: takeover, draftId };
    });
  }

  async takeover(organizationId: string, userId: string, connectorId: string, input: WhatsappTakeoverInput) {
    const [connector, inquiry] = await Promise.all([
      prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId, type: "WHATSAPP", deletedAt: null } }),
      prisma.inquiry.findFirst({ where: { id: input.inquiryId, organizationId, source: "WHATSAPP", deletedAt: null }, select: { id: true } }),
    ]);
    if (!connector || !inquiry) throw new AppError(404, "WhatsApp conversation was not found.", "CONVERSATION_NOT_FOUND");
    const configuration = connector.configuration as ConnectorConfiguration;
    const ids = new Set(configuration.humanTakeoverInquiryIds ?? []);
    if (input.enabled) ids.add(inquiry.id);
    else ids.delete(inquiry.id);
    await prisma.$transaction([
      prisma.integrationConnector.update({ where: { id: connector.id }, data: { configuration: { ...configuration, humanTakeoverInquiryIds: [...ids] }, updatedById: userId } }),
      prisma.inquiryTimeline.create({ data: { organizationId, inquiryId: inquiry.id, type: "NOTE", summary: input.enabled ? "Human takeover enabled" : "Automation resumed", details: input.reason, createdById: userId } }),
      ...(input.enabled ? [prisma.automationMessageDraft.updateMany({ where: { organizationId, connectorId, sourceId: inquiry.id, status: "PENDING_APPROVAL" }, data: { status: "CANCELED", failureMessage: "Canceled because human takeover was enabled.", updatedById: userId } })] : []),
    ]);
    return { inquiryId: inquiry.id, humanTakeover: input.enabled };
  }
}
