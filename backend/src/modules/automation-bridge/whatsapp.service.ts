import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret, encryptSecret } from "./bridge.crypto.js";
import { BridgeService } from "./bridge.service.js";
import type {
  IntakeInput,
  MessageDraftInput,
  WhatsappEscalationInput,
  WhatsappTemplateDraftInput,
  WhatsappCredentialsInput,
} from "./bridge.validation.js";
type MetaPayload = {
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
        statuses?: Array<{ id?: string; status?: string; timestamp?: string }>;
      };
    }>;
  }>;
};
export class WhatsappService {
  private bridge = new BridgeService();
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
  async verify(
    webhookKey: string,
    mode: unknown,
    token: unknown,
    challenge: unknown,
  ) {
    const connector = await prisma.integrationConnector.findFirst({
      where: {
        webhookKey,
        type: "WHATSAPP",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (
      !connector ||
      mode !== "subscribe" ||
      typeof token !== "string" ||
      typeof challenge !== "string" ||
      !connector.signingSecretHash
    )
      throw new AppError(
        403,
        "Webhook verification failed.",
        "WEBHOOK_VERIFICATION_FAILED",
      );
    const digest = createHash("sha256").update(token).digest("hex"),
      expected = connector.signingSecretHash;
    if (
      digest.length !== expected.length ||
      !timingSafeEqual(Buffer.from(digest), Buffer.from(expected))
    )
      throw new AppError(
        403,
        "Webhook verification failed.",
        "WEBHOOK_VERIFICATION_FAILED",
      );
    return challenge;
  }
  private signature(raw: Buffer, header: string | undefined, secret: string) {
    if (!header?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    return (
      header.length === expected.length &&
      timingSafeEqual(Buffer.from(header), Buffer.from(expected))
    );
  }
  async receive(
    webhookKey: string,
    raw: Buffer | undefined,
    signature: string | undefined,
    payload: MetaPayload,
  ) {
    const connector = await prisma.integrationConnector.findFirst({
      where: {
        webhookKey,
        type: "WHATSAPP",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (
      !connector ||
      !connector.appSecretEncrypted ||
      !connector.whatsappPhoneNumberId
    )
      throw new AppError(
        404,
        "Active WhatsApp connector was not found.",
        "WHATSAPP_CONNECTOR_NOT_FOUND",
      );
    if (
      !raw ||
      !this.signature(
        raw,
        signature,
        decryptSecret(connector.appSecretEncrypted),
      )
    )
      throw new AppError(
        401,
        "Invalid Meta webhook signature.",
        "INVALID_WEBHOOK_SIGNATURE",
      );
    let accepted = 0;
    for (const entry of payload.entry ?? [])
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (
          value?.metadata?.phone_number_id !== connector.whatsappPhoneNumberId
        )
          continue;
        const contact = value.contacts?.[0];
        for (const message of value.messages ?? []) {
          if (!message.id || !message.from) continue;
          const body =
            message.type === "text"
              ? (message.text?.body ?? "")
              : `[${message.type ?? "unsupported"} message]`;
        try {
          const input: IntakeInput = {
              externalEventId: message.id,
              eventName: "whatsapp.message.received",
              kind: message.type === "text" ? "INQUIRY" : "UNKNOWN",
              contactName: contact?.profile?.name ?? message.from,
              email: null,
              phone: message.from,
              subject: "WhatsApp inquiry",
              message: body || "Unsupported WhatsApp message received.",
              raw: {
                messageType: message.type ?? "unknown",
                timestamp: message.timestamp ?? null,
              },
            };
          const existing = await prisma.inquiry.findFirst({
            where: { organizationId: connector.organizationId, source: "WHATSAPP", phone: message.from, deletedAt: null, status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] } },
            select: { id: true, status: true, firstRespondedAt: true },
            orderBy: { createdAt: "desc" },
          });
          if (existing) await this.bridge.recordInboundReply(connector, existing, input);
          else await this.bridge.intake(connector.organizationId, connector.createdById, connector.id, input);
          accepted++;
        } catch(error) { if(!(error instanceof AppError&&error.code==="DUPLICATE_EVENT"))throw error; }
        }
      }
    return { accepted };
  }
  async drafts(org: string) {
    return prisma.automationMessageDraft.findMany({
      where: { organizationId: org },
      include: {
        connector: { select: { name: true, type: true } },
        event: { select: { eventName: true, traceId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async workspace(org: string) {
    const [connectors, events, drafts, inquiries] = await Promise.all([
      prisma.integrationConnector.findMany({ where: { organizationId: org, type: "WHATSAPP", deletedAt: null }, select: { id: true, name: true, status: true, credentialsConfiguredAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.integrationEvent.findMany({ where: { organizationId: org, connector: { type: "WHATSAPP" } }, select: { id: true, connectorId: true, resultId: true, payload: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.automationMessageDraft.findMany({ where: { organizationId: org, connector: { type: "WHATSAPP" } }, select: { id: true, connectorId: true, eventId: true, recipient: true, body: true, status: true, createdAt: true, sentAt: true, failureMessage: true }, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.inquiry.findMany({ where: { organizationId: org, phone: { not: null }, deletedAt: null, status: { notIn: ["DISQUALIFIED", "SPAM"] } }, select: { id: true, contactName: true, phone: true, subject: true, status: true, assignedEmployee: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    ]);
    const inquiryById = new Map(inquiries.map(item => [item.id, item]));
    const conversations = new Map<string, { recipient: string; inquiry: typeof inquiries[number] | null; messages: Array<{ id: string; direction: "INBOUND" | "OUTBOUND"; body: string; status: string; occurredAt: Date }> }>();
    for (const event of events) {
      const payload = event.payload as { phone?: string | null; message?: string | null };
      if (!payload.phone || !payload.message) continue;
      const recipient = payload.phone.replace(/^\+/, "");
      const conversation = conversations.get(recipient) ?? { recipient, inquiry: event.resultId ? inquiryById.get(event.resultId) ?? null : inquiries.find(item => item.phone?.replace(/^\+/, "") === recipient) ?? null, messages: [] };
      conversation.messages.push({ id: event.id, direction: "INBOUND", body: payload.message, status: "RECEIVED", occurredAt: event.createdAt });
      conversations.set(recipient, conversation);
    }
    for (const draft of drafts) {
      const recipient = draft.recipient.replace(/^\+/, "");
      const conversation = conversations.get(recipient) ?? { recipient, inquiry: inquiries.find(item => item.phone?.replace(/^\+/, "") === recipient) ?? null, messages: [] };
      conversation.messages.push({ id: draft.id, direction: "OUTBOUND", body: draft.body, status: draft.status, occurredAt: draft.sentAt ?? draft.createdAt });
      conversations.set(recipient, conversation);
    }
    return { connectors, inquiries, conversations: [...conversations.values()].map(item => {
      const messages = item.messages.sort((a,b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      return { ...item, messages, lastMessageAt: messages.at(-1)?.occurredAt ?? null };
    }).sort((a,b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)) };
  }
  async templateDraft(org: string, user: string, input: WhatsappTemplateDraftInput) {
    const [connector, inquiry, linkedEvent] = await Promise.all([
      prisma.integrationConnector.findFirst({ where: { id: input.connectorId, organizationId: org, type: "WHATSAPP", status: "ACTIVE", deletedAt: null } }),
      prisma.inquiry.findFirst({ where: { id: input.inquiryId, organizationId: org, deletedAt: null, phone: { not: null } } }),
      prisma.integrationEvent.findFirst({ where: { organizationId: org, resultType: "INQUIRY", resultId: input.inquiryId, connector: { type: "WHATSAPP" } }, select: { id: true }, orderBy: { createdAt: "desc" } }),
    ]);
    if (!connector) throw new AppError(404, "Active WhatsApp connector was not found.", "CONNECTOR_NOT_FOUND");
    if (!inquiry?.phone) throw new AppError(404, "Inquiry with a phone number was not found.", "INQUIRY_NOT_FOUND");
    const templates = {
      WELCOME: `Hello ${inquiry.contactName}, thank you for contacting us about ${inquiry.subject}. We have received your inquiry and will assist you shortly.`,
      FOLLOW_UP: `Hello ${inquiry.contactName}, we are following up regarding ${inquiry.subject}. Please let us know if you would like to continue or need any clarification.`,
      QUOTATION: `Hello ${inquiry.contactName}, your quotation regarding ${inquiry.subject} is ready. Please reply if you would like us to explain any details.`,
      PAYMENT_REMINDER: `Hello ${inquiry.contactName}, this is a reminder regarding the pending payment connected to ${inquiry.subject}. Please reply if you need assistance.`,
      HUMAN_HANDOFF: `Hello ${inquiry.contactName}, a member of our team will take over this conversation and assist you personally.`,
    } as const;
    return this.draft(org, user, connector.id, { eventId: linkedEvent?.id ?? null, recipient: inquiry.phone, body: input.customMessage ?? templates[input.template] });
  }
  async escalate(org: string, user: string, input: WhatsappEscalationInput) {
    const inquiry = await prisma.inquiry.findFirst({ where: { id: input.inquiryId, organizationId: org, deletedAt: null }, select: { id: true, subject: true, assignedEmployee: { select: { linkedUserId: true } } } });
    if (!inquiry) throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    const owner = await prisma.organizationMembership.findFirst({ where: { organizationId: org, status: "ACTIVE", role: { code: "ORGANIZATION_OWNER" } }, select: { userId: true } });
    const recipientId = inquiry.assignedEmployee?.linkedUserId ?? owner?.userId;
    if (!recipientId) throw new AppError(409, "No active person is available for escalation.", "ESCALATION_RECIPIENT_NOT_FOUND");
    await prisma.$transaction([
      prisma.inquiryTimeline.create({ data: { organizationId: org, inquiryId: inquiry.id, type: "NOTE", summary: "WhatsApp conversation escalated to a human", details: input.reason, createdById: user } }),
      prisma.notification.upsert({ where: { organizationId_recipientId_sourceType_sourceId: { organizationId: org, recipientId, sourceType: "WHATSAPP_ESCALATION", sourceId: inquiry.id } }, update: { title: `Human help required: ${inquiry.subject}`, message: input.reason, readAt: null, deletedAt: null, updatedById: user }, create: { organizationId: org, recipientId, type: "AGENT_ALERT", title: `Human help required: ${inquiry.subject}`, message: input.reason, sourceType: "WHATSAPP_ESCALATION", sourceId: inquiry.id, actionPath: "/dashboard?view=inquiries", createdById: user, updatedById: user } }),
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
      where: { id, organizationId: org, status: "PENDING_APPROVAL" },
      include: { connector: true },
    });
    if (!draft)
      throw new AppError(
        404,
        "Pending reply draft was not found.",
        "DRAFT_NOT_FOUND",
      );
    const c = draft.connector;
    if (!c.accessTokenEncrypted || !c.whatsappPhoneNumberId)
      throw new AppError(
        409,
        "WhatsApp credentials are incomplete.",
        "WHATSAPP_NOT_CONFIGURED",
      );
    await prisma.automationMessageDraft.update({
      where: { id },
      data: {
        status: "SENDING",
        approvedById: user,
        approvedAt: new Date(),
        updatedById: user,
      },
    });
    try {
      const response = await fetch(
        `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(c.whatsappPhoneNumberId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptSecret(c.accessTokenEncrypted)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: draft.recipient,
            type: "text",
            text: { preview_url: false, body: draft.body },
          }),
        },
      );
      const result = (await response.json()) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          result.error?.message ?? `Meta API returned ${response.status}`,
        );
      const sent = await prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "SENT",
          externalMessageId: result.messages?.[0]?.id ?? null,
          sentAt: new Date(),
          failureMessage: null,
          updatedById: user,
        },
      });
      if (draft.eventId) {
        const linked = await prisma.integrationEvent.findFirst({ where: { id: draft.eventId, organizationId: org, resultType: "INQUIRY", resultId: { not: null } }, select: { resultId: true } });
        if (linked?.resultId) await prisma.inquiryTimeline.create({ data: { organizationId: org, inquiryId: linked.resultId, type: "CONTACT_LOGGED", summary: "Approved WhatsApp message sent", details: draft.body, createdById: user } });
      }
      return sent;
    } catch (error) {
      await prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "FAILED",
          failureMessage:
            error instanceof Error ? error.message : "Send failed",
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
