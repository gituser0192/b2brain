import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../database/prisma.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { EnquiryAgentService, enforceAgentPolicy, inquiryTypeForAgentIntent } from "../../enquiry-agent/enquiry-agent.service.js";
import { inboundProcessingResultSchema, type InboundProcessingResult, type NormalizedInboundEvent } from "../contracts/inbound-event.contract.js";

type AgentResult = Awaited<ReturnType<EnquiryAgentService["process"]>>;

export class InboundEventProcessor {
  constructor(private readonly agent = new EnquiryAgentService()) {}

  async processAuthenticatedSimulator(organizationId: string, userId: string, event: NormalizedInboundEvent) {
    if (event.channel !== "SIMULATOR" || event.eventType !== "CUSTOMER_MESSAGE")
      throw new AppError(400, "This adapter accepts simulator customer messages only.", "UNSUPPORTED_INBOUND_EVENT");

    const connector = await prisma.integrationConnector.findFirst({
      where: { id: event.connectorId, organizationId, type: "WHATSAPP", status: "ACTIVE", deletedAt: null },
      select: { id: true, provider: true, configuration: true },
    });
    if (!connector) throw new AppError(404, "Active simulator connector was not found.", "CONNECTOR_NOT_FOUND");
    const configuration = connector.configuration as { simulator?: boolean };
    if (!configuration.simulator && connector.provider.toUpperCase() !== "B2BRAIN_SIMULATOR")
      throw new AppError(409, "This endpoint only accepts simulator connectors.", "SIMULATOR_CONNECTOR_REQUIRED");

    const duplicate = await prisma.integrationEvent.findFirst({
      where: { organizationId, connectorId: connector.id, externalEventId: event.externalEventId },
      select: { id: true, status: true, resultId: true, traceId: true },
    });
    if (duplicate) {
      if (["RECEIVED", "VERIFIED", "PROCESSING"].includes(duplicate.status))
        throw new AppError(409, "This event is already being processed.", "EVENT_PROCESSING");
      return this.duplicateResult(duplicate, event.correlationId);
    }

    try {
      const result = await this.agent.process(organizationId, userId, {
        channel: "WHATSAPP",
        externalMessageId: event.externalEventId,
        conversationId: event.correlationId,
        customerName: event.sender.name,
        phone: event.sender.phone,
        email: event.sender.email,
        message: event.content.text,
        receivedAt: event.receivedAt,
        metadata: { ...event.metadata, simulator: true, inboundContractVersion: event.version, inboundChannel: event.channel },
      }, { connectorId: connector.id, source: "SIMULATOR" });
      return this.result(result, event.correlationId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await prisma.integrationEvent.findFirst({
          where: { organizationId, connectorId: connector.id, externalEventId: event.externalEventId },
          select: { id: true, status: true, resultId: true, traceId: true },
        });
        if (concurrent) return this.duplicateResult(concurrent, event.correlationId);
      }
      await prisma.auditEvent.create({
        data: {
          organizationId,
          actorType: "USER",
          actorUserId: userId,
          serviceCode: "AUTOMATION",
          actionCode: "INBOUND_EVENT_FAILED",
          sourceType: "INTEGRATION_CONNECTOR",
          sourceId: connector.id,
          summary: "A normalized simulator event failed before its atomic CRM transaction completed.",
          metadata: { externalEventIdHash: createHash("sha256").update(event.externalEventId).digest("hex"), correlationId: event.correlationId, retrySafe: true },
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  private duplicateResult(event: { id: string; status: string; resultId: string | null }, correlationId: string): InboundProcessingResult {
    return {
      version: "1", eventId: event.id, processingStatus: event.status === "COMPLETED" ? "COMPLETED" : event.status === "FAILED" ? "FAILED" : "PROCESSING",
      duplicate: true, correlationId, customerId: null, inquiryId: event.resultId, followUpId: null, classification: null, confidence: null,
      safeActionsExecuted: [], actionsAwaitingApproval: [], draftResponse: null, humanReviewRequired: event.status === "FAILED", externalActionPerformed: false,
    };
  }

  private result(result: AgentResult, correlationId: string) {
    if (!("analysis" in result)) return { ...this.duplicateResult({ id: result.eventId, status: result.status, resultId: result.inquiryId }, correlationId), ...result };
    const policy = enforceAgentPolicy(result.analysis.intent, result.analysis.confidence, result.analysis.promptInjectionDetected);
    const normalized = inboundProcessingResultSchema.parse({
      version: "1", eventId: result.eventId, processingStatus: "COMPLETED", duplicate: false, correlationId,
      customerId: result.customer?.id ?? null, inquiryId: result.inquiryId, followUpId: result.followUpId ?? null,
      classification: inquiryTypeForAgentIntent(result.analysis.intent), confidence: result.analysis.confidence,
      safeActionsExecuted: result.tools, actionsAwaitingApproval: result.approvalRequired ? ["REVIEW_REPLY_DRAFT"] : [],
      draftResponse: result.response, humanReviewRequired: policy.followUpRequired || result.approvalRequired || result.humanTakeover,
      externalActionPerformed: false,
    });
    return { ...result, ...normalized, customerName: result.customer?.displayName ?? null, classification: normalized.classification, humanAttentionRequired: normalized.humanReviewRequired, inquiryUpdated: !result.customerCreated };
  }
}
