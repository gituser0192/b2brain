import { z } from "zod";

export const salesQueueQuerySchema = z
  .object({
    scope: z.enum(["MINE", "TEAM"]).default("TEAM"),
    horizonDays: z.coerce.number().int().min(1).max(90).default(30),
  })
  .strict();

export type SalesQueueQuery = z.infer<typeof salesQueueQuerySchema>;
