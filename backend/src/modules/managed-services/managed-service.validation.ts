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

export type ManagedServiceUpdateInput = z.infer<typeof managedServiceUpdateSchema>;
