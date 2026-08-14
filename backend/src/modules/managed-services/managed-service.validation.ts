import { z } from "zod";

export const managedServiceUpdateSchema = z
  .object({
    status: z.enum([
      "SUBMITTED",
      "TRIAGED",
      "IN_PROGRESS",
      "WAITING_CUSTOMER",
      "AWAITING_CUSTOMER_APPROVAL",
      "COMPLETED",
      "CANCELED",
    ]),
    assignedToId: z.string().uuid().nullable(),
    customerUpdate: z.string().trim().min(2).max(4000),
    internalNote: z.string().trim().max(10000).nullable(),
  })
  .strict();

export type ManagedServiceUpdateInput = z.infer<
  typeof managedServiceUpdateSchema
>;

export const providerRequestUpdateSchema = managedServiceUpdateSchema;
export const providerReplySchema = z
  .object({
    type: z.enum(["PROVIDER_REPLY", "INTERNAL_NOTE"]),
    body: z.string().trim().min(1).max(10000),
  })
  .strict();
export type ProviderReplyInput = z.infer<typeof providerReplySchema>;

export const createProviderWorkSchema = z
  .object({
    assignedToId: z.string().uuid(),
    dueAt: z.string().datetime(),
    checklist: z.array(z.string().trim().min(2).max(240)).min(1).max(20),
  })
  .strict();
export const providerApprovalSchema = z
  .object({
    decision: z.enum([
      "REQUEST_INTERNAL",
      "REQUEST_CUSTOMER",
      "APPROVE",
      "REJECT",
    ]),
    note: z.string().trim().min(2).max(4000),
  })
  .strict();
export const providerCompletionSchema = z
  .object({
    summary: z.string().trim().min(5).max(5000),
    evidenceUrl: z.string().trim().url().max(500).nullable(),
    verification: z.string().trim().min(3).max(5000),
  })
  .strict();
export type CreateProviderWorkInput = z.infer<typeof createProviderWorkSchema>;
export type ProviderApprovalInput = z.infer<typeof providerApprovalSchema>;
export type ProviderCompletionInput = z.infer<typeof providerCompletionSchema>;
