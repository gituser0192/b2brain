import { z } from "zod";

export const normalizedInboundMessageSchema = z.object({
  channel: z.enum(["WEBSITE_PLAYGROUND", "WHATSAPP"]),
  externalMessageId: z.string().trim().min(3).max(240),
  conversationId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(160).optional().nullable(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
  message: z.string().trim().min(1).max(4096),
  receivedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).default({}),
}).strict();

export const agentDraftDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  editedBody: z.string().trim().min(1).max(4096).optional(),
  note: z.string().trim().min(2).max(500),
}).strict();

export const humanTakeoverSchema = z.object({
  conversationId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(500),
}).strict();

export type NormalizedInboundMessage = z.infer<typeof normalizedInboundMessageSchema>;
export type AgentDraftDecision = z.infer<typeof agentDraftDecisionSchema>;
export type HumanTakeoverInput = z.infer<typeof humanTakeoverSchema>;
