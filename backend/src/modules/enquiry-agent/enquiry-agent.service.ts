import { createHash, randomBytes } from "node:crypto";
import { Prisma, type InquiryType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { BusinessKnowledgeService } from "../business-knowledge/business-knowledge.service.js";
import {
  createEnquiryAgentProvider,
  detectsPromptInjection,
  DeterministicEnquiryAgentProvider,
  type AgentToolAction,
  type EnquiryAgentProvider,
} from "./enquiry-agent.provider.js";
import type {
  AgentDraftDecision,
  HumanTakeoverInput,
  NormalizedInboundMessage,
} from "./enquiry-agent.validation.js";

type InternalConfiguration = {
  humanTakeoverConversationIds?: string[];
  humanTakeoverInquiryIds?: string[];
  conversationReadAt?: Record<string, string>;
  simulator?: boolean;
};
const inquiryType: Record<string, InquiryType> = {
  SALES_ENQUIRY: "SALES",
  SERVICE_PRICING: "PRODUCT_QUESTION",
  CUSTOMER_REQUIREMENT: "SALES",
  FOLLOW_UP_REQUEST: "SALES",
  SUPPORT_REQUEST: "SUPPORT",
  COMPLAINT: "COMPLAINT",
  REFUND_PAYMENT: "SUPPORT",
  SPAM: "SPAM",
  UNKNOWN: "UNCLASSIFIED",
  GREETING: "UNCLASSIFIED",
};
export const inquiryTypeForAgentIntent = (intent: string): InquiryType =>
  inquiryType[intent] ?? "UNCLASSIFIED";
const humanOnly = new Set(["REFUND_PAYMENT"]);
const approvalRequired = new Set(["SERVICE_PRICING", "COMPLAINT", "UNKNOWN"]);
const requiresFollowUp = new Set([
  "CUSTOMER_REQUIREMENT",
  "FOLLOW_UP_REQUEST",
  "SUPPORT_REQUEST",
  "COMPLAINT",
  "REFUND_PAYMENT",
  "UNKNOWN",
]);
export function enforceAgentPolicy(
  intent: string,
  confidence: number,
  promptInjectionDetected: boolean,
) {
  const missingKnowledge = intent === "SERVICE_PRICING";
  const humanOnlyAction = humanOnly.has(intent);
  const unsafe =
    humanOnlyAction || promptInjectionDetected || confidence < 0.65;
  return {
    missingKnowledge,
    humanOnlyAction,
    unsafe,
    needsApproval:
      !unsafe && (approvalRequired.has(intent) || missingKnowledge),
    followUpRequired: requiresFollowUp.has(intent) || unsafe,
  };
}
export function validateProposedAgentTools(
  requested: AgentToolAction[],
  context: {
    hasPhone: boolean;
    customerExists: boolean;
    followUpRequired: boolean;
  },
) {
  const allowed = new Set<AgentToolAction>([
    "FIND_CUSTOMER",
    ...(context.hasPhone && !context.customerExists
      ? ["CREATE_CUSTOMER" as const]
      : []),
    "ADD_CUSTOMER_ACTIVITY",
    "CREATE_OR_UPDATE_ENQUIRY",
    ...(context.followUpRequired
      ? ["CREATE_FOLLOW_UP" as const, "REQUEST_HUMAN_TAKEOVER" as const]
      : []),
  ]);
  return requested.filter((tool) => allowed.has(tool));
}
const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

export class EnquiryAgentService {
  constructor(
    private readonly provider: EnquiryAgentProvider = createEnquiryAgentProvider(),
    private readonly knowledge = new BusinessKnowledgeService(),
  ) {}
  status() {
    return {
      provider: this.provider.name,
      realAiConfigured: this.provider.productionModel,
      killSwitchActive: this.provider.killSwitchActive,
      mode: this.provider.productionModel
        ? "REAL_AI"
        : "DETERMINISTIC_FALLBACK",
      dailyRequestLimit: env.ENQUIRY_AI_DAILY_REQUEST_LIMIT,
    };
  }
  private async connector(
    organizationId: string,
    userId: string,
    connectorId?: string,
    source: "SIMULATOR" | "META" = "SIMULATOR",
  ) {
    if (connectorId) {
      const selected = await prisma.integrationConnector.findFirst({
        where: {
          id: connectorId,
          organizationId,
          type: "WHATSAPP",
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      if (!selected)
        throw new AppError(
          404,
          "Active WhatsApp connector was not found.",
          "CONNECTOR_NOT_FOUND",
        );
      const configuration = selected.configuration as InternalConfiguration;
      const simulator =
        configuration.simulator ||
        selected.provider.toUpperCase() === "B2BRAIN_SIMULATOR";
      const meta = selected.provider.toUpperCase() === "META_WHATSAPP_CLOUD";
      if (
        (source === "SIMULATOR" && !simulator) ||
        (source === "META" && !meta)
      )
        throw new AppError(
          409,
          "This endpoint only accepts simulator connectors.",
          "SIMULATOR_CONNECTOR_REQUIRED",
        );
      return selected;
    }
    const existing = await prisma.integrationConnector.findFirst({
      where: {
        organizationId,
        provider: "B2BRAIN_AGENT_PLAYGROUND",
        deletedAt: null,
      },
    });
    if (existing) return existing;
    const secret = randomBytes(24).toString("hex");
    return prisma.integrationConnector.create({
      data: {
        organizationId,
        name: "Internal Agent Playground",
        type: "WEBSITE",
        status: "ACTIVE",
        mode: "ASSISTED",
        provider: "B2BRAIN_AGENT_PLAYGROUND",
        configuration: {},
        signingSecretHash: createHash("sha256").update(secret).digest("hex"),
        createdById: userId,
        updatedById: userId,
      },
    });
  }
  async process(
    organizationId: string,
    userId: string,
    input: NormalizedInboundMessage,
    options: {
      connectorId?: string;
      source?: "SIMULATOR" | "META";
      forceApproval?: boolean;
    } = {},
  ) {
    const connector = await this.connector(
      organizationId,
      userId,
      options.connectorId,
      options.source,
    );
    const duplicate = await prisma.integrationEvent.findFirst({
      where: {
        organizationId,
        connectorId: connector.id,
        externalEventId: input.externalMessageId,
      },
      select: { id: true, resultId: true, status: true, payload: true },
    });
    if (duplicate)
      return {
        duplicate: true,
        eventId: duplicate.id,
        inquiryId: duplicate.resultId,
        status: duplicate.status,
      };
    const configuration = connector.configuration as InternalConfiguration;
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [organization, customers, openInquiries, owner, aiRequestsToday] =
      await Promise.all([
        prisma.organization.findFirst({
          where: { id: organizationId, status: "ACTIVE", deletedAt: null },
          select: { id: true, name: true },
        }),
        phone
          ? prisma.customer.findMany({
              where: { organizationId, phone: { not: null }, deletedAt: null },
              select: { id: true, phone: true, displayName: true },
            })
          : [],
        phone
          ? prisma.inquiry.findMany({
              where: {
                organizationId,
                phone: { not: null },
                deletedAt: null,
                status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] },
              },
              select: {
                id: true,
                phone: true,
                assignedEmployee: { select: { linkedUserId: true } },
              },
              orderBy: { updatedAt: "desc" },
            })
          : [],
        prisma.organizationMembership.findFirst({
          where: {
            organizationId,
            status: "ACTIVE",
            role: { code: "ORGANIZATION_OWNER" },
            user: { status: "ACTIVE", deletedAt: null },
          },
          select: { userId: true },
        }),
        this.provider.productionModel
          ? prisma.integrationEvent.count({
              where: {
                organizationId,
                eventName: "enquiry-agent.message.received",
                createdAt: { gte: startOfDay },
              },
            })
          : Promise.resolve(0),
      ]);
    if (!organization || !owner)
      throw new AppError(
        403,
        "The active organization context is unavailable.",
        "ORGANIZATION_INACTIVE",
      );
    const usageLimitReached =
      this.provider.productionModel &&
      aiRequestsToday >= env.ENQUIRY_AI_DAILY_REQUEST_LIMIT;
    const selectedProvider = usageLimitReached
      ? new DeterministicEnquiryAgentProvider()
      : this.provider;
    const storedKnowledge =
      await this.knowledge.approvedForAgent(organizationId);
    const approvedKnowledge = [
      {
        id: "organization.approved_public_identity",
        title: "Business name",
        category: "BUSINESS_OVERVIEW",
        content: `Public business name: ${organization.name}`,
        updatedAt: null,
      },
      ...storedKnowledge
        .filter(
          (item) => !detectsPromptInjection(`${item.title} ${item.content}`),
        )
        .map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
    ];
    let analysis;
    try {
      analysis = await selectedProvider.analyze({
        message: input.message,
        approvedKnowledge,
      });
    } catch {
      analysis = await new DeterministicEnquiryAgentProvider().analyze({
        message: input.message,
        approvedKnowledge,
      });
    }
    const customer = customers.find(
      (item) => item.phone && normalizePhone(item.phone) === phone,
    );
    const existingInquiry = openInquiries.find(
      (item) => item.phone && normalizePhone(item.phone) === phone,
    );
    const takeover =
      (configuration.humanTakeoverConversationIds ?? []).includes(
        input.conversationId,
      ) ||
      Boolean(
        existingInquiry &&
        (configuration.humanTakeoverInquiryIds ?? []).includes(
          existingInquiry.id,
        ),
      );
    const policy = enforceAgentPolicy(
        analysis.intent,
        analysis.confidence,
        analysis.promptInjectionDetected,
      ),
      modelNeedsEscalation =
        analysis.missingInformation.length > 0 ||
        Boolean(analysis.escalationReason);
    let sources = approvedKnowledge
      .filter((item) => analysis.knowledgeReferences.includes(item.id))
      .map(({ id, title, category, updatedAt }) => ({
        id,
        title,
        category,
        updatedAt,
      }));
    const missingKnowledge =
      policy.missingKnowledge &&
      !sources.some((source) => source.category === "PRICING");
    const { unsafe } = policy,
      needsApproval =
        policy.needsApproval ||
        modelNeedsEscalation ||
        Boolean(options.forceApproval),
      followUpRequired = policy.followUpRequired || modelNeedsEscalation;
    const safeFallbackReply = unsafe
      ? "I cannot complete this request automatically. A human team member has been notified."
      : missingKnowledge || modelNeedsEscalation
        ? "I need confirmation from the business team before providing pricing, availability, discounts or commitments."
        : analysis.intent === "GREETING"
          ? `Hello! You are speaking with ${organization.name}. How can we help you today?`
          : analysis.intent === "SALES_ENQUIRY"
            ? `Thank you for contacting ${organization.name}. Please share your requirement and the business team will confirm the suitable services.`
            : `Thank you for contacting ${organization.name}. Your ${analysis.intent.toLowerCase().replaceAll("_", " ")} has been recorded for review.`;
    if (
      sources.length === 0 &&
      !unsafe &&
      !modelNeedsEscalation &&
      ["GREETING", "SALES_ENQUIRY"].includes(analysis.intent)
    ) {
      const identity = approvedKnowledge[0];
      if (identity) {
        sources = [
          {
            id: identity.id,
            title: identity.title,
            category: identity.category,
            updatedAt: identity.updatedAt,
          },
        ];
      }
    }
    const response =
      !unsafe &&
      !missingKnowledge &&
      !modelNeedsEscalation &&
      sources.length > 0 &&
      analysis.customerFacingReply
        ? analysis.customerFacingReply
        : safeFallbackReply;
    const actor =
      existingInquiry?.assignedEmployee?.linkedUserId ?? owner.userId;
    const payload = {
      channel: input.channel,
      conversationId: input.conversationId,
      customerName: input.customerName,
      phone,
      message: input.message,
      receivedAt: input.receivedAt ?? new Date().toISOString(),
      metadata: input.metadata,
      analysis,
      knowledgeSources: sources,
      provider: {
        name: analysis.providerName,
        source: analysis.source,
        model: analysis.model,
        usage: analysis.usage,
        usageLimitReached,
      },
    };
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    return prisma.$transaction(async (tx) => {
      const crmCustomer =
        customer ??
        (phone
          ? await tx.customer.create({
              data: {
                organizationId,
                type: "PERSON",
                displayName: input.customerName ?? phone,
                ...(input.customerName
                  ? { firstName: input.customerName }
                  : {}),
                phone,
                status: "LEAD",
                notes: "Created by Sales and Customer Enquiry Agent",
                createdById: userId,
                updatedById: userId,
              },
              select: { id: true, displayName: true },
            })
          : null);
      const event = await tx.integrationEvent.create({
        data: {
          organizationId,
          connectorId: connector.id,
          externalEventId: input.externalMessageId,
          eventName: "enquiry-agent.message.received",
          kind:
            analysis.intent === "SPAM"
              ? "SPAM"
              : analysis.intent === "COMPLAINT"
                ? "COMPLAINT"
                : analysis.intent === "REFUND_PAYMENT" ||
                    analysis.intent === "SUPPORT_REQUEST"
                  ? "SUPPORT_REQUEST"
                  : "INQUIRY",
          status: "COMPLETED",
          signatureVerified: true,
          payload: payload as Prisma.InputJsonValue,
          payloadHash,
          attemptCount: 1,
          processedAt: new Date(),
          createdById: userId,
          updatedById: userId,
        },
      });
      const inquiry = existingInquiry
        ? await tx.inquiry.update({
            where: { id: existingInquiry.id },
            data: {
              ...(crmCustomer ? { customerId: crmCustomer.id } : {}),
              type: inquiryType[analysis.intent] ?? "UNCLASSIFIED",
              message: input.message,
              status: analysis.intent === "SPAM" ? "SPAM" : "REVIEWING",
              updatedById: userId,
            },
          })
        : await tx.inquiry.create({
            data: {
              organizationId,
              customerId: crmCustomer?.id ?? null,
              source: input.channel === "WHATSAPP" ? "WHATSAPP" : "WEBSITE",
              type: inquiryType[analysis.intent] ?? "UNCLASSIFIED",
              status: analysis.intent === "SPAM" ? "SPAM" : "NEW",
              priority:
                unsafe || analysis.intent === "COMPLAINT" ? "HIGH" : "MEDIUM",
              contactName: input.customerName ?? phone ?? "Website visitor",
              phone,
              subject: `Agent: ${analysis.intent.replaceAll("_", " ")}`,
              message: input.message,
              nextFollowUpAt:
                requiresFollowUp.has(analysis.intent) || unsafe
                  ? new Date(Date.now() + 60 * 60_000)
                  : null,
              followUpNote: unsafe ? "Human-only or unclear request." : null,
              createdById: userId,
              updatedById: userId,
            },
          });
      await tx.integrationEvent.update({
        where: { id: event.id },
        data: { resultType: "INQUIRY", resultId: inquiry.id },
      });
      await tx.inquiryTimeline.create({
        data: {
          organizationId,
          inquiryId: inquiry.id,
          type: "CLASSIFIED",
          summary: `${analysis.intent} (${Math.round(analysis.confidence * 100)}% confidence)`,
          details: input.message,
          createdById: userId,
        },
      });
      if (crmCustomer)
        await tx.customerActivity.create({
          data: {
            organizationId,
            customerId: crmCustomer.id,
            type: input.channel === "WHATSAPP" ? "WHATSAPP" : "NOTE",
            summary: `Inbound ${input.channel.toLowerCase().replaceAll("_", " ")} message`,
            details: input.message,
            createdById: userId,
            updatedById: userId,
          },
        });
      const proposedTools = validateProposedAgentTools(
        analysis.requestedToolActions,
        {
          hasPhone: Boolean(phone),
          customerExists: Boolean(customer),
          followUpRequired,
        },
      );
      const tools = [
        customer
          ? "find_customer"
          : crmCustomer
            ? "create_customer"
            : "find_customer",
        "add_customer_activity",
        existingInquiry
          ? "create_or_update_enquiry:update"
          : "create_or_update_enquiry:create",
        ...(sources.length ? ["search_approved_business_knowledge"] : []),
        ...(followUpRequired
          ? ["create_follow_up", "request_human_takeover"]
          : []),
      ];
      if (crmCustomer && followUpRequired)
        await tx.customerFollowUp.create({
          data: {
            organizationId,
            customerId: crmCustomer.id,
            title: `Agent handoff: ${analysis.intent.replaceAll("_", " ")}`,
            description: input.message,
            dueAt: new Date(Date.now() + 60 * 60_000),
            assignedToId: actor,
            createdById: userId,
            updatedById: userId,
          },
        });
      let draftId: string | null = null,
        approvalId: string | null = null;
      if (analysis.intent !== "SPAM" && !takeover) {
        const draft = await tx.automationMessageDraft.create({
          data: {
            organizationId,
            connectorId: connector.id,
            eventId: event.id,
            recipient: phone ?? `conversation:${input.conversationId}`,
            body: response,
            sourceType: "ENQUIRY_AGENT",
            sourceId: inquiry.id,
            status: needsApproval || unsafe ? "PENDING_APPROVAL" : "APPROVED",
            providerStatus:
              options.source === "META"
                ? "META_PENDING_SEND"
                : options.connectorId
                  ? "SIMULATED_NOT_SENDABLE"
                  : "INTERNAL_PLAYGROUND_ONLY",
            createdById: userId,
            updatedById: userId,
          },
        });
        draftId = draft.id;
        if (needsApproval || unsafe) {
          const approval = await tx.approvalRequest.create({
            data: {
              organizationId,
              serviceCode: "AUTOMATION",
              actionCode: "ENQUIRY_AGENT_RESPONSE",
              title: `Review agent response: ${analysis.intent.replaceAll("_", " ")}`,
              description: response,
              riskLevel: unsafe ? "HIGH" : "MEDIUM",
              sourceType: "ENQUIRY_AGENT_DRAFT",
              sourceId: draft.id,
              requestedById: userId,
              context: {
                conversationId: input.conversationId,
                inquiryId: inquiry.id,
                intent: analysis.intent,
                humanOnly: humanOnly.has(analysis.intent),
                externalDeliveryPerformed: false,
              },
            },
          });
          approvalId = approval.id;
        }
      }
      if (followUpRequired || needsApproval)
        await tx.notification.upsert({
          where: {
            organizationId_recipientId_sourceType_sourceId: {
              organizationId,
              recipientId: actor,
              sourceType: "ENQUIRY_AGENT",
              sourceId: inquiry.id,
            },
          },
          update: {
            title: `Agent review: ${analysis.intent}`,
            message: input.message,
            readAt: null,
            deletedAt: null,
            updatedById: userId,
          },
          create: {
            organizationId,
            recipientId: actor,
            type:
              needsApproval || unsafe ? "APPROVAL_REQUIRED" : "FOLLOW_UP_DUE",
            title: `Agent review: ${analysis.intent}`,
            message: input.message,
            sourceType: "ENQUIRY_AGENT",
            sourceId: inquiry.id,
            actionPath: "/dashboard?view=agent-playground",
            createdById: userId,
            updatedById: userId,
          },
        });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorType: "AI_AGENT",
          actorUserId: userId,
          serviceCode: "AUTOMATION",
          actionCode: "ENQUIRY_MESSAGE_PROCESSED",
          sourceType: "INTEGRATION_EVENT",
          sourceId: event.id,
          summary: `${analysis.intent} processed by ${analysis.providerName}.`,
          metadata: {
            tools,
            proposedTools,
            knowledgeSources: sources,
            providerSource: analysis.source,
            model: analysis.model,
            usage: analysis.usage,
            usageLimitReached,
            promptInjectionDetected: analysis.promptInjectionDetected,
            externalActionPerformed: false,
          },
        },
      });
      await tx.integrationConnector.update({
        where: { id: connector.id },
        data: {
          lastReceivedAt: new Date(),
          lastSuccessfulAt: new Date(),
          updatedById: userId,
        },
      });
      return {
        duplicate: false,
        eventId: event.id,
        conversationId: input.conversationId,
        customer: crmCustomer,
        customerCreated: Boolean(crmCustomer && !customer),
        inquiryId: inquiry.id,
        analysis,
        response,
        knowledgeSources: sources,
        proposedTools,
        tools,
        draftId,
        approvalId,
        approvalRequired: Boolean(approvalId),
        humanTakeover: takeover || unsafe,
        provider: {
          name: analysis.providerName,
          model: analysis.model,
          source: analysis.source,
          productionModel: analysis.source === "REAL_AI",
          killSwitchActive: this.provider.killSwitchActive,
          usage: analysis.usage,
          usageLimitReached,
        },
        externalActionPerformed: false,
      };
    });
  }
  async history(organizationId: string, conversationId: string) {
    const connector = await prisma.integrationConnector.findFirst({
      where: {
        organizationId,
        provider: "B2BRAIN_AGENT_PLAYGROUND",
        deletedAt: null,
      },
      select: { id: true, configuration: true },
    });
    if (!connector) return { messages: [], humanTakeover: false };
    const events = await prisma.integrationEvent.findMany({
      where: { organizationId, connectorId: connector.id },
      include: {
        messageDrafts: {
          include: {
            approvedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const matches = events
      .filter(
        (event) =>
          (event.payload as { conversationId?: string }).conversationId ===
          conversationId,
      )
      .reverse();
    const configuration = connector.configuration as InternalConfiguration;
    return {
      humanTakeover: (
        configuration.humanTakeoverConversationIds ?? []
      ).includes(conversationId),
      messages: matches.map((event) => {
        const payload = event.payload as {
          message?: string;
          analysis?: unknown;
          knowledgeSources?: unknown;
          provider?: unknown;
        };
        const draft = event.messageDrafts[0];
        return {
          eventId: event.id,
          externalMessageId: event.externalEventId,
          customerMessage: payload.message,
          analysis: payload.analysis,
          provider: payload.provider,
          knowledgeSources: payload.knowledgeSources,
          response: draft?.body ?? null,
          draftId: draft?.id ?? null,
          draftStatus: draft?.status ?? null,
          failureMessage: draft?.failureMessage ?? event.failureMessage,
          approvedBy: draft?.approvedBy
            ? `${draft.approvedBy.firstName} ${draft.approvedBy.lastName ?? ""}`.trim()
            : null,
          createdAt: event.createdAt,
        };
      }),
    };
  }
  async conversations(organizationId: string) {
    const connector = await prisma.integrationConnector.findFirst({
      where: {
        organizationId,
        provider: "B2BRAIN_AGENT_PLAYGROUND",
        deletedAt: null,
      },
      select: { id: true, configuration: true },
    });
    if (!connector) return [];
    const events = await prisma.integrationEvent.findMany({
      where: {
        organizationId,
        connectorId: connector.id,
        eventName: "enquiry-agent.message.received",
      },
      include: { messageDrafts: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const configuration = connector.configuration as InternalConfiguration;
    const takeoverIds = new Set(
      configuration.humanTakeoverConversationIds ?? [],
    );
    const readAt = configuration.conversationReadAt ?? {};
    const grouped = new Map<
      string,
      {
        conversationId: string;
        customerName: string;
        phone: string | null;
        lastMessage: string;
        intent: string;
        status:
          "NEW" | "WAITING_APPROVAL" | "HUMAN_TAKEOVER" | "RESOLVED" | "FAILED";
        unreadCount: number;
        updatedAt: Date;
        customerId: string | null;
        inquiryId: string | null;
      }
    >();
    for (const event of events) {
      const payload = event.payload as {
        conversationId?: string;
        customerName?: string | null;
        phone?: string | null;
        message?: string;
        analysis?: { intent?: string };
      };
      if (!payload.conversationId) continue;
      const existing = grouped.get(payload.conversationId);
      const draft = event.messageDrafts[0];
      const failed = event.status === "FAILED" || draft?.status === "FAILED";
      const waiting = draft?.status === "PENDING_APPROVAL";
      const takeover = takeoverIds.has(payload.conversationId);
      const status = failed
        ? "FAILED"
        : takeover
          ? "HUMAN_TAKEOVER"
          : waiting
            ? "WAITING_APPROVAL"
            : draft?.status === "APPROVED" || draft?.status === "CANCELED"
              ? "RESOLVED"
              : "NEW";
      const lastRead = readAt[payload.conversationId]
        ? new Date(readAt[payload.conversationId]!).getTime()
        : 0;
      if (!existing) {
        grouped.set(payload.conversationId, {
          conversationId: payload.conversationId,
          customerName: payload.customerName ?? payload.phone ?? "Customer",
          phone: payload.phone ?? null,
          lastMessage: payload.message ?? "Customer message",
          intent: payload.analysis?.intent ?? "UNKNOWN",
          status,
          unreadCount: event.createdAt.getTime() > lastRead ? 1 : 0,
          updatedAt: event.createdAt,
          customerId: null,
          inquiryId: event.resultId,
        });
      } else if (event.createdAt.getTime() > lastRead) {
        existing.unreadCount += 1;
      }
    }
    const values = [...grouped.values()];
    const inquiryIds = values.flatMap((item) =>
      item.inquiryId ? [item.inquiryId] : [],
    );
    const inquiries = await prisma.inquiry.findMany({
      where: { organizationId, id: { in: inquiryIds }, deletedAt: null },
      select: { id: true, customerId: true, status: true },
    });
    const byId = new Map(inquiries.map((item) => [item.id, item]));
    const customerIds = inquiries.flatMap((item) =>
      item.customerId ? [item.customerId] : [],
    );
    const followUps = await prisma.customerFollowUp.findMany({
      where: {
        organizationId,
        customerId: { in: customerIds },
        title: { startsWith: "Agent handoff:" },
        status: "PENDING",
      },
      select: { id: true, customerId: true },
      orderBy: { createdAt: "desc" },
    });
    const followUpByCustomer = new Map<string, string>();
    for (const followUp of followUps)
      if (!followUpByCustomer.has(followUp.customerId))
        followUpByCustomer.set(followUp.customerId, followUp.id);
    return values.map((item) => {
      const inquiry = item.inquiryId ? byId.get(item.inquiryId) : null;
      return {
        ...item,
        customerId: inquiry?.customerId ?? null,
        followUpId: inquiry?.customerId
          ? (followUpByCustomer.get(inquiry.customerId) ?? null)
          : null,
        status:
          inquiry &&
          ["CONVERTED", "DISQUALIFIED", "SPAM"].includes(inquiry.status)
            ? ("RESOLVED" as const)
            : item.status,
      };
    });
  }
  async markConversationRead(
    organizationId: string,
    userId: string,
    conversationId: string,
  ) {
    const connector = await this.connector(organizationId, userId);
    const configuration = connector.configuration as InternalConfiguration;
    const events = await prisma.integrationEvent.findMany({
      where: { organizationId, connectorId: connector.id },
      select: { payload: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const exists = events.some(
      (event) =>
        (event.payload as { conversationId?: string }).conversationId ===
        conversationId,
    );
    if (!exists)
      throw new AppError(
        404,
        "Conversation was not found.",
        "CONVERSATION_NOT_FOUND",
      );
    await prisma.integrationConnector.update({
      where: { id: connector.id },
      data: {
        configuration: {
          ...configuration,
          conversationReadAt: {
            ...(configuration.conversationReadAt ?? {}),
            [conversationId]: new Date().toISOString(),
          },
        },
        updatedById: userId,
      },
    });
    return { conversationId, unreadCount: 0 };
  }
  async decideDraft(
    organizationId: string,
    userId: string,
    id: string,
    input: AgentDraftDecision,
  ) {
    const draft = await prisma.automationMessageDraft.findFirst({
      where: {
        id,
        organizationId,
        sourceType: "ENQUIRY_AGENT",
        status: "PENDING_APPROVAL",
      },
    });
    if (!draft)
      throw new AppError(
        404,
        "Pending agent draft was not found.",
        "DRAFT_NOT_FOUND",
      );
    const approval = await prisma.approvalRequest.findFirst({
      where: {
        organizationId,
        sourceType: "ENQUIRY_AGENT_DRAFT",
        sourceId: id,
        status: "PENDING",
      },
      select: { requestedById: true },
    });
    if (!approval)
      throw new AppError(
        404,
        "Pending agent approval was not found.",
        "APPROVAL_NOT_FOUND",
      );
    if (approval.requestedById === userId)
      throw new AppError(
        403,
        "Another authorized user must decide this agent response.",
        "SEPARATION_OF_DUTIES_REQUIRED",
      );
    return prisma.$transaction(async (tx) => {
      const status = input.decision === "APPROVE" ? "APPROVED" : "CANCELED";
      const updated = await tx.automationMessageDraft.update({
        where: { id },
        data: {
          body: input.editedBody ?? draft.body,
          status,
          approvedById: input.decision === "APPROVE" ? userId : null,
          approvedAt: input.decision === "APPROVE" ? new Date() : null,
          failureMessage: input.decision === "REJECT" ? input.note : null,
          updatedById: userId,
        },
      });
      await tx.approvalRequest.updateMany({
        where: {
          organizationId,
          sourceType: "ENQUIRY_AGENT_DRAFT",
          sourceId: id,
          status: "PENDING",
        },
        data: {
          status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedById: userId,
          decisionNote: input.note,
          decidedAt: new Date(),
        },
      });
      return updated;
    });
  }
  async takeover(
    organizationId: string,
    userId: string,
    input: HumanTakeoverInput,
  ) {
    const connector = await this.connector(organizationId, userId),
      configuration = connector.configuration as InternalConfiguration,
      ids = new Set(configuration.humanTakeoverConversationIds ?? []);
    if (input.enabled) ids.add(input.conversationId);
    else ids.delete(input.conversationId);
    await prisma.integrationConnector.update({
      where: { id: connector.id },
      data: {
        configuration: {
          ...configuration,
          humanTakeoverConversationIds: [...ids],
        },
        updatedById: userId,
      },
    });
    return {
      conversationId: input.conversationId,
      humanTakeover: input.enabled,
    };
  }
}
