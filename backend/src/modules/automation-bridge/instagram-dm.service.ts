import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

const id = z.string().regex(/^\d{1,32}$/);
const payloadSchema = z.object({
  object: z.literal("instagram"),
  entry: z.array(z.object({
    id,
    messaging: z.array(z.object({
      sender: z.object({ id }),
      recipient: z.object({ id }),
      message: z.object({ mid: z.string().min(1).max(256), text: z.string().max(4096).optional(), is_echo: z.boolean().optional() }).optional(),
    }).passthrough()).max(50).optional(),
  }).passthrough()).max(20),
}).passthrough();

export class InstagramDmService {
  verify(mode: unknown, token: unknown, challenge: unknown) {
    if (!env.META_INSTAGRAM_DM_ENABLED || mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !env.META_INSTAGRAM_VERIFY_TOKEN)
      throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    const supplied = createHash("sha256").update(token).digest();
    const expected = createHash("sha256").update(env.META_INSTAGRAM_VERIFY_TOKEN).digest();
    if (!timingSafeEqual(supplied, expected)) throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    return challenge;
  }

  async accept(raw: Buffer | undefined, signature: string | undefined, body: unknown) {
    if (!raw || !raw.length || raw.length > 256 * 1024) throw new AppError(413, "Instagram webhook payload is invalid.", "INVALID_INSTAGRAM_WEBHOOK");
    if (!env.META_INSTAGRAM_DM_ENABLED || !env.EXTERNAL_CHANNELS_ENABLED || !env.META_INSTAGRAM_APP_SECRET || !signature?.startsWith("sha256="))
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    const expected = `sha256=${createHmac("sha256", env.META_INSTAGRAM_APP_SECRET).update(raw).digest("hex")}`;
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, "Instagram webhook payload is invalid.", "INVALID_INSTAGRAM_WEBHOOK");
    let processed = 0, duplicate = 0;
    for (const entry of parsed.data.entry) {
      if (entry.id !== env.META_INSTAGRAM_ACCOUNT_ID) throw new AppError(404, "Instagram account is not configured.", "INSTAGRAM_ACCOUNT_UNAVAILABLE");
      for (const item of entry.messaging ?? []) {
        const message = item.message;
        if (!message || message.is_echo || item.sender.id === entry.id || item.recipient.id !== entry.id || !message.text?.trim()) continue;
        const connectors = await prisma.integrationConnector.findMany({
          where: { type: "SOCIAL", provider: "META_INSTAGRAM_DM", externalAccountRef: entry.id, status: "ACTIVE", deletedAt: null, organization: { status: "ACTIVE", deletedAt: null } },
          select: { id: true, organizationId: true, createdById: true }, take: 2,
        });
        if (connectors.length !== 1) throw new AppError(404, "Instagram connector is unavailable.", "INSTAGRAM_CONNECTOR_UNAVAILABLE");
        const connector = connectors[0]!;
        const text = message.text.trim();
        try {
          await prisma.$transaction(async (tx) => {
            const event = await tx.integrationEvent.create({ data: {
              organizationId: connector.organizationId, connectorId: connector.id, externalEventId: message.mid,
              eventName: "INSTAGRAM_DM", kind: "INQUIRY", status: "VERIFIED", signatureVerified: true,
              payload: { senderId: item.sender.id, recipientId: entry.id, text },
              payloadHash: createHash("sha256").update(raw).digest("hex"),
              createdById: connector.createdById, updatedById: connector.createdById,
            } });
            const inquiry = await tx.inquiry.create({ data: {
              organizationId: connector.organizationId, source: "SOCIAL", status: "NEW", contactName: `Instagram user ${item.sender.id}`,
              subject: "Instagram direct message", message: text,
              createdById: connector.createdById, updatedById: connector.createdById,
              timeline: { create: { organizationId: connector.organizationId, type: "CREATED", summary: "Captured from Instagram DM", details: `Trace ${event.traceId}`, createdById: connector.createdById } },
            } });
            await tx.integrationEvent.update({ where: { id: event.id }, data: { status: "COMPLETED", resultType: "INQUIRY", resultId: inquiry.id, processedAt: new Date(), updatedById: connector.createdById } });
            await tx.integrationConnector.update({ where: { id: connector.id }, data: { lastReceivedAt: new Date(), lastSuccessfulAt: new Date(), updatedById: connector.createdById } });
          });
          processed++;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") duplicate++;
          else throw error;
        }
      }
    }
    return { accepted: true, processed, duplicate };
  }
}
