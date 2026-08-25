import { z } from "zod";

export const agentActions = ["CRM_CUSTOMER_READ", "CRM_FOLLOWUP_READ", "INQUIRY_READ", "INQUIRY_CLASSIFY", "INQUIRY_ROUTE", "INQUIRY_RESPONSE_DRAFT", "FINANCE_INVOICE_READ", "COLLECTION_PRIORITIZE", "COLLECTION_DRAFT", "COLLECTION_FOLLOWUP_REQUEST", "MESSAGE_DRAFT", "VOICE_CALL_PLAN", "VOICE_CALL_REQUEST", "CRM_ACTIVITY_CREATE", "CRM_FOLLOWUP_CREATE"] as const;
const fields = {
  name: z.string().trim().min(2, "Agent name is required.").max(100),
  purpose: z.string().trim().min(10, "Describe what this agent should accomplish.").max(500),
  instructions: z.string().trim().max(8000).optional().transform((value) => value || null),
  supportedService: z.enum(["CRM", "LEADS", "FINANCE"]),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]),
  requiresApproval: z.boolean(),
  allowedActions: z.array(z.enum(agentActions)).max(agentActions.length).transform((actions) => [...new Set(actions)]),
  dailyRunLimit: z.number().int().min(0).max(1000),
  dailyContactLimit: z.number().int().min(0).max(500),
};
export const createAgentSchema = z.object(fields).strict();
export const updateAgentSchema = z.object(fields).strict();
export const leadAgentPreviewSchema = z.object({
  source: z.enum(["MANUAL", "WEBSITE", "WHATSAPP", "EMAIL", "PHONE", "SOCIAL", "REFERRAL", "STORE", "OTHER"]),
  contactName: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(240),
  message: z.string().trim().min(2).max(8000),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
}).strict().refine((value) => Boolean(value.email || value.phone), { path: ["email"], message: "Provide an email address or phone number." });
export const agentBenchmarkSchema = z.object({ iterations: z.number().int().min(1).max(100).default(10) }).strict();
export const collectionAgentPreviewSchema = z.object({ invoiceId: z.string().uuid() }).strict();
export const collectionAgentRunSchema = z.object({ invoiceId: z.string().uuid().optional().nullable().default(null) }).strict();
export const agentScheduleSchema = z.object({ enabled: z.boolean(), timezone: z.string().trim().min(3).max(100), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), maxInvoicesPerRun: z.number().int().min(1).max(25) }).strict();
export type AgentInput = z.infer<typeof createAgentSchema>;
export type LeadAgentPreviewInput = z.infer<typeof leadAgentPreviewSchema>;
export type AgentScheduleInput = z.infer<typeof agentScheduleSchema>;
