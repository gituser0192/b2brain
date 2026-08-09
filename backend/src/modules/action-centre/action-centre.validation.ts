import { z } from "zod";

export const recommendationDecisionSchema = z
  .object({
    decision: z.enum(["EXECUTE", "DISMISS"]),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "DISMISS" && !value.note)
      context.addIssue({ code: "custom", path: ["note"], message: "Give a reason for dismissing this recommendation." });
  });

export type RecommendationDecisionInput = z.infer<typeof recommendationDecisionSchema>;
