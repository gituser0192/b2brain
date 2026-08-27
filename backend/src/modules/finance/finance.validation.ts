import { z } from "zod";

const dateTime = z.string().datetime().transform((value) => new Date(value));
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().transform((value) => value || null);
const currency = z.string().trim().length(3).transform((value) => value.toUpperCase());
const paymentMethod = z.enum(["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE", "OTHER"]);

export const invoiceSchema = z.object({
  customerId: z.string().uuid(), projectId: z.string().uuid().nullable(), invoiceNumber: z.string().trim().min(1).max(40),
  status: z.enum(["DRAFT", "ISSUED", "CANCELED"]), issueDate: dateTime, dueDate: dateTime, currency,
  discount: z.number().min(0), tax: z.number().min(0), notes: optionalText(4_000),
  items: z.array(z.object({ description: z.string().trim().min(1).max(300), quantity: z.number().positive(), unitPrice: z.number().min(0) }).strict()).min(1).max(100),
}).strict().refine((value) => value.dueDate >= value.issueDate, { path: ["dueDate"], message: "Due date must follow issue date." });

export const paymentSchema = z.object({ amount: z.number().positive(), method: paymentMethod, reference: optionalText(120), paidAt: dateTime }).strict();
export const expenseSchema = z.object({
  projectId: z.string().uuid().nullable(), title: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(100),
  vendor: optionalText(160), amount: z.number().positive(), currency, expenseDate: dateTime,
  status: z.enum(["RECORDED", "VOIDED"]), notes: optionalText(4_000),
}).strict();
export const financeLedgerQuerySchema = z.object({
  from: z.string().datetime().optional().transform((value) => value ? new Date(value) : undefined),
  to: z.string().datetime().optional().transform((value) => value ? new Date(value) : undefined),
  type: z.enum(["REVENUE", "EXPENSE"]).optional(), category: z.string().trim().max(100).optional(), method: paymentMethod.optional(),
}).strict().refine((value) => !value.from || !value.to || value.to >= value.from, { path: ["to"], message: "End date must follow start date." });

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type FinanceLedgerQuery = z.infer<typeof financeLedgerQuerySchema>;
