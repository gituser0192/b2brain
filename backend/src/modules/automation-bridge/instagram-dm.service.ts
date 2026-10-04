import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { resolveMetaAsset } from "./meta-assets.service.js";

const id = z.string().regex(/^\d{1,32}$/);
const message = z.object({
  sender: z.object({ id }), recipient: z.object({ id }),
  timestamp: z.number().int().min(0).max(9_999_999_999_999).safe(),
  message: z.object({ mid: z.string().min(1).max(256), text: z.string().max(4096).optional(), is_echo: z.boolean().optional(), is_self: z.boolean().optional(), is_deleted: z.boolean().optional(), is_unsupported: z.boolean().optional() }).optional(),
}).passthrough();
const entry = z.object({ id, messaging: z.array(z.unknown()).max(50).optional() }).passthrough();
const envelope = z.object({ object: z.literal("instagram"), entry: z.array(z.unknown()).max(20) }).passthrough();
const payload = z.union([envelope, z.array(envelope).min(1).max(20)]);

export class InstagramDmService {
  verify(mode: unknown, token: unknown, challenge: unknown) {
    if (!env.META_INSTAGRAM_DM_ENABLED || mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !/^\d+$/.test(challenge) || !env.META_INSTAGRAM_VERIFY_TOKEN)
      throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    const supplied = createHash("sha256").update(token).digest();
    const expected = createHash("sha256").update(env.META_INSTAGRAM_VERIFY_TOKEN).digest();
    if (!timingSafeEqual(supplied, expected)) throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    return challenge;
  }

