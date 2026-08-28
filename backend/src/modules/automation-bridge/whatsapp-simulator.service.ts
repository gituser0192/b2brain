import { createHash } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { EnquiryAgentService, enforceAgentPolicy, inquiryTypeForAgentIntent } from "../enquiry-agent/enquiry-agent.service.js";
import type { WhatsappSimulatorInput, WhatsappTakeoverInput } from "./bridge.validation.js";

type ConnectorConfiguration = { simulator?: boolean; humanTakeoverInquiryIds?: string[] };

export function normalizeWhatsappPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function stableConversationId(connectorId: string, phone: string) {
  const hex = createHash("sha256").update(`${connectorId}:${phone}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export class WhatsappSimulatorService {
  constructor(private readonly agent = new EnquiryAgentService()) {}

  async receive(organizationId: string, userId: string, input: WhatsappSimulatorInput) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { id: input.connectorId, organizationId, type: "WHATSAPP", status: "ACTIVE", deletedAt: null },
      select: { id: true, provider: true, configuration: true },
    });
    if (!connector) throw new AppError(404, "Active WhatsApp connector was not found.", "CONNECTOR_NOT_FOUND");
    const configuration = connector.configuration as ConnectorConfiguration;
    if (!configuration.simulator && connector.provider.toUpperCase() !== "B2BRAIN_SIMULATOR")
      throw new AppError(409, "This endpoint only accepts simulator connectors.", "SIMULATOR_CONNECTOR_REQUIRED");

    const phone = normalizeWhatsappPhone(input.from);
    const result = await this.agent.process(organizationId, userId, {
      channel: "WHATSAPP",
      externalMessageId: input.externalMessageId,
      conversationId: stableConversationId(connector.id, phone),
      customerName: input.contactName,
      phone,
      message: input.message,
      receivedAt: input.receivedAt,
      metadata: { simulator: true },
    }, { connectorId: connector.id });

    if (!("analysis" in result)) return result;
    const classification = inquiryTypeForAgentIntent(result.analysis.intent);
    const policy = enforceAgentPolicy(result.analysis.intent, result.analysis.confidence, result.analysis.promptInjectionDetected);
    return {
      ...result,
      customerId: result.customer?.id ?? null,
      customerName: result.customer?.displayName ?? null,
      classification,
      humanAttentionRequired: policy.followUpRequired || result.approvalRequired,
      inquiryUpdated: !result.customerCreated,
    };
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
