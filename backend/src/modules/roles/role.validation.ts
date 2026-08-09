import { z } from "zod";

const permissionCodes = z.array(z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/)).min(1).max(50).transform((values) => [...new Set(values)]);

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().transform((value) => value || undefined),
  permissionCodes,
}).strict();

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  permissionCodes: permissionCodes.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one change.");

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
