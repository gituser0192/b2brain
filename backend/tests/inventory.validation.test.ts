import { describe, expect, it } from "vitest";
import { stockAdjustmentSchema, warehouseSchema } from "../src/modules/inventory/inventory.validation.js";

describe("inventory validation", () => {
  it("normalizes a warehouse code", () => expect(warehouseSchema.parse({ code: "main", name: "Main warehouse", address: "" })).toMatchObject({ code: "MAIN", address: null }));
  it("accepts a controlled stock receipt", () => expect(stockAdjustmentSchema.parse({ warehouseId: crypto.randomUUID(), catalogueItemId: crypto.randomUUID(), type: "RECEIPT", quantity: 5, reorderPoint: 2, reason: "Supplier delivery" }).quantity).toBe(5));
  it("rejects tenant and audit identifiers", () => expect(() => stockAdjustmentSchema.parse({ warehouseId: crypto.randomUUID(), catalogueItemId: crypto.randomUUID(), type: "RECEIPT", quantity: 5, reason: "Delivery", organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow());
});
