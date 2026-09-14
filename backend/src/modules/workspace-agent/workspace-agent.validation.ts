import { z } from "zod";

export const workspaceAgentMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    externalMessageId: z.string().trim().min(3).max(240),
    message: z.string().trim().min(1).max(4096),
    confirmation: z.object({ token: z.string().min(32).max(12_000), decision: z.enum(["CONFIRM", "CANCEL"]) }).strict().optional(),
  })
  .strict();

export type WorkspaceAgentMessage = z.infer<typeof workspaceAgentMessageSchema>;
