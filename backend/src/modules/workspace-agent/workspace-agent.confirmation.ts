import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

const customerArguments = z.object({ displayName: z.string().min(2).max(80), phone: z.string().regex(/^\d{7,17}$/) }).strict();
const escalationArguments = z.object({ category: z.enum(["FINANCE", "TECHNICAL_SUPPORT"]), description: z.string().min(1).max(4096), priority: z.enum(["HIGH", "URGENT"]) }).strict();
const payloadSchema = z.discriminatedUnion("action", [
  z.object({ version: z.literal(1), id: z.string().uuid(), organizationId: z.string().uuid(), userId: z.string().uuid(), expiresAt: z.number().int(), action: z.literal("CUSTOMER_CREATE"), arguments: customerArguments }).strict(),
  z.object({ version: z.literal(1), id: z.string().uuid(), organizationId: z.string().uuid(), userId: z.string().uuid(), expiresAt: z.number().int(), action: z.literal("HUMAN_ESCALATION"), arguments: escalationArguments }).strict(),
]);

export type WorkspaceAgentConfirmation = z.infer<typeof payloadSchema>;

const signature = (payload: string) => createHmac("sha256", env.JWT_ACCESS_SECRET).update(`workspace-agent-confirmation:${payload}`).digest("base64url");

export function createWorkspaceAgentConfirmation(input: Omit<WorkspaceAgentConfirmation, "version" | "id" | "expiresAt">) {
  const value = payloadSchema.parse({ ...input, version: 1, id: randomUUID(), expiresAt: Date.now() + 10 * 60_000 });
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return { token: `${payload}.${signature(payload)}`, expiresAt: new Date(value.expiresAt).toISOString(), value };
}

export function verifyWorkspaceAgentConfirmation(token: string, context: { organizationId: string; userId: string }) {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) throw new AppError(400, "This confirmation is invalid.", "CONFIRMATION_INVALID");
  const expected = signature(payload);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(400, "This confirmation is invalid.", "CONFIRMATION_INVALID");
  let value: WorkspaceAgentConfirmation;
  try { value = payloadSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); }
  catch { throw new AppError(400, "This confirmation is invalid.", "CONFIRMATION_INVALID"); }
  if (value.expiresAt <= Date.now()) throw new AppError(409, "This confirmation has expired.", "CONFIRMATION_EXPIRED");
  if (value.organizationId !== context.organizationId || value.userId !== context.userId) throw new AppError(403, "This confirmation belongs to another workspace or user.", "CONFIRMATION_CONTEXT_MISMATCH");
  return value;
}
