import { z } from "zod";

export const createActivitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "WHATSAPP"]),
  summary: z.string().trim().min(1, "Summary is required.").max(200),
  details: z.string().trim().max(4000).optional().transform((value) => value || null),
  occurredAt: z.string().datetime().optional().transform((value) => value ? new Date(value) : new Date()),
}).strict();

export const createFollowUpSchema = z.object({
  title: z.string().trim().min(1, "Follow-up title is required.").max(200),
  description: z.string().trim().max(4000).optional().transform((value) => value || null),
  dueAt: z.string().datetime().transform((value) => new Date(value)),
}).strict();

export const updateFollowUpStatusSchema = z.object({ status: z.enum(["PENDING", "COMPLETED", "CANCELED"]) }).strict();
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpStatusInput = z.infer<typeof updateFollowUpStatusSchema>;
