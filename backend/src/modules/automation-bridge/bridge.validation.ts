import { z } from "zod";
export const connectorSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    type: z.enum([
      "WHATSAPP",
      "WEBSITE",
      "COMMERCE",
      "PAYMENT",
      "EMAIL",
      "SOCIAL",
      "CUSTOM",
    ]),
    provider: z.string().trim().min(2).max(100),
    externalAccountRef: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ERROR"]),
    mode: z.enum(["MANUAL_APPROVAL", "ASSISTED", "POLICY_LIMITED"]),
  })
  .strict();
export const intakeSchema = z
  .object({
    externalEventId: z.string().trim().min(1).max(240),
    eventName: z.string().trim().min(1).max(160),
    kind: z.enum([
      "INQUIRY",
      "SUPPORT_REQUEST",
      "COMPLAINT",
      "SALES_OPPORTUNITY",
      "ORDER_REQUEST",
      "ORDER",
      "PAYMENT",
      "REFUND",
      "WEBSITE_CHANGE",
      "UNKNOWN",
      "SPAM",
    ]),
    contactName: z
      .string()
      .trim()
      .max(160)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    phone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    subject: z
      .string()
      .trim()
      .max(240)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    message: z
      .string()
      .trim()
      .max(8000)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    raw: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      [
        "INQUIRY",
        "SUPPORT_REQUEST",
        "COMPLAINT",
        "SALES_OPPORTUNITY",
        "ORDER_REQUEST",
      ].includes(v.kind) &&
      (!v.contactName || (!v.email && !v.phone) || !v.subject || !v.message)
    )
      c.addIssue({
        code: "custom",
        path: ["message"],
        message:
          "Communication events require contact, email or phone, subject, and message.",
      });
  });
export const eventDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "IGNORE", "QUARANTINE"]),
    reason: z.string().trim().min(2).max(1000),
  })
  .strict();
export type ConnectorInput = z.infer<typeof connectorSchema>;
export type IntakeInput = z.infer<typeof intakeSchema>;
export type EventDecisionInput = z.infer<typeof eventDecisionSchema>;
export const whatsappCredentialsSchema=z.object({phoneNumberId:z.string().trim().min(5).max(100),businessAccountId:z.string().trim().min(5).max(100),accessToken:z.string().trim().min(20).max(1000),appSecret:z.string().trim().min(10).max(500)}).strict();export const messageDraftSchema=z.object({eventId:z.string().uuid().optional().nullable(),recipient:z.string().trim().regex(/^\+?[1-9]\d{6,14}$/),body:z.string().trim().min(1).max(4096)}).strict();export type WhatsappCredentialsInput=z.infer<typeof whatsappCredentialsSchema>;export type MessageDraftInput=z.infer<typeof messageDraftSchema>;
