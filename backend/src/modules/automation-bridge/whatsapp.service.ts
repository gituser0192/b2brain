import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret, encryptSecret } from "./bridge.crypto.js";
import { BridgeService } from "./bridge.service.js";
import type {
  MessageDraftInput,
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
        try { await this.bridge.intake(
            connector.organizationId,
            connector.createdById,
            connector.id,
            {
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
            },
        ); accepted++; } catch(error) { if(!(error instanceof AppError&&error.code==="DUPLICATE_EVENT"))throw error; }
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
      return prisma.automationMessageDraft.update({
        where: { id },
        data: {
          status: "SENT",
          externalMessageId: result.messages?.[0]?.id ?? null,
          sentAt: new Date(),
          failureMessage: null,
          updatedById: user,
        },
      });
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
