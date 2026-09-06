import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret } from "./bridge.crypto.js";
import { normalizedInboundEventSchema } from "./contracts/inbound-event.contract.js";
import { InboundEventProcessor } from "./processing/inbound-event.processor.js";
import { websiteEnquirySchema } from "./website-enquiry.validation.js";

const REPLAY_WINDOW_SECONDS = 300;

export class WebsiteEnquiryService {
  constructor(private readonly processor = new InboundEventProcessor()) {}

  async accept(publicId: string, rawBody: Buffer | undefined, signature: string | undefined, timestampHeader: string | undefined, eventIdHeader: string | undefined, body: unknown) {
    if (!rawBody || rawBody.length === 0 || rawBody.length > 64 * 1024)
      throw new AppError(413, "Website enquiry payload is invalid.", "INVALID_WEBSITE_ENQUIRY");
    const connector = await prisma.integrationConnector.findFirst({
      where: { webhookKey: publicId, type: "WEBSITE", status: "ACTIVE", deletedAt: null },
      select: { id: true, organizationId: true, createdById: true, appSecretEncrypted: true },
    });
    if (!connector?.appSecretEncrypted)
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");

    const timestamp = Number(timestampHeader);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > REPLAY_WINDOW_SECONDS)
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");
    if (!eventIdHeader || eventIdHeader.length > 240 || !signature?.startsWith("v1="))
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");

    const expected = createHmac("sha256", decryptSecret(connector.appSecretEncrypted))
      .update(Buffer.concat([Buffer.from(`${timestamp}.${eventIdHeader}.`, "utf8"), rawBody]))
      .digest();
    const suppliedHex = signature.slice(3);
    const supplied = /^[a-f\d]{64}$/i.test(suppliedHex) ? Buffer.from(suppliedHex, "hex") : Buffer.alloc(0);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      throw new AppError(401, "Webhook authentication failed.", "INVALID_WEBHOOK_SIGNATURE");

    const input = websiteEnquirySchema.parse(body);
    if (input.eventId !== eventIdHeader)
      throw new AppError(400, "Website enquiry payload is invalid.", "INVALID_WEBSITE_ENQUIRY");
    const receivedAt = new Date().toISOString();
    const event = normalizedInboundEventSchema.parse({
      version: "1", channel: "WEBSITE", eventType: "WEBSITE_ENQUIRY", externalEventId: input.eventId,
      occurredAt: input.submittedAt, receivedAt, connectorId: connector.id,
      sender: { name: input.name, phone: input.phone, email: input.email }, content: { text: input.message },
      metadata: {
        ...(input.subject ? { subject: input.subject } : {}), ...(input.enquiryType ? { enquiryType: input.enquiryType } : {}),
        ...(input.pageUrl ? { pageUrl: input.pageUrl } : {}), ...(input.referrer ? { referrer: input.referrer } : {}),
        ...(input.externalCustomerId ? { externalCustomerId: input.externalCustomerId } : {}),
        ...(input.consent?.marketing !== undefined ? { marketingConsent: input.consent.marketing } : {}),
        ...(input.consent?.privacy !== undefined ? { privacyConsent: input.consent.privacy } : {}),
        ...(input.utm?.source ? { utmSource: input.utm.source } : {}), ...(input.utm?.medium ? { utmMedium: input.utm.medium } : {}),
        ...(input.utm?.campaign ? { utmCampaign: input.utm.campaign } : {}), ...(input.utm?.term ? { utmTerm: input.utm.term } : {}),
        ...(input.utm?.content ? { utmContent: input.utm.content } : {}),
      },
      correlationId: crypto.randomUUID(),
    });
    return this.processor.processVerifiedWebsite(connector.organizationId, connector.createdById, event);
  }
}
