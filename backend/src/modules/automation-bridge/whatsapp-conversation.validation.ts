import { z } from "zod";

export const whatsappConversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
}).strict();

export const whatsappConversationIdSchema = z.string().uuid();
export type WhatsappConversationListQuery = z.infer<typeof whatsappConversationListQuerySchema>;
