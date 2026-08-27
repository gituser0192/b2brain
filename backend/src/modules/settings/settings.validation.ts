import { z } from "zod";

export const personalProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().nullable().transform(value => value || null),
}).strict();

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().min(2).max(100).optional().nullable().transform(value => value || null),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/).optional().nullable().or(z.literal("")).transform(value => value || null),
  businessSize: z.enum(["JUST_ME", "2_TO_10", "11_TO_50", "51_TO_200", "201_PLUS"]).optional().nullable(),
  monthlyRevenueRange: z.enum(["PRE_REVENUE", "UNDER_1_LAKH", "1_TO_5_LAKH", "5_TO_25_LAKH", "25_LAKH_TO_1_CRORE", "ABOVE_1_CRORE"]).optional().nullable(),
  primaryBusinessGoal: z.enum(["GROW_SALES", "IMPROVE_MARKETING", "MANAGE_CUSTOMERS", "CONTROL_FINANCES", "AUTOMATE_OPERATIONS", "MANAGE_TEAM"]).optional().nullable(),
  timezone: z.enum(["Asia/Kolkata", "UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore"]),
  currency: z.enum(["INR", "USD", "GBP", "EUR", "AED", "SGD"]),
}).strict();

const password = z.string().min(8).max(128).regex(/[A-Za-z]/, "Password must contain a letter.").regex(/[0-9]/, "Password must contain a number.");
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict().refine(value => value.currentPassword !== value.newPassword, { path: ["newPassword"], message: "New password must be different." });

export type PersonalProfileInput = z.infer<typeof personalProfileSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
