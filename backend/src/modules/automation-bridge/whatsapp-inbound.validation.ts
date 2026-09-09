import { z } from "zod";

const digitId = z.string().regex(/^\d{5,32}$/);
const timestamp = z.string().regex(/^\d{1,12}$/);
const senderPhone = z.string().trim().regex(/^\+?[\d ()-]{7,32}$/)
  .transform(value => value.replace(/\D/g, ""))
  .refine(value => /^[1-9]\d{6,14}$/.test(value));

const message = z.object({
  id: z.string().trim().min(3).max(240),
  from: senderPhone,
  type: z.string().trim().min(1).max(40),
  text: z.object({ body: z.string().trim().min(1).max(4096) }).strict().optional(),
  timestamp: timestamp.optional(),
}).passthrough();

const status = z.object({
  id: z.string().trim().min(3).max(240),
  status: z.string().trim().min(1).max(40),
  timestamp: timestamp.optional(),
  errors: z.array(z.object({ code: z.number().int().optional(), title: z.string().max(200).optional() }).passthrough()).max(10).optional(),
}).passthrough();

export const metaWhatsappWebhookSchema = z.object({
  object: z.string().max(80).optional(),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        metadata: z.object({ phone_number_id: digitId }).passthrough(),
        contacts: z.array(z.object({ profile: z.object({ name: z.string().trim().max(160).optional() }).passthrough().optional(), wa_id: z.string().regex(/^\d{7,15}$/).optional() }).passthrough()).max(10).optional(),
        messages: z.array(message).max(100).optional(),
        statuses: z.array(status).max(100).optional(),
      }).passthrough(),
    }).passthrough()).max(100),
  }).passthrough()).max(100),
}).passthrough();

export type MetaWhatsappWebhook = z.infer<typeof metaWhatsappWebhookSchema>;
