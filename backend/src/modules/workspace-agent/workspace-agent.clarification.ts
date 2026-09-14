import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

const payloadSchema = z.object({ version: z.literal(1), id: z.string().uuid(), organizationId: z.string().uuid(), userId: z.string().uuid(), conversationId: z.string().uuid(), expiresAt: z.number().int(), choices: z.array(z.object({ label: z.string().min(1).max(80), request: z.string().min(1).max(240) }).strict()).max(3) }).strict();
type Payload = z.infer<typeof payloadSchema>;
const signature = (payload: string) => createHmac("sha256", env.JWT_ACCESS_SECRET).update(`workspace-agent-clarification:${payload}`).digest("base64url");

export function createWorkspaceAgentClarification(input: Pick<Payload, "organizationId" | "userId" | "conversationId" | "choices">) {
  const value = payloadSchema.parse({ ...input, version: 1, id: randomUUID(), expiresAt: Date.now() + 5 * 60_000 });
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return { token: `${payload}.${signature(payload)}`, expiresAt: new Date(value.expiresAt).toISOString() };
}

export function verifyWorkspaceAgentClarification(token: string, context: { organizationId: string; userId: string }, conversationId: string, choice: number) {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) throw new AppError(400, "This clarification is invalid.", "CLARIFICATION_INVALID");
  const expected = signature(payload), a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(400, "This clarification is invalid.", "CLARIFICATION_INVALID");
  let value: Payload;
  try { value = payloadSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); }
  catch { throw new AppError(400, "This clarification is invalid.", "CLARIFICATION_INVALID"); }
  if (value.expiresAt <= Date.now()) throw new AppError(409, "This clarification has expired.", "CLARIFICATION_EXPIRED");
  if (value.organizationId !== context.organizationId || value.userId !== context.userId || value.conversationId !== conversationId) throw new AppError(403, "This clarification belongs to another conversation.", "CLARIFICATION_CONTEXT_MISMATCH");
  const selected = value.choices[choice];
  if (!selected) throw new AppError(400, "Choose one of the available clarification options.", "CLARIFICATION_INVALID");
  return selected.request;
}
