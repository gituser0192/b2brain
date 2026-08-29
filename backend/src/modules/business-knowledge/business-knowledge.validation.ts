import { z } from "zod";

export const knowledgeCategories = [
  "BUSINESS_OVERVIEW",
  "SERVICE",
  "PRODUCT",
  "PRICING",
  "BUSINESS_HOURS",
  "LOCATION",
  "SERVICE_AREA",
  "FAQ",
  "BOOKING_CONTACT",
  "REFUND_POLICY",
  "CANCELLATION_POLICY",
  "OTHER_POLICY",
  "ADDITIONAL",
] as const;
export const knowledgeInputSchema = z
  .object({
    category: z.enum(knowledgeCategories),
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(2).max(5000),
  })
  .strict();
export type KnowledgeInput = z.infer<typeof knowledgeInputSchema>;
