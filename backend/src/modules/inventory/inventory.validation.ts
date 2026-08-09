import { z } from "zod";

export const warehouseSchema = z.object({
  code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(1000).optional().transform((value) => value || null),
}).strict();

export const stockAdjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  catalogueItemId: z.string().uuid(),
  type: z.enum(["OPENING", "RECEIPT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RETURN"]),
  quantity: z.number().positive().max(100000000),
  reorderPoint: z.number().min(0).max(100000000).optional(),
  reason: z.string().trim().min(2).max(300),
}).strict();

export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
