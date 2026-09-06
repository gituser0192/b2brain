import { z } from "zod";

const boundedMetadataValue = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const inboundChannelSchema = z.enum([
  "SIMULATOR",
  "WEBSITE",
  "WEBSITE_ORDER",
  "META_LEAD_AD",
  "WHATSAPP",
]);

export const normalizedInboundEventSchema = z
  .object({
    version: z.literal("1"),
    channel: inboundChannelSchema,
    eventType: z.literal("CUSTOMER_MESSAGE"),
    externalEventId: z.string().trim().min(3).max(240),
    occurredAt: z.string().datetime(),
    receivedAt: z.string().datetime(),
    connectorId: z.string().uuid(),
    sender: z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        phone: z
          .string()
          .trim()
          .transform(normalizePhone)
          .refine((value) => /^[1-9]\d{6,14}$/.test(value), "Invalid phone number.")
          .optional(),
        email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
      })
      .strict()
      .refine((sender) => Boolean(sender.phone || sender.email), "A normalized phone or email is required."),
    content: z.object({ text: z.string().trim().min(1).max(4096) }).strict(),
    metadata: z.record(z.string().max(80), boundedMetadataValue).default({}),
    correlationId: z.string().uuid(),
  })
  .strict()
  .superRefine((event, context) => {
    if (new Date(event.occurredAt).getTime() > new Date(event.receivedAt).getTime() + 5 * 60_000)
      context.addIssue({ code: "custom", path: ["occurredAt"], message: "Event time cannot be materially after receipt time." });
    if (JSON.stringify(event.metadata).length > 8_192)
      context.addIssue({ code: "custom", path: ["metadata"], message: "Metadata is too large." });
  });

export const reservedInboundEventTypes = [
  "WEBSITE_ENQUIRY",
  "ORDER_CREATED",
  "LEAD_CAPTURED",
  "MESSAGE_STATUS_UPDATED",
] as const;

export const inboundProcessingResultSchema = z.object({
  version: z.literal("1"),
  eventId: z.string().uuid(),
  processingStatus: z.enum(["COMPLETED", "FAILED", "PROCESSING"]),
  duplicate: z.boolean(),
  correlationId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  inquiryId: z.string().uuid().nullable(),
  followUpId: z.string().uuid().nullable(),
  classification: z.string().max(80).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  safeActionsExecuted: z.array(z.string().max(100)).max(20),
  actionsAwaitingApproval: z.array(z.string().max(100)).max(20),
  draftResponse: z.string().max(4096).nullable(),
  humanReviewRequired: z.boolean(),
  externalActionPerformed: z.literal(false),
}).strict();

export type NormalizedInboundEvent = z.infer<typeof normalizedInboundEventSchema>;
export type InboundProcessingResult = z.infer<typeof inboundProcessingResultSchema>;
