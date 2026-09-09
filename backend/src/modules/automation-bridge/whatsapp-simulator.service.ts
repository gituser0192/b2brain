import { createHash } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { WhatsappSimulatorInput, WhatsappTakeoverInput } from "./bridge.validation.js";
import { normalizedInboundEventSchema } from "./contracts/inbound-event.contract.js";
import { InboundEventProcessor } from "./processing/inbound-event.processor.js";

type ConnectorConfiguration = { simulator?: boolean; humanTakeoverInquiryIds?: string[] };

export function normalizeWhatsappPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function stableWhatsappConversationId(connectorId: string, phone: string) {
  const hex = createHash("sha256").update(`${connectorId}:${phone}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export class WhatsappSimulatorService {
  constructor(private readonly processor = new InboundEventProcessor()) {}

  async receive(organizationId: string, userId: string, input: WhatsappSimulatorInput) {
    const phone = normalizeWhatsappPhone(input.from);
    const receivedAt = input.receivedAt ?? new Date().toISOString();
    const event = normalizedInboundEventSchema.parse({
      version: "1",
      channel: "SIMULATOR",
      eventType: "CUSTOMER_MESSAGE",
      externalEventId: input.externalMessageId,
      occurredAt: receivedAt,
      receivedAt: new Date().toISOString(),
      connectorId: input.connectorId,
      sender: { name: input.contactName, phone },
      content: { text: input.message },
      metadata: { simulator: true },
      correlationId: stableWhatsappConversationId(input.connectorId, phone),
    });
    return this.processor.processAuthenticatedSimulator(organizationId, userId, event);
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