  async accept(raw: Buffer | undefined, signature: string | undefined) {
    if (!raw?.length || raw.length > 256 * 1024) throw new AppError(413, "Instagram webhook payload is invalid.", "INVALID_INSTAGRAM_WEBHOOK");
    if (!env.META_INSTAGRAM_DM_ENABLED || !env.META_INSTAGRAM_SIGNATURE_PROVEN || !env.EXTERNAL_CHANNELS_ENABLED || !env.META_INSTAGRAM_APP_SECRET || !/^sha256=[a-f0-9]{64}$/i.test(signature ?? ""))
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    const supplied = Buffer.from(signature!.slice(7), "hex");
    const expected = createHmac("sha256", env.META_INSTAGRAM_APP_SECRET).update(raw).digest();
    if (!timingSafeEqual(supplied, expected)) throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    let decoded: unknown;
    try { decoded = JSON.parse(raw.toString("utf8")); }
    catch { throw new AppError(400, "Instagram webhook payload is invalid.", "INVALID_INSTAGRAM_WEBHOOK"); }
    const parsed = payload.safeParse(decoded);
    if (!parsed.success) throw new AppError(400, "Instagram webhook payload is invalid.", "INVALID_INSTAGRAM_WEBHOOK");
    const envelopes = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    let workload = 0;
    for (const item of envelopes) for (const candidate of item.entry) {
      const messaging = typeof candidate === "object" && candidate !== null ? (candidate as { messaging?: unknown }).messaging : undefined;
      workload += Array.isArray(messaging) ? messaging.length : 1;
      if (workload > 200) throw new AppError(413, "Instagram webhook batch is too large.", "INSTAGRAM_WEBHOOK_BATCH_LIMIT");
    }
    let processed = 0, duplicate = 0, ignored = 0;
    for (const item of envelopes) for (const rawEntry of item.entry) {
      const validEntry = entry.safeParse(rawEntry);
      if (!validEntry.success) { ignored++; continue; }
      const batch = validEntry.data;
      for (const candidate of batch.messaging ?? []) {
      const checked = message.safeParse(candidate);
      if (!checked.success) { ignored++; continue; }
      const event = checked.data;
      const dm = event.message;
      const text = dm?.text?.trim();
      if (!dm || dm.is_echo || dm.is_self || dm.is_deleted || dm.is_unsupported || event.sender.id === batch.id || event.recipient.id !== batch.id || !text) { ignored++; continue; }
      if (!env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID) throw new AppError(404, "Instagram connector is unavailable.", "INSTAGRAM_CONNECTOR_UNAVAILABLE");
      const assetInput = { capability: "INSTAGRAM_MESSAGES" as const, provider: "META" as const, assetType: "INSTAGRAM_ACCOUNT" as const, assetId: batch.id };
      const asset = await resolveMetaAsset(assetInput, env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID);
      const connector = await prisma.integrationConnector.findFirst({ where: { id: asset.connectorId, organizationId: asset.organizationId, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: { gt: new Date() } }, select: { id: true, organizationId: true, createdById: true } });
      if (!connector) throw new AppError(404, "Instagram connector is unavailable.", "INSTAGRAM_CONNECTOR_UNAVAILABLE");
      try {
        const outcome = await prisma.$transaction(async tx => {
          // ponytail: JSON sender lookup is fine for private tests; add a conversation table/index when volume warrants it.
          const lockKey = createHash("sha256").update(`${connector.organizationId}:${batch.id}:${event.sender.id}`).digest().readBigInt64BE();
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})::text`;
          await tx.$queryRaw`SELECT id FROM "MetaConnectedAsset" WHERE id = ${asset.id}::uuid FOR UPDATE`;
          const current = await resolveMetaAsset(assetInput, env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID, tx);
          if (current.id !== asset.id || current.connectorId !== connector.id || current.organizationId !== connector.organizationId) throw new AppError(409, "Instagram connection changed.", "INSTAGRAM_BINDING_CHANGED");
          const active = await tx.integrationConnector.findFirst({ where: { id: connector.id, organizationId: connector.organizationId, provider: "META_INSTAGRAM_DM", status: "ACTIVE", credentialStatus: "PRIVATE_TEST_READY", accessTokenEncrypted: { not: null }, credentialExpiresAt: { gt: new Date() }, externalAccountRef: batch.id, deletedAt: null }, select: { id: true } });
          if (!active) throw new AppError(409, "Instagram connection changed.", "INSTAGRAM_BINDING_CHANGED");
          const binding = await tx.metaConnectedAsset.findFirst({ where: { id: asset.id, connectorId: connector.id, organizationId: connector.organizationId, assetId: batch.id, routingStatus: "ACTIVE", releasedAt: null }, select: { webhookCutoverAt: true } });
          // No skew allowance: unknown/missing timestamps and pre-cutover deliveries fail closed.
          if (!binding?.webhookCutoverAt || event.timestamp < binding.webhookCutoverAt.getTime()) return "ignored" as const;
          const record = await tx.integrationEvent.create({ data: {
            organizationId: connector.organizationId, connectorId: connector.id, externalEventId: `${batch.id}:${dm.mid}`,
            eventName: "INSTAGRAM_DM", kind: "INQUIRY", status: "VERIFIED", signatureVerified: true,
            payload: { senderId: event.sender.id, accountId: batch.id }, payloadHash: createHash("sha256").update(raw).digest("hex"),
            createdById: connector.createdById, updatedById: connector.createdById,
          } });
          const prior = await tx.integrationEvent.findFirst({ where: {
            organizationId: connector.organizationId, connectorId: connector.id, id: { not: record.id }, eventName: "INSTAGRAM_DM", status: "COMPLETED", resultType: "INQUIRY", resultId: { not: null },
            AND: [{ payload: { path: ["senderId"], equals: event.sender.id } }, { payload: { path: ["accountId"], equals: batch.id } }],
          }, select: { resultId: true }, orderBy: { createdAt: "desc" } });
          const existing = prior?.resultId ? await tx.inquiry.findFirst({ where: { id: prior.resultId, organizationId: connector.organizationId, deletedAt: null }, select: { id: true } }) : null;
          const inquiry = existing ?? await tx.inquiry.create({ data: {
            organizationId: connector.organizationId, source: "SOCIAL", status: "NEW", contactName: "Instagram contact",
            subject: "Instagram direct message", message: text, createdById: connector.createdById, updatedById: connector.createdById,
            timeline: { create: { organizationId: connector.organizationId, type: "CREATED", summary: "Captured from Instagram DM", createdById: connector.createdById } },
          }, select: { id: true } });
          if (existing) await tx.inquiryTimeline.create({ data: { organizationId: connector.organizationId, inquiryId: inquiry.id, type: "NOTE", summary: "Instagram DM received", details: text, createdById: connector.createdById } });
          await tx.integrationEvent.update({ where: { id: record.id }, data: { status: "COMPLETED", resultType: "INQUIRY", resultId: inquiry.id, processedAt: new Date(), updatedById: connector.createdById } });
          await tx.integrationConnector.update({ where: { id: connector.id }, data: { lastReceivedAt: new Date(), lastSuccessfulAt: new Date(), updatedById: connector.createdById } });
          return "processed" as const;
        });
        if (outcome === "ignored") ignored++; else processed++;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await prisma.integrationEvent.findFirst({ where: { organizationId: connector.organizationId, connectorId: connector.id, externalEventId: `${batch.id}:${dm.mid}`, eventName: "INSTAGRAM_DM", payload: { path: ["accountId"], equals: batch.id } }, select: { id: true } })) duplicate++;
        else throw error;
      }
      }
    }
    return { accepted: true, processed, duplicate, ignored };
  }
}
