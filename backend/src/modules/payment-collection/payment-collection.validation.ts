import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);
const dateTime = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const paymentAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(["BANK", "UPI", "CASH", "PAYMENT_GATEWAY", "OTHER"]),
    identifier: z.string().trim().min(2).max(180),
    bankName: optional(120),
    accountLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional()
      .or(z.literal(""))
      .transform((value) => value || null),
    instructions: optional(2_000),
    isActive: z.boolean(),
  })
  .strict();

export const incomingPaymentSchema = z
  .object({
    paymentAccountId: z.string().uuid(),
    externalReference: z.string().trim().min(2).max(180),
    payerName: optional(160),
    payerContact: optional(180),
    amount: z.number().positive(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    receivedAt: dateTime,
    notes: optional(2_000),
  })
  .strict();

export const reconcileSchema = z
  .object({ invoiceId: z.string().uuid() })
  .strict();
export const refundSchema = z
  .object({
    amount: z.number().positive(),
    reason: z.string().trim().min(5).max(1_000),
  })
  .strict();
export const refundCompletionSchema = z
  .object({ reference: z.string().trim().min(2).max(180) })
  .strict();

export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;
export type IncomingPaymentInput = z.infer<typeof incomingPaymentSchema>;
export type ReconcileInput = z.infer<typeof reconcileSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type RefundCompletionInput = z.infer<typeof refundCompletionSchema>;
