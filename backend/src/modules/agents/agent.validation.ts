import { z } from "zod";

export const agentActions = ["CRM_CUSTOMER_READ", "CRM_FOLLOWUP_READ", "MESSAGE_DRAFT", "VOICE_CALL_PLAN", "VOICE_CALL_REQUEST", "CRM_ACTIVITY_CREATE", "CRM_FOLLOWUP_CREATE"] as const;
const fields = {
  name: z.string().trim().min(2, "Agent name is required.").max(100),
  purpose: z.string().trim().min(10, "Describe what this agent should accomplish.").max(500),
  instructions: z.string().trim().max(8000).optional().transform((value) => value || null),
  supportedService: z.enum(["CRM"]),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]),
  requiresApproval: z.boolean(),
  allowedActions: z.array(z.enum(agentActions)).max(agentActions.length).transform((actions) => [...new Set(actions)]),
  dailyRunLimit: z.number().int().min(0).max(1000),
  dailyContactLimit: z.number().int().min(0).max(500),
};
export const createAgentSchema = z.object(fields).strict();
export const updateAgentSchema = z.object(fields).strict();
export type AgentInput = z.infer<typeof createAgentSchema>;
