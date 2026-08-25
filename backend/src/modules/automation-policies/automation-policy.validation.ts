import { z } from "zod";

const jsonObject = z.record(z.string(), z.unknown());

export const automationPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable().transform((value) => value || null),
  serviceCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,49}$/),
  eventCode: z.string().trim().regex(/^[A-Z][A-Z0-9_.]{1,79}$/),
  actionCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]),
  executionMode: z.enum(["ASSISTED", "APPROVAL_REQUIRED", "AUTOMATIC"]),
  conditions: jsonObject.default({}),
  actionConfig: jsonObject.default({}),
  priority: z.number().int().min(1).max(1000),
  cooldownMinutes: z.number().int().min(0).max(525600),
}).strict();

export const simulatePolicySchema = z.object({
  eventCode: z.string().trim().regex(/^[A-Z][A-Z0-9_.]{1,79}$/),
  sourceType: z.string().trim().min(2).max(80),
  sourceId: z.string().trim().max(200).optional().nullable().transform((value) => value || null),
  dedupeKey: z.string().trim().max(200).optional().nullable().transform((value) => value || null),
  payload: jsonObject.default({}),
}).strict();

export type AutomationPolicyInput = z.infer<typeof automationPolicySchema>;
export type SimulatePolicyInput = z.infer<typeof simulatePolicySchema>;
