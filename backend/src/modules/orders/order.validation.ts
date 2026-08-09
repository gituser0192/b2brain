import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const orderSchema = z.object({
  customerId: z.string().uuid(),
  orderNumber: z.string().trim().min(1).max(40),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  discount: z.number().min(0),
  shipping: z.number().min(0),
  source: nullableText(80),
  notes: nullableText(4000),
  shippingAddress: nullableText(1000),
  items: z.array(z.object({
    catalogueItemId: z.string().uuid(),
    quantity: z.number().positive().max(100000),
  }).strict()).min(1).max(100),
}).strict();

export const orderStatusSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "PROCESSING", "FULFILLED", "CANCELED", "REFUNDED"]),
}).strict();

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
