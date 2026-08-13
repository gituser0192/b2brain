import { z } from "zod";

export const websiteFormConfigSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300),
  submitLabel: z.string().trim().min(1).max(40),
  successMessage: z.string().trim().min(2).max(240),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  askService: z.boolean(),
  serviceLabel: z.string().trim().min(1).max(60),
}).strict();

export const websiteLeadSchema = z.object({
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal("")).transform((value) => value || null),
  phone: z.string().trim().min(7).max(40).optional().or(z.literal("")).transform((value) => value || null),
  service: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
  message: z.string().trim().min(3).max(4000),
  website: z.string().max(0).optional().default(""),
  startedAt: z.coerce.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (!value.email && !value.phone)
    context.addIssue({ code: "custom", path: ["email"], message: "Enter an email address or phone number." });
});

export type WebsiteFormConfigInput = z.infer<typeof websiteFormConfigSchema>;
export type WebsiteLeadInput = z.infer<typeof websiteLeadSchema>;
