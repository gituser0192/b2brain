import { normalizedInboundEventSchema } from "./contracts/inbound-event.contract.js";
import { InboundEventProcessor } from "./processing/inbound-event.processor.js";
import { verifyWebsiteWebhook } from "./website-enquiry.service.js";
import { websiteOrderSchema } from "./website-order.validation.js";
import { AppError } from "../../shared/errors/app-error.js";

export class WebsiteOrderService {
  constructor(private readonly processor = new InboundEventProcessor()) {}
  async accept(publicId: string, rawBody: Buffer | undefined, signature: string | undefined, timestamp: string | undefined, eventId: string | undefined, body: unknown) {
    const verified = await verifyWebsiteWebhook(publicId, rawBody, signature, timestamp, eventId, 128 * 1024);
    const configuration = verified.connector.configuration as { websiteOrderIngestionEnabled?: boolean };
    if (!configuration.websiteOrderIngestionEnabled) throw new AppError(403, "Website order intake is unavailable.", "WEBSITE_ORDER_UNAVAILABLE");
    const input = websiteOrderSchema.parse(body);
    if (input.eventId !== verified.eventId) throw new AppError(400, "Website order payload is invalid.", "INVALID_WEBSITE_ORDER");
    const receivedAt = new Date().toISOString();
    const event = normalizedInboundEventSchema.parse({ version: "1", channel: "WEBSITE_ORDER", eventType: "ORDER_CREATED", externalEventId: input.eventId, occurredAt: input.submittedAt, receivedAt, connectorId: verified.connector.id, sender: input.customer, content: { text: input.customerNotes ?? `Website order ${input.externalOrderId}` }, metadata: {}, correlationId: crypto.randomUUID() });
    return this.processor.processVerifiedWebsiteOrder(verified.connector.organizationId, verified.connector.createdById, event, input);
  }
}
