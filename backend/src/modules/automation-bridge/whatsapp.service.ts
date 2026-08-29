import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { EnquiryAgentService } from "../enquiry-agent/enquiry-agent.service.js";
import { encryptSecret } from "./bridge.crypto.js";
import type {
  MessageDraftInput,
  WhatsappEscalationInput,
  WhatsappTemplateDraftInput,
  WhatsappCredentialsInput,
} from "./bridge.validation.js";
export type MetaPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          timestamp?: string;
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ code?: number; title?: string }>;
        }>;
      };
    }>;
  }>;
};
export class WhatsappService {
  private agent = new EnquiryAgentService();
  async credentials(
    org: string,
    user: string,
    id: string,
    input: WhatsappCredentialsInput,
  ) {
    const connector = await prisma.integrationConnector.findFirst({
      where: { id, organizationId: org, type: "WHATSAPP", deletedAt: null },
    });
    if (!connector)
      throw new AppError(
        404,
        "WhatsApp connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
    return prisma.integrationConnector.update({
      where: { id },
      data: {
        whatsappPhoneNumberId: input.phoneNumberId,
        whatsappBusinessAccountId: input.businessAccountId,
        accessTokenEncrypted: encryptSecret(input.accessToken),
        appSecretEncrypted: encryptSecret(input.appSecret),
        credentialsConfiguredAt: new Date(),
        updatedById: user,
      },
      select: {
        id: true,
        name: true,
        status: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessAccountId: true,
        credentialsConfiguredAt: true,
      },
    });
  }
  verify(
    _webhookKey: string,
    mode: unknown,
    token: unknown,
    challenge: unknown,
  ) {
    if (
      !env.META_WHATSAPP_ENABLED ||
      mode !== "subscribe" ||
      typeof token !== "string" ||
      typeof challenge !== "string" ||
      !env.META_WHATSAPP_VERIFY_TOKEN
    )
      throw new AppError(
        403,
        "Webhook verification failed.",
        "WEBHOOK_VERIFICATION_FAILED",
      );
    const digest = createHash("sha256").update(token).digest(),
      expected = createHash("sha256")
        .update(env.META_WHATSAPP_VERIFY_TOKEN)
        .digest();
    if (digest.length !== expected.length || !timingSafeEqual(digest, expected))
      throw new AppError(
        403,
        "Webhook verification failed.",
        "WEBHOOK_VERIFICATION_FAILED",
      );
    return challenge;
  }
  signature(raw: Buffer, header: string | undefined, secret: string) {
    if (!header?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    return (
      header.length === expected.length &&
      timingSafeEqual(Buffer.from(header), Buffer.from(expected))
    );
  }
  private async connector(phoneNumberId: string) {
    if (
      !env.META_WHATSAPP_PHONE_NUMBER_ID ||
      phoneNumberId !== env.META_WHATSAPP_PHONE_NUMBER_ID
    )
      throw new AppError(
        404,
        "Meta test Phone Number ID was not found.",
        "META_PHONE_NUMBER_NOT_FOUND",
      );
    const connectors = await prisma.integrationConnector.findMany({
      where: {
        type: "WHATSAPP",
        provider: "META_WHATSAPP_CLOUD",
        whatsappPhoneNumberId: phoneNumberId,
        status: "ACTIVE",
        deletedAt: null,
        organization: { status: "ACTIVE", deletedAt: null },
      },
      take: 2,
    });
    if (connectors.length !== 1)
      throw new AppError(
        404,
        "A unique active Meta test connector was not found.",
        "META_CONNECTOR_NOT_FOUND",
      );
    const connector = connectors[0]!;
    const owner = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: connector.organizationId,
        status: "ACTIVE",
        role: { code: "ORGANIZATION_OWNER" },
        user: { status: "ACTIVE", deletedAt: null },
      },
      select: { userId: true },
    });
    if (!owner)
      throw new AppError(
        403,
        "The connector organization is unavailable.",
        "META_ORGANIZATION_INACTIVE",
      );
    return { ...connector, actorUserId: owner.userId };
  }

  private payloadItems(payload: MetaPayload) {
    const items: Array<{
      phoneNumberId: string;
      externalEventId: string;
      kind: "MESSAGE" | "STATUS";
      data: Record<string, unknown>;
    }> = [];
    for (const entry of payload.entry ?? [])
      for (const change of entry.changes ?? []) {
        const value = change.value,
          phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const contact = value.contacts?.[0];
        for (const message of value.messages ?? [])
          if (message.id && message.from)
            items.push({
              phoneNumberId,
              externalEventId: `meta:message:${message.id}`,
              kind: "MESSAGE",
              data: {
                metaMessageId: message.id,
                from: message.from.replace(/\D/g, ""),
                contactName: contact?.profile?.name ?? null,
                messageType: message.type ?? "unknown",
                message:
                  message.type === "text" ? (message.text?.body ?? "") : null,
                receivedAt: message.timestamp
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : new Date().toISOString(),
              },
            });
        for (const status of value.statuses ?? [])
          if (status.id && status.status)
            items.push({
              phoneNumberId,
              externalEventId: `meta:status:${status.id}:${status.status}:${status.timestamp ?? "unknown"}`,
              kind: "STATUS",
              data: {
                metaMessageId: status.id,
                status: status.status,
                timestamp: status.timestamp ?? null,
                errorCode: status.errors?.[0]?.code ?? null,
              },
            });
      }
    return items;
  }

  private async persist(payload: MetaPayload) {
    const receipts: string[] = [];
    for (const item of this.payloadItems(payload)) {
      const connector = await this.connector(item.phoneNumberId);
      try {
        const receipt = await prisma.integrationEvent.create({
          data: {
            organizationId: connector.organizationId,
            connectorId: connector.id,
            externalEventId: item.externalEventId,
            eventName:
              item.kind === "MESSAGE"
                ? "meta.whatsapp.message.received"
                : "meta.whatsapp.message.status",
            kind: item.kind === "MESSAGE" ? "INQUIRY" : "UNKNOWN",
            status: "RECEIVED",
            signatureVerified: true,
            payload: { receiptKind: item.kind, ...item.data },
            payloadHash: createHash("sha256")
              .update(JSON.stringify(item.data))
              .digest("hex"),
            attemptCount: 0,
            createdById: connector.actorUserId,
            updatedById: connector.actorUserId,
          },
          select: { id: true },
        });
        receipts.push(receipt.id);
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ))
          throw error;
      }
    }
    return receipts;
  }

  async accept(
    _webhookKey: string,
    raw: Buffer | undefined,
    signature: string | undefined,
    payload: MetaPayload,
  ) {
    if (!env.META_WHATSAPP_ENABLED)
      throw new AppError(
        503,
        "Meta WhatsApp inbound processing is disabled.",
        "META_WHATSAPP_DISABLED",
      );
    if (
      !raw ||
      !env.META_WHATSAPP_APP_SECRET ||
      !this.signature(raw, signature, env.META_WHATSAPP_APP_SECRET)
    )
      throw new AppError(
        401,
        "Invalid Meta webhook signature.",
        "INVALID_WEBHOOK_SIGNATURE",
      );
    const receiptIds = await this.persist(payload);
    setImmediate(
      () =>
        void Promise.all(receiptIds.map((id) => this.processReceipt(id))).catch(
          () => undefined,
        ),
    );
    return { accepted: receiptIds.length };
  }

  async receive(
    webhookKey: string,
    raw: Buffer | undefined,
    signature: string | undefined,
    payload: MetaPayload,
  ) {
    if (!env.META_WHATSAPP_ENABLED)
      throw new AppError(
        503,
        "Meta WhatsApp inbound processing is disabled.",
        "META_WHATSAPP_DISABLED",
      );
    if (
      !raw ||
      !env.META_WHATSAPP_APP_SECRET ||
      !this.signature(raw, signature, env.META_WHATSAPP_APP_SECRET)
    )
      throw new AppError(
        401,
        "Invalid Meta webhook signature.",
        "INVALID_WEBHOOK_SIGNATURE",
      );
    const receiptIds = await this.persist(payload);
    await Promise.all(receiptIds.map((id) => this.processReceipt(id)));
    return { accepted: receiptIds.length };
  }

  async processReceipt(id: string) {
    const claimed = await prisma.integrationEvent.updateMany({
      where: {
        id,
        status: { in: ["RECEIVED", "FAILED"] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        nextRetryAt: null,
      },
    });
    if (claimed.count !== 1) return;
    const receipt = await prisma.integrationEvent.findFirst({
      where: { id },
      include: { connector: true },
    });
    if (!receipt) return;
    const payload = receipt.payload as Record<string, unknown>;
    let actorUserId = receipt.updatedById;
    try {
      const connector = await this.connector(
        receipt.connector.whatsappPhoneNumberId ?? "",
      );
      actorUserId = connector.actorUserId;
      if (payload.receiptKind === "STATUS") {
        const status =
            typeof payload.status === "string"
              ? payload.status.toUpperCase()
              : "UNKNOWN",
          metaMessageId =
            typeof payload.metaMessageId === "string"
              ? payload.metaMessageId
              : "",
          errorCode =
            typeof payload.errorCode === "number" ? payload.errorCode : null;
        await prisma.automationMessageDraft.updateMany({
          where: {
            organizationId: receipt.organizationId,
            connectorId: receipt.connectorId,
            externalMessageId: metaMessageId,
          },
          data: {
            providerStatus: status,
            ...(status === "FAILED"
              ? {
                  status: "FAILED",
                  failureMessage: errorCode
                    ? `Meta error ${errorCode}`
                    : "Meta delivery failed.",
                }
              : {}),
          },
        });
      } else {
        const messageType =
            typeof payload.messageType === "string"
              ? payload.messageType
              : "unknown",
          unsupported = messageType !== "text";
        const metaMessageId =
            typeof payload.metaMessageId === "string"
              ? payload.metaMessageId
              : "",
          from = typeof payload.from === "string" ? payload.from : "",
          receivedAt =
            typeof payload.receivedAt === "string"
              ? payload.receivedAt
              : new Date().toISOString();
        const result = await this.agent.process(
          receipt.organizationId,
          connector.actorUserId,
          {
            channel: "WHATSAPP",
            externalMessageId: metaMessageId,
            conversationId: `meta:${from}`,
            customerName:
              typeof payload.contactName === "string"
                ? payload.contactName
                : undefined,
            phone: from,
            message: unsupported
              ? `Unsupported ${messageType} message received. Human review is required.`
              : typeof payload.message === "string"
                ? payload.message
                : "",
            receivedAt,
            metadata: {
              provider: "META_WHATSAPP_CLOUD",
              messageType,
              unsupportedMedia: unsupported,
            },
          },
          {
            connectorId: receipt.connectorId,
            source: "META",
            forceApproval:
              unsupported || receipt.connector.mode !== "POLICY_LIMITED",
          },
        );
        if (
          result &&
          "draftId" in result &&
          result.draftId &&
          !result.approvalRequired &&
          env.META_WHATSAPP_OUTBOUND_ENABLED
        )
          await this.sendApproved(
            receipt.organizationId,
            connector.actorUserId,
            result.draftId,
          );
      }
      await prisma.integrationEvent.update({
        where: { id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          failureCode: null,
          failureMessage: null,
          nextRetryAt: null,
          updatedById: actorUserId,
        },
      });
    } catch (error) {
      const attempt = receipt.attemptCount + 1,
        transient =
          !(error instanceof AppError) ||
          error.statusCode >= 500 ||
          error.statusCode === 429;
      await prisma.integrationEvent.update({
        where: { id },
        data: {
          status: "FAILED",
          failureCode:
            error instanceof AppError ? error.code : "META_PROCESSING_FAILED",
          failureMessage: "Meta webhook processing failed safely.",
          nextRetryAt:
            transient && attempt <= env.META_WHATSAPP_MAX_RETRIES
              ? new Date(Date.now() + Math.min(60, 2 ** attempt) * 1000)
              : null,
          updatedById: actorUserId,
        },
      });
      logger.warn(
        {
          receiptId: id,
          code:
            error instanceof AppError ? error.code : "META_PROCESSING_FAILED",
        },
        "Meta WhatsApp receipt processing failed",
      );
    }
  }
  async drafts(org: string) {
    return prisma.automationMessageDraft.findMany({
      where: { organizationId: org },
      include: {
        connector: { select: { name: true, type: true, provider: true } },
        event: { select: { eventName: true, traceId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async workspace(org: string) {
    const [connectors, events, drafts, inquiries] = await Promise.all([
      prisma.integrationConnector.findMany({
        where: { organizationId: org, type: "WHATSAPP", deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          credentialsConfiguredAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.integrationEvent.findMany({
        where: { organizationId: org, connector: { type: "WHATSAPP" } },
        select: {
          id: true,
          connectorId: true,
          resultId: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.automationMessageDraft.findMany({
        where: { organizationId: org, connector: { type: "WHATSAPP" } },
        select: {
          id: true,
          connectorId: true,
          eventId: true,
          recipient: true,
          body: true,
          status: true,
          createdAt: true,
          sentAt: true,
          failureMessage: true,
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.inquiry.findMany({
        where: {
          organizationId: org,
          phone: { not: null },
          deletedAt: null,
          status: { notIn: ["DISQUALIFIED", "SPAM"] },
        },
        select: {
          id: true,
          contactName: true,
          phone: true,
          subject: true,
          status: true,
          assignedEmployee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);
    const inquiryById = new Map(inquiries.map((item) => [item.id, item]));
    const conversations = new Map<
      string,
      {
        recipient: string;
        inquiry: (typeof inquiries)[number] | null;
        messages: Array<{
          id: string;
          direction: "INBOUND" | "OUTBOUND";
          body: string;
          status: string;
          occurredAt: Date;
        }>;
      }
    >();
    for (const event of events) {
      const payload = event.payload as {
        phone?: string | null;
        message?: string | null;
      };
      if (!payload.phone || !payload.message) continue;
      const recipient = payload.phone.replace(/^\+/, "");
      const conversation = conversations.get(recipient) ?? {
        recipient,
        inquiry: event.resultId
          ? (inquiryById.get(event.resultId) ?? null)
          : (inquiries.find(
              (item) => item.phone?.replace(/^\+/, "") === recipient,
            ) ?? null),
        messages: [],
      };
      conversation.messages.push({
        id: event.id,
        direction: "INBOUND",
        body: payload.message,
        status: "RECEIVED",
        occurredAt: event.createdAt,
      });
      conversations.set(recipient, conversation);
    }
    for (const draft of drafts) {
      const recipient = draft.recipient.replace(/^\+/, "");
      const conversation = conversations.get(recipient) ?? {
        recipient,
        inquiry:
          inquiries.find(
            (item) => item.phone?.replace(/^\+/, "") === recipient,
          ) ?? null,
        messages: [],
      };
      conversation.messages.push({
        id: draft.id,
        direction: "OUTBOUND",
        body: draft.body,
        status: draft.status,
        occurredAt: draft.sentAt ?? draft.createdAt,
      });
      conversations.set(recipient, conversation);
    }
    return {
      connectors,
      inquiries,
      conversations: [...conversations.values()]
        .map((item) => {
          const messages = item.messages.sort(
            (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
          );
          return {
            ...item,
            messages,
            lastMessageAt: messages.at(-1)?.occurredAt ?? null,
          };
        })
        .sort(
          (a, b) =>
            (b.lastMessageAt?.getTime() ?? 0) -
            (a.lastMessageAt?.getTime() ?? 0),
        ),
    };
  }
  async templateDraft(
    org: string,
    user: string,
    input: WhatsappTemplateDraftInput,
  ) {
    const [connector, inquiry, linkedEvent] = await Promise.all([
      prisma.integrationConnector.findFirst({
        where: {
          id: input.connectorId,
          organizationId: org,
          type: "WHATSAPP",
          status: "ACTIVE",
          deletedAt: null,
        },
      }),
      prisma.inquiry.findFirst({
        where: {
          id: input.inquiryId,
          organizationId: org,
          deletedAt: null,
          phone: { not: null },
        },
      }),
      prisma.integrationEvent.findFirst({
        where: {
          organizationId: org,
          resultType: "INQUIRY",
          resultId: input.inquiryId,
          connector: { type: "WHATSAPP" },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!connector)
      throw new AppError(
        404,
        "Active WhatsApp connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
    if (!inquiry?.phone)
      throw new AppError(
        404,
        "Inquiry with a phone number was not found.",
        "INQUIRY_NOT_FOUND",
      );
    const templates = {
      WELCOME: `Hello ${inquiry.contactName}, thank you for contacting us about ${inquiry.subject}. We have received your inquiry and will assist you shortly.`,
      FOLLOW_UP: `Hello ${inquiry.contactName}, we are following up regarding ${inquiry.subject}. Please let us know if you would like to continue or need any clarification.`,
      QUOTATION: `Hello ${inquiry.contactName}, your quotation regarding ${inquiry.subject} is ready. Please reply if you would like us to explain any details.`,
      PAYMENT_REMINDER: `Hello ${inquiry.contactName}, this is a reminder regarding the pending payment connected to ${inquiry.subject}. Please reply if you need assistance.`,
      HUMAN_HANDOFF: `Hello ${inquiry.contactName}, a member of our team will take over this conversation and assist you personally.`,
    } as const;
    return this.draft(org, user, connector.id, {
      eventId: linkedEvent?.id ?? null,
      recipient: inquiry.phone,
      body: input.customMessage ?? templates[input.template],
    });
  }
  async escalate(org: string, user: string, input: WhatsappEscalationInput) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: input.inquiryId, organizationId: org, deletedAt: null },
      select: {
        id: true,
        subject: true,
        assignedEmployee: { select: { linkedUserId: true } },
      },
    });
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    const owner = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: org,
        status: "ACTIVE",
        role: { code: "ORGANIZATION_OWNER" },
      },
      select: { userId: true },
    });
    const recipientId = inquiry.assignedEmployee?.linkedUserId ?? owner?.userId;
    if (!recipientId)
      throw new AppError(
        409,
        "No active person is available for escalation.",
        "ESCALATION_RECIPIENT_NOT_FOUND",
      );
    await prisma.$transaction([
      prisma.inquiryTimeline.create({
        data: {
          organizationId: org,
          inquiryId: inquiry.id,
          type: "NOTE",
          summary: "WhatsApp conversation escalated to a human",
          details: input.reason,
          createdById: user,
        },
      }),
      prisma.notification.upsert({
        where: {
          organizationId_recipientId_sourceType_sourceId: {
            organizationId: org,
            recipientId,
            sourceType: "WHATSAPP_ESCALATION",
            sourceId: inquiry.id,
          },
        },
        update: {
          title: `Human help required: ${inquiry.subject}`,
          message: input.reason,
          readAt: null,
          deletedAt: null,
          updatedById: user,
        },
        create: {
          organizationId: org,
          recipientId,
          type: "AGENT_ALERT",
          title: `Human help required: ${inquiry.subject}`,
          message: input.reason,
          sourceType: "WHATSAPP_ESCALATION",
          sourceId: inquiry.id,
          actionPath: "/dashboard?view=inquiries",
          createdById: user,
          updatedById: user,
        },
      }),
    ]);
    return { inquiryId: inquiry.id, recipientId };
  }
  async draft(
    org: string,
    user: string,
    connectorId: string,
    input: MessageDraftInput,
  ) {
    const connector = await prisma.integrationConnector.findFirst({
      where: {
        id: connectorId,
        organizationId: org,
        type: "WHATSAPP",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!connector)
      throw new AppError(
        404,
        "Active WhatsApp connector was not found.",
        "CONNECTOR_NOT_FOUND",
      );
    if (
      input.eventId &&
      !(await prisma.integrationEvent.findFirst({
        where: { id: input.eventId, connectorId, organizationId: org },
      }))
    )
      throw new AppError(
        404,
        "Integration event was not found.",
        "EVENT_NOT_FOUND",
      );
    return prisma.automationMessageDraft.create({
      data: {
        organizationId: org,
        connectorId,
        eventId: input.eventId ?? null,
        recipient: input.recipient.replace(/^\+/, ""),
        body: input.body,
        status: "PENDING_APPROVAL",
        createdById: user,
        updatedById: user,
      },
    });
  }
  async approveAndSend(org: string, user: string, id: string) {
    const draft = await prisma.automationMessageDraft.findFirst({
      where: {
        id,
        organizationId: org,
        status: { in: ["PENDING_APPROVAL", "APPROVED"] },
      },
      include: { connector: true },
    });
    if (!draft)
      throw new AppError(
        404,
        "Sendable reply draft was not found.",
        "DRAFT_NOT_FOUND",
      );
    if (draft.status === "PENDING_APPROVAL") {
      if (draft.sourceType === "ENQUIRY_AGENT")
        throw new AppError(
          409,
          "The enquiry-agent response must complete its existing approval workflow before sending.",
          "AGENT_APPROVAL_REQUIRED",
        );
      await prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user,
          approvedAt: new Date(),
          updatedById: user,
        },
      });
    }
    return this.sendApproved(org, user, id);
  }

  async sendApproved(org: string, user: string, id: string) {
    if (!env.META_WHATSAPP_OUTBOUND_ENABLED || !env.META_WHATSAPP_ACCESS_TOKEN)
      throw new AppError(
        503,
        "Meta WhatsApp outbound delivery is disabled.",
        "META_OUTBOUND_DISABLED",
      );
    const draft = await prisma.automationMessageDraft.findFirst({
      where: { id, organizationId: org, status: "APPROVED" },
      include: { connector: true },
    });
    if (!draft)
      throw new AppError(
        404,
        "Approved WhatsApp reply was not found.",
        "APPROVED_DRAFT_NOT_FOUND",
      );
    const c = draft.connector;
    if (
      draft.sourceType === "WHATSAPP_SIMULATOR" ||
      draft.providerStatus === "SIMULATED_NOT_SENDABLE" ||
      c.provider.toUpperCase() === "B2BRAIN_SIMULATOR"
    )
      throw new AppError(
        409,
        "Simulator drafts cannot be sent to an external provider.",
        "SIMULATOR_SEND_FORBIDDEN",
      );
    if (
      c.provider !== "META_WHATSAPP_CLOUD" ||
      !c.whatsappPhoneNumberId ||
      c.whatsappPhoneNumberId !== env.META_WHATSAPP_PHONE_NUMBER_ID
    )
      throw new AppError(
        409,
        "The draft is not linked to the configured Meta test connector.",
        "WHATSAPP_NOT_CONFIGURED",
      );
    const recipient = draft.recipient.replace(/\D/g, "");
    if (!env.META_WHATSAPP_ALLOWED_TEST_RECIPIENTS.includes(recipient))
      throw new AppError(
        403,
        "Recipient is not an explicitly configured Meta test recipient.",
        "META_TEST_RECIPIENT_REQUIRED",
      );
    const claim = await prisma.automationMessageDraft.updateMany({
      where: {
        id,
        organizationId: org,
        status: "APPROVED",
        externalMessageId: null,
      },
      data: {
        status: "SENDING",
        attemptCount: { increment: 1 },
        nextRetryAt: null,
        updatedById: user,
      },
    });
    if (claim.count !== 1)
      throw new AppError(
        409,
        "This WhatsApp reply is already sending or was already sent.",
        "DUPLICATE_DELIVERY",
      );
    try {
      let result: { messages?: Array<{ id?: string }> } = {},
        lastStatus = 0;
      for (
        let attempt = 0;
        attempt <= env.META_WHATSAPP_MAX_RETRIES;
        attempt += 1
      ) {
        const controller = new AbortController(),
          timeout = setTimeout(
            () => controller.abort(),
            env.META_WHATSAPP_PROVIDER_TIMEOUT_MS,
          );
        try {
          const response = await fetch(
            `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(c.whatsappPhoneNumberId)}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.META_WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              signal: controller.signal,
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: recipient,
                type: "text",
                text: { preview_url: false, body: draft.body },
              }),
            },
          );
          lastStatus = response.status;
          const parsed = (await response.json()) as {
            messages?: Array<{ id?: string }>;
          };
          if (response.ok) {
            result = parsed;
            break;
          }
          if (response.status !== 429 && response.status < 500)
            throw new AppError(
              502,
              "Meta rejected the test message permanently.",
              "META_PERMANENT_SEND_FAILURE",
            );
          if (attempt === env.META_WHATSAPP_MAX_RETRIES)
            throw new Error(`Meta transient failure ${response.status}`);
        } finally {
          clearTimeout(timeout);
        }
      }
      if (!result.messages?.[0]?.id)
        throw new Error(
          `Meta response did not contain a message ID (${lastStatus}).`,
        );
      const sent = await prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "SENT",
          externalMessageId: result.messages[0].id,
          providerStatus: "SENT",
          sentAt: new Date(),
          failureMessage: null,
          updatedById: user,
        },
      });
      if (draft.eventId) {
        const linked = await prisma.integrationEvent.findFirst({
          where: {
            id: draft.eventId,
            organizationId: org,
            resultType: "INQUIRY",
            resultId: { not: null },
          },
          select: { resultId: true },
        });
        if (linked?.resultId)
          await prisma.inquiryTimeline.create({
            data: {
              organizationId: org,
              inquiryId: linked.resultId,
              type: "CONTACT_LOGGED",
              summary: "Approved WhatsApp message sent",
              details: draft.body,
              createdById: user,
            },
          });
      }
      return sent;
    } catch (error) {
      await prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "FAILED",
          failureMessage:
            error instanceof AppError &&
            error.code === "META_PERMANENT_SEND_FAILURE"
              ? "Meta rejected the test message permanently."
              : "Meta test delivery failed safely.",
          nextRetryAt: null,
          updatedById: user,
        },
      });
      throw new AppError(
        502,
        "WhatsApp send failed and was recorded.",
        "WHATSAPP_SEND_FAILED",
      );
    }
  }
}

export function startMetaWhatsappDispatcher(intervalMs = 15_000) {
  if (!env.META_WHATSAPP_ENABLED) return () => undefined;
  const service = new WhatsappService();
  const run = async () => {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() -
        Math.max(
          env.META_WHATSAPP_WEBHOOK_TIMEOUT_MS,
          env.META_WHATSAPP_PROVIDER_TIMEOUT_MS,
          30_000,
        ) *
          3,
    );
    await prisma.integrationEvent.updateMany({
      where: {
        eventName: {
          in: [
            "meta.whatsapp.message.received",
            "meta.whatsapp.message.status",
          ],
        },
        status: "PROCESSING",
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: "FAILED",
        failureCode: "META_PROCESSING_INTERRUPTED",
        failureMessage: "Interrupted processing is ready for a safe retry.",
        nextRetryAt: now,
      },
    });
    const receipts = await prisma.integrationEvent.findMany({
      where: {
        eventName: {
          in: [
            "meta.whatsapp.message.received",
            "meta.whatsapp.message.status",
          ],
        },
        status: { in: ["RECEIVED", "FAILED"] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    await Promise.all(
      receipts.map((receipt) => service.processReceipt(receipt.id)),
    );
  };
  const timer = setInterval(
    () =>
      void run().catch((error: unknown) =>
        logger.error({ err: error }, "Meta WhatsApp dispatcher failed"),
      ),
    intervalMs,
  );
  timer.unref();
  void run().catch((error: unknown) =>
    logger.error({ err: error }, "Meta WhatsApp dispatcher failed"),
  );
  return () => clearInterval(timer);
}
