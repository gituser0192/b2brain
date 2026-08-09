import { z } from "zod";

const supportedTimezones = ["Asia/Kolkata", "UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore"] as const;
const supportedCurrencies = ["INR", "USD", "GBP", "EUR", "AED", "SGD"] as const;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(120).optional(),
  timezone: z.enum(supportedTimezones, { message: "Select a supported timezone." }).optional(),
  currency: z.enum(supportedCurrencies, { message: "Select a supported currency." }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update." });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
