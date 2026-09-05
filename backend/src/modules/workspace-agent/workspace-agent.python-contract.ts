import { z } from "zod";

const fact = z.object({ id: z.string().min(1).max(120), label: z.string().min(1).max(200), value: z.union([z.string().max(500), z.number().finite(), z.null()]), period: z.string().max(120) }).strict();
const facts = z.array(fact).max(40);
const requestId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
// Phase 1 is explanation-only: no executable tool or record capability crosses this boundary.
export const pythonRequestSchema = z.object({
  contractVersion: z.literal("1"), requestId,
  message: z.string().min(1).max(4096), languageHint: z.enum(["en", "hi", "hinglish"]).nullable(),
  shortConversationSummary: z.string().max(2000), structuredBusinessFacts: facts,
  calculatedHealthResults: facts, calculatedFinancialResults: facts, calculatedForecastResults: facts,
  relevantProductHelp: z.array(z.string().max(500)).max(5),
  allowedToolNames: z.array(z.never()).max(0), permissionSafeRecordReferences: z.array(z.never()).max(0),
  maximumToolIterations: z.number().int().min(0).max(1),
  responseConstraints: z.object({ evidenceOnly: z.literal(true), noTools: z.literal(true), maxOutputTokens: z.number().int().min(200).max(2000) }).strict(),
}).strict();
export const pythonResponseSchema = z.object({
  answer: z.string().min(1).max(4000), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  evidenceReferences: z.array(z.string().min(1).max(120)).max(20),
  conclusions: z.array(z.string().min(1).max(500)).max(8),
  recommendations: z.array(z.object({ action: z.string().min(1).max(500), reason: z.string().min(1).max(500), expectedImpact: z.string().min(1).max(500) }).strict()).max(8),
  assumptions: z.array(z.string().min(1).max(500)).max(8),
  requiresConfirmation: z.boolean(), requiresHumanEscalation: z.boolean(),
  contractVersion: z.literal("1"), requestId,
  missingInformation: z.array(z.string().min(1).max(500)).max(10),
  proposedToolCalls: z.array(z.never()).max(0), escalationReason: z.string().max(500).nullable(),
  providerUsage: z.object({ source: z.enum(["REAL_AI", "DETERMINISTIC_FALLBACK"]), inputTokens: z.number().int().min(0).max(100000), outputTokens: z.number().int().min(0).max(2000), totalTokens: z.number().int().min(0).max(102000) }).strict(),
}).strict();

export type PythonRequest = z.infer<typeof pythonRequestSchema>;
