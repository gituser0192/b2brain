import { z } from "zod";

export const createServiceRequestSchema = z.object({
  category: z.enum(["PLAN_BILLING", "WEBSITE", "CRM", "MARKETING", "AUTOMATION", "FINANCE", "PROJECTS", "TECHNICAL_SUPPORT", "OTHER"]),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(10000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
}).strict();

export const customerServiceMessageSchema = z.object({ body: z.string().trim().min(1).max(10000) }).strict();

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type CustomerServiceMessageInput = z.infer<typeof customerServiceMessageSchema>;
