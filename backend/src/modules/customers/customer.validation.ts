import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const customerFields = {
  type: z.enum(["PERSON", "COMPANY"]),
  firstName: optionalText(80),
  lastName: optionalText(80),
  companyName: optionalText(160),
  email: z.string().trim().email("Enter a valid email address.").max(254).optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  website: z.string().trim().url("Enter a valid website URL.").max(300).optional().or(z.literal("")).transform((value) => value || null),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(30),
  country: optionalText(100),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  notes: optionalText(4000),
};

function names(input: { type: "PERSON" | "COMPANY"; firstName: string | null; companyName: string | null }, context: z.RefinementCtx) {
  if (input.type === "PERSON" && !input.firstName) context.addIssue({ code: "custom", path: ["firstName"], message: "First name is required for a person." });
  if (input.type === "COMPANY" && !input.companyName) context.addIssue({ code: "custom", path: ["companyName"], message: "Company name is required." });
}

export const createCustomerSchema = z.object(customerFields).strict().superRefine(names);
export const updateCustomerSchema = z.object(customerFields).strict().superRefine(names);
export const listCustomerQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  archived: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomerQuery = z.infer<typeof listCustomerQuerySchema>;
