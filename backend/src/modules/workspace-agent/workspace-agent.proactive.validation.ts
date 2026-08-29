import { z } from "zod";

export const businessGoalSchema = z
  .object({
    type: z.enum([
      "MONTHLY_REVENUE",
      "NEW_LEADS",
      "CUSTOMER_CONVERSION",
      "EXPENSE_LIMIT",
      "PROJECT_COMPLETION",
      "FOLLOW_UP_RESPONSE",
    ]),
    title: z.string().trim().min(3).max(160),
    targetValue: z.number().positive().max(1_000_000_000_000),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.periodEnd) <= new Date(value.periodStart))
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "The goal end date must be after its start date.",
      });
  });

export type BusinessGoalInput = z.infer<typeof businessGoalSchema>;
