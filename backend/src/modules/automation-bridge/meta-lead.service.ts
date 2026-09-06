import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret } from "./bridge.crypto.js";
import { HttpMetaLeadGraphClient, type MetaLeadGraphClient } from "./meta-lead.graph.js";
import { metaWebhookSchema, type MetaGraphLead } from "./meta-lead.validation.js";
import { normalizedInboundEventSchema } from "./contracts/inbound-event.contract.js";
import { InboundEventProcessor } from "./processing/inbound-event.processor.js";

const standard = new Set(["full_name", "first_name", "last_name", "email", "phone_number", "company_name", "message", "requirement"]);
const clean = (value: string, max: number) => value.trim().slice(0, max);

export class MetaLeadService {
  constructor(private readonly graph: MetaLeadGraphClient = new HttpMetaLeadGraphClient(), private readonly processor = new InboundEventProcessor()) {}
  verify(mode: unknown, token: unknown, challenge: unknown) {
    if (!env.META_LEAD_ADS_ENABLED || mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !env.META_LEAD_VERIFY_TOKEN) throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    const supplied = createHash("sha256").update(token).digest(), expected = createHash("sha256").update(env.META_LEAD_VERIFY_TOKEN).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new AppError(403, "Webhook verification failed.", "WEBHOOK_VERIFICATION_FAILED");
    return challenge;
  }
  signature(raw: Buffer | undefined, header: string | undefined) {
    if (!raw || raw.length === 0 || raw.length > 256 * 1024) throw new AppError(413, "Meta webhook payload is invalid.", "INVALID_META_WEBHOOK");
    if (!env.META_LEAD_ADS_ENABLED || !env.EXTERNAL_CHANNELS_ENABLED || !env.META_LEAD_APP_SECRET || !header?.startsWith("sha256=")) throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    const expected = `sha256=${createHmac("sha256", env.META_LEAD_APP_SECRET).update(raw).digest("hex")}`;
    if (header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
  }
  async accept(raw: Buffer | undefined, signature: string | undefined, body: unknown) {
    this.signature(raw, signature);
    if (body && typeof body === "object" && "organizationId" in body) throw new AppError(400, "Meta webhook payload is invalid.", "INVALID_META_WEBHOOK");
    const payload = metaWebhookSchema.parse(body), references = payload.entry.flatMap(entry => entry.changes.map(change => change.value));
    if (references.length > 50) throw new AppError(413, "Meta webhook payload is invalid.", "INVALID_META_WEBHOOK");
    const results = []; for (const reference of references) results.push(await this.process(reference));
    return { accepted: true, processed: results.length };
  }
  private async process(reference: { leadgen_id: string; page_id: string; form_id: string; created_time: number; ad_id?: string | undefined }) {
    const connectors = await prisma.integrationConnector.findMany({ where: { metaPageId: reference.page_id, type: "SOCIAL", provider: "META_LEAD_ADS", status: "ACTIVE", deletedAt: null, organization: { status: "ACTIVE", deletedAt: null } }, select: { id: true, organizationId: true, createdById: true, accessTokenEncrypted: true, credentialsConfiguredAt: true, configuration: true }, take: 2 });
    if (connectors.length !== 1) throw new AppError(404, "Meta lead intake is unavailable.", "META_LEAD_UNAVAILABLE");
    const connector = connectors[0]!, configuration = connector.configuration as { metaLeadAllowedFormIds?: string[]; metaLeadAuthorizationVerified?: boolean; metaLeadFieldMapping?: string[] };
    if (!connector.accessTokenEncrypted || !connector.credentialsConfiguredAt || !configuration.metaLeadAuthorizationVerified) throw new AppError(404, "Meta lead intake is unavailable.", "META_LEAD_UNAVAILABLE");
    if (configuration.metaLeadAllowedFormIds?.length && !configuration.metaLeadAllowedFormIds.includes(reference.form_id)) throw new AppError(404, "Meta lead intake is unavailable.", "META_LEAD_UNAVAILABLE");
    const lead = await this.graph.retrieve(reference.leadgen_id, decryptSecret(connector.accessTokenEncrypted));
    if (lead.id !== reference.leadgen_id || lead.form_id !== reference.form_id) throw new AppError(409, "Meta lead identity requires review.", "META_LEAD_IDENTITY_CONFLICT");
    const normalized = this.fields(lead, configuration.metaLeadFieldMapping ?? []), receivedAt = new Date().toISOString();
    const event = normalizedInboundEventSchema.parse({ version: "1", channel: "META_LEAD_AD", eventType: "LEAD_CAPTURED", externalEventId: lead.id, occurredAt: lead.created_time, receivedAt, connectorId: connector.id, sender: normalized.sender, content: { text: normalized.message }, metadata: { pageIdHash: createHash("sha256").update(reference.page_id).digest("hex"), formId: reference.form_id, ...(lead.ad_id ? { adId: lead.ad_id } : {}), ...(lead.campaign_id ? { campaignId: lead.campaign_id } : {}) }, correlationId: crypto.randomUUID() });
    const result = await this.processor.processVerifiedMetaLead(connector.organizationId, connector.createdById, event);
    await prisma.integrationConnector.update({ where: { id: connector.id }, data: { lastReceivedAt: new Date(), lastSuccessfulAt: new Date(), lastErrorMessage: null, updatedById: connector.createdById } });
    return { duplicate: result.duplicate, correlationId: event.correlationId };
  }
  private fields(lead: MetaGraphLead, allowedCustom: string[]) {
    const values = new Map<string, string>();
    for (const field of lead.field_data) if (standard.has(field.name) || allowedCustom.includes(field.name)) values.set(field.name, clean(field.values[0] ?? "", 1000));
    const name = clean(values.get("full_name") || `${values.get("first_name") ?? ""} ${values.get("last_name") ?? ""}`, 160) || undefined;
    const email = values.get("email")?.toLowerCase().slice(0, 254), phone = values.get("phone_number")?.replace(/\D/g, "").slice(0, 15);
    const message = clean(values.get("message") || values.get("requirement") || `Meta lead submitted${values.get("company_name") ? ` for ${values.get("company_name")}` : ""}.`, 4096);
    return { sender: { ...(name ? { name } : {}), ...(email ? { email } : {}), ...(phone && /^[1-9]\d{6,14}$/.test(phone) ? { phone } : {}) }, message };
  }
}
