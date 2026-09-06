import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).optional();
export const websiteOrderSchema = z.object({
  version: z.literal("1"), eventId: z.string().trim().min(3).max(240), submittedAt: z.string().datetime(),
  externalOrderId: z.string().trim().min(1).max(200),
  customer: z.object({ name: text(160), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()).optional(), phone: z.string().trim().max(40).transform(v => v.replace(/\D/g, "")).refine(v => /^[1-9]\d{6,14}$/.test(v), "Invalid phone number.").optional() }).strict().refine(v => Boolean(v.email || v.phone), "A contact method is required."),
  items: z.array(z.object({ sku: z.string().trim().min(1).max(100), quantity: z.number().int().positive().max(10_000), notes: text(500), displayUnitPrice: z.number().nonnegative().max(1_000_000_000).optional() }).strict()).min(1).max(50).superRefine((items, context) => { const skus = items.map(i => i.sku.toLowerCase()); if (new Set(skus).size !== skus.length) context.addIssue({ code: "custom", message: "Duplicate SKU lines are not allowed." }); }),
  currency: z.string().trim().length(3).transform(v => v.toUpperCase()), customerNotes: text(2000), shippingAddress: text(1000),
  attribution: z.object({ source: text(100), medium: text(100), campaign: text(160) }).strict().optional(),
  submittedTotal: z.number().nonnegative().max(1_000_000_000).optional(),
}).strict();
export type WebsiteOrderInput = z.infer<typeof websiteOrderSchema>;
