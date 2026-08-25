import { z } from "zod";

export const recommendationDecisionSchema = z
  .object({
    decision: z.enum(["EXECUTE", "DISMISS", "SNOOZE"]),
    note: z.string().trim().max(1000).optional().nullable(),
    snoozedUntil: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "DISMISS" && !value.note)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Give a reason for dismissing this recommendation.",
      });
    if (
      value.decision === "SNOOZE" &&
      (!value.snoozedUntil || new Date(value.snoozedUntil) <= new Date())
    )
      context.addIssue({
        code: "custom",
        path: ["snoozedUntil"],
        message: "Choose a future snooze time.",
      });
  });

export type RecommendationDecisionInput = z.infer<
  typeof recommendationDecisionSchema
>;
