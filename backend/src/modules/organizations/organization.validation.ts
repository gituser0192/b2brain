import { z } from "zod";

const supportedTimezones = ["Asia/Kolkata", "UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore"] as const;
const supportedCurrencies = ["INR", "USD", "GBP", "EUR", "AED", "SGD"] as const;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(120).optional(),
  timezone: z.enum(supportedTimezones, { message: "Select a supported timezone." }).optional(),
  currency: z.enum(supportedCurrencies, { message: "Select a supported currency." }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update." });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const completeOnboardingSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required.").max(120),
  ownerName: z.string().trim().min(2, "Owner name is required.").max(160),
  industry: z.string().trim().min(2, "Industry is required.").max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/, "Enter a valid phone number."),
  businessSize: z.enum(["JUST_ME", "2_TO_10", "11_TO_50", "51_TO_200", "201_PLUS"], { message: "Select a business size." }),
  monthlyRevenueRange: z.enum(["PRE_REVENUE", "UNDER_1_LAKH", "1_TO_5_LAKH", "5_TO_25_LAKH", "25_LAKH_TO_1_CRORE", "ABOVE_1_CRORE"], { message: "Select a monthly revenue range." }),
  primaryBusinessGoal: z.enum(["GROW_SALES", "IMPROVE_MARKETING", "MANAGE_CUSTOMERS", "CONTROL_FINANCES", "AUTOMATE_OPERATIONS", "MANAGE_TEAM"], { message: "Select a primary business goal." }),
  timezone: z.enum(supportedTimezones, { message: "Select a supported timezone." }).default("Asia/Kolkata"),
  currency: z.enum(supportedCurrencies, { message: "Select a supported currency." }).default("INR"),
}).strict();

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
