import { z } from "zod";
const nullable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
export const inquirySchema = z
  .object({
    source: z.enum([
      "MANUAL",
      "WEBSITE",
      "WHATSAPP",
      "EMAIL",
      "PHONE",
      "SOCIAL",
      "REFERRAL",
      "STORE",
      "OTHER",
    ]),
    type: z.enum([
      "UNCLASSIFIED",
      "SALES",
      "PRODUCT_QUESTION",
      "SUPPORT",
      "COMPLAINT",
      "ORDER_REQUEST",
      "PARTNERSHIP",
      "SPAM",
      "OTHER",
    ]),
    status: z.enum(["NEW", "REVIEWING", "QUALIFIED", "DISQUALIFIED", "SPAM"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    contactName: z.string().trim().min(2).max(160),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => v || null),
    phone: nullable(40),
    companyName: nullable(160),
    subject: z.string().trim().min(2).max(240),
    message: z.string().trim().min(2).max(8000),
    campaignId: z.string().uuid().optional().nullable().default(null),
    assignedEmployeeId: z.string().uuid().optional().nullable().default(null),
    responseDueAt: z
      .string()
      .datetime()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(v) : null)),
    disqualifiedReason: nullable(1000),
  })
  .strict()
  .superRefine((v, c) => {
    if (!v.email && !v.phone)
      c.addIssue({
        code: "custom",
        path: ["email"],
        message: "Provide an email address or phone number.",
      });
    if (v.status === "DISQUALIFIED" && !v.disqualifiedReason)
      c.addIssue({
        code: "custom",
        path: ["disqualifiedReason"],
        message: "Give a reason for disqualification.",
      });
    if (v.type === "SPAM" && v.status !== "SPAM")
      c.addIssue({
        code: "custom",
        path: ["status"],
        message: "Spam inquiries must use Spam status.",
      });
  });
export const noteSchema = z
  .object({ note: z.string().trim().min(2).max(4000) })
  .strict();
export const conversionSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("CUSTOMER") }).strict(),
  z
    .object({
      target: z.literal("DEAL"),
      name: z.string().trim().min(2).max(200),
      amount: z.number().nonnegative(),
      currency: z.string().trim().length(3),
      probability: z.number().int().min(0).max(100),
      expectedCloseDate: z.string().date().optional().nullable(),
    })
    .strict(),
  z
    .object({
      target: z.literal("SUPPORT"),
      subject: z.string().trim().min(2).max(240),
      description: z.string().trim().min(2).max(8000),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    })
    .strict(),
]);
export type InquiryInput = z.infer<typeof inquirySchema>;
export type ConversionInput = z.infer<typeof conversionSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
