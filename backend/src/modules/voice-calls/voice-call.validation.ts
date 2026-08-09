import { z } from "zod";

export const createVoiceCallSchema = z.object({
  agentId: z.string().uuid(),
  customerId: z.string().uuid(),
  followUpId: z.string().uuid().optional().nullable(),
  language: z.enum(["en-IN", "hi-IN", "en-US"]),
  objective: z.string().trim().min(10).max(500),
  approvedScript: z.string().trim().min(20).max(8000),
  scheduledAt: z.string().datetime().optional().nullable().transform((value) => value ? new Date(value) : null),
}).strict();

export type CreateVoiceCallInput = z.infer<typeof createVoiceCallSchema>;
