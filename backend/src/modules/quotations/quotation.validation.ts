import { z } from "zod";

const dateTime = z
  .string()
  .datetime()
  .transform((value) => new Date(value));
const optionalId = z.string().uuid().optional().nullable();
const lineItem = z
  .object({
    description: z.string().trim().min(1).max(300),
    quantity: z.number().positive().max(1_000_000),
    unitPrice: z.number().min(0).max(1_000_000_000),
  })
  .strict();

export const quotationSchema = z
  .object({
    customerId: z.string().uuid(),
    inquiryId: optionalId,
    dealId: optionalId,
    quotationNumber: z.string().trim().min(1).max(40),
    issueDate: dateTime,
    validUntil: dateTime,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    discount: z.number().min(0),
    tax: z.number().min(0),
    notes: z
      .string()
      .trim()
      .max(4_000)
      .optional()
      .transform((value) => value || null),
    terms: z
      .string()
      .trim()
      .max(4_000)
      .optional()
      .transform((value) => value || null),
    nextFollowUpAt: dateTime.optional().nullable(),
    items: z.array(lineItem).min(1).max(100),
  })
  .strict()
  .refine((value) => value.validUntil >= value.issueDate, {
    path: ["validUntil"],
    message: "Validity date must follow the issue date.",
  });

export const quotationStatusSchema = z
  .object({
    status: z.enum(["SENT", "ACCEPTED", "REJECTED", "CANCELED"]),
  })
  .strict();

export const quotationShareSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP", "LINK"]),
  connectorId: z.string().uuid().optional().nullable(),
}).strict().superRefine((value, context) => {
  if (value.channel === "WHATSAPP" && !value.connectorId)
    context.addIssue({ code: "custom", path: ["connectorId"], message: "Select a WhatsApp connector." });
});

export const quotationPublicDecisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  note: z.string().trim().max(1000).optional().nullable().transform(value => value || null),
}).strict();

export const quotationFollowUpSchema = z
  .object({
    dueAt: dateTime,
    note: z.string().trim().min(2).max(2_000),
  })
  .strict();

export const quotationConversionSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1).max(40),
    issueDate: dateTime,
    dueDate: dateTime,
  })
  .strict()
  .refine((value) => value.dueDate >= value.issueDate, {
    path: ["dueDate"],
    message: "Invoice due date must follow its issue date.",
  });

export type QuotationInput = z.infer<typeof quotationSchema>;
export type QuotationStatusInput = z.infer<typeof quotationStatusSchema>;
export type QuotationShareInput = z.infer<typeof quotationShareSchema>;
export type QuotationPublicDecisionInput = z.infer<typeof quotationPublicDecisionSchema>;
export type QuotationFollowUpInput = z.infer<typeof quotationFollowUpSchema>;
export type QuotationConversionInput = z.infer<
  typeof quotationConversionSchema
>;
