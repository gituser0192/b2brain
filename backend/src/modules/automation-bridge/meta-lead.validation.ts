import { z } from "zod";

export const metaId = z.string().trim().min(1).max(64).regex(/^\d+$/);
export const metaLeadConnectorSchema = z.object({ pageId: metaId, allowedFormIds: z.array(metaId).max(100).default([]), pageAccessToken: z.string().trim().min(20).max(2000) }).strict();
export type MetaLeadConnectorInput = z.infer<typeof metaLeadConnectorSchema>;
const bounded = z.string().trim().max(1000);
export const metaGraphLeadSchema = z.object({ id: metaId, created_time: z.string().datetime(), ad_id: metaId.optional(), campaign_id: metaId.optional(), form_id: metaId, field_data: z.array(z.object({ name: z.string().trim().min(1).max(100), values: z.array(bounded).max(10) }).strict()).max(100) }).strict();
export type MetaGraphLead = z.infer<typeof metaGraphLeadSchema>;
export const metaWebhookSchema = z.object({ object: z.literal("page"), entry: z.array(z.object({ id: metaId, time: z.number().int().positive(), changes: z.array(z.object({ field: z.literal("leadgen"), value: z.object({ leadgen_id: metaId, page_id: metaId, form_id: metaId, created_time: z.number().int().positive(), ad_id: metaId.optional() }).strict() }).strict()).max(25) }).strict()).max(25) }).strict();
