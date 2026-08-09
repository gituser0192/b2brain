import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null);
export const propertySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .transform((v) => v.toUpperCase()),
    address: z.string().trim().min(3).max(500),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: text(20),
    defaultDueDay: z.number().int().min(1).max(28),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase()),
  })
  .strict();
export const roomSchema = z
  .object({
    propertyId: z.string().uuid(),
    number: z.string().trim().min(1).max(30),
    floor: text(30),
    roomType: z.string().trim().min(2).max(60),
    monthlyRent: z.number().nonnegative(),
    securityDeposit: z.number().nonnegative(),
    bedLabels: z
      .array(z.string().trim().min(1).max(20))
      .min(1)
      .max(30)
      .transform((v) => [...new Set(v)]),
  })
  .strict();
export const residentSchema = z
  .object({
    propertyId: z.string().uuid(),
    bedId: z.string().uuid(),
    firstName: z.string().trim().min(2).max(100),
    lastName: text(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    emergencyName: text(160),
    emergencyPhone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || null),
    whatsappOptIn: z.boolean(),
    startDate: z
      .string()
      .date()
      .transform((v) => new Date(`${v}T00:00:00.000Z`)),
    endDate: z
      .string()
      .date()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
    monthlyRent: z.number().positive(),
    securityDeposit: z.number().nonnegative(),
    depositReceived: z.number().nonnegative(),
    dueDay: z.number().int().min(1).max(28),
  })
  .strict();
export const generateSchema = z
  .object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
  .strict();
export const paymentSchema = z
  .object({
    amount: z.number().positive(),
    method: z.enum([
      "CASH",
      "BANK_TRANSFER",
      "CARD",
      "UPI",
      "CHEQUE",
      "PAYMENT_GATEWAY",
      "OTHER",
    ]),
    reference: text(160),
    paidAt: z
      .string()
      .datetime()
      .transform((v) => new Date(v)),
    notes: text(1000),
  })
  .strict();
export const checkoutSchema = z
  .object({
    endDate: z
      .string()
      .date()
      .transform((v) => new Date(`${v}T00:00:00.000Z`)),
  })
  .strict();
export type PropertyInput = z.infer<typeof propertySchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type ResidentInput = z.infer<typeof residentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type GenerateInput = z.infer<typeof generateSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
