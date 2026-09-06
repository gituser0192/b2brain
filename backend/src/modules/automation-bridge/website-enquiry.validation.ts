import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const safeUrl = z.string().trim().url().max(2048).refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Only HTTP(S) URLs are accepted.").optional();

export const websiteEnquirySchema = z.object({
  version: z.literal("1"),
  eventId: z.string().trim().min(3).max(240),
  submittedAt: z.string().datetime(),
  name: optionalText(160),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().max(40).transform((value) => value.replace(/\D/g, "")).refine((value) => /^[1-9]\d{6,14}$/.test(value), "Invalid phone number.").optional(),
  message: z.string().trim().min(1).max(4096),
  subject: optionalText(160),
  enquiryType: optionalText(80),
  pageUrl: safeUrl,
  referrer: safeUrl,
  consent: z.object({ marketing: z.boolean().optional(), privacy: z.boolean().optional() }).strict().optional(),
  utm: z.object({ source: optionalText(100), medium: optionalText(100), campaign: optionalText(160), term: optionalText(160), content: optionalText(160) }).strict().optional(),
  externalCustomerId: optionalText(200),
}).strict().refine((value) => Boolean(value.email || value.phone), { path: ["email"], message: "A valid email or phone number is required." });

export type WebsiteEnquiryInput = z.infer<typeof websiteEnquirySchema>;
