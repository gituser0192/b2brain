import { z } from "zod";

const optionalUuid = z.string().uuid().optional().nullable().transform((value) => value || null);
export const leadAssignmentRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  source: z.enum(["MANUAL", "WEBSITE", "WHATSAPP", "EMAIL", "PHONE", "SOCIAL", "REFERRAL", "STORE", "OTHER"]).optional().nullable().default(null),
  inquiryType: z.enum(["UNCLASSIFIED", "SALES", "PRODUCT_QUESTION", "SUPPORT", "COMPLAINT", "ORDER_REQUEST", "PARTNERSHIP", "SPAM", "OTHER"]).optional().nullable().default(null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().nullable().default(null),
  campaignId: optionalUuid,
  strategy: z.enum(["FIXED", "ROUND_ROBIN"]),
  eligibleEmployeeIds: z.array(z.string().uuid()).min(1).max(100),
  responseTimeMinutes: z.number().int().min(5).max(43200),
  escalationAfterMinutes: z.number().int().min(5).max(43200).optional().nullable().default(null),
  escalationEmployeeId: optionalUuid,
}).strict().superRefine((value, context) => {
  if (value.strategy === "FIXED" && value.eligibleEmployeeIds.length !== 1) context.addIssue({ code: "custom", path: ["eligibleEmployeeIds"], message: "Fixed assignment requires exactly one employee." });
  if (value.escalationAfterMinutes && !value.escalationEmployeeId) context.addIssue({ code: "custom", path: ["escalationEmployeeId"], message: "Choose an escalation employee." });
});
export const manualLeadAssignmentSchema = z.object({ employeeId: z.string().uuid().nullable(), reason: z.string().trim().min(2).max(500), responseTimeMinutes: z.number().int().min(5).max(43200).optional().default(60) }).strict();
export type LeadAssignmentRuleInput = z.infer<typeof leadAssignmentRuleSchema>;
export type ManualLeadAssignmentInput = z.infer<typeof manualLeadAssignmentSchema>;
