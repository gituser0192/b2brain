import { describe, expect, it } from "vitest";
import { orderSchema } from "../src/modules/orders/order.validation.js";

const order = { customerId: crypto.randomUUID(), orderNumber: "ORD-001", currency: "inr", discount: 0, shipping: 0, source: "Website", notes: "", shippingAddress: "", items: [{ catalogueItemId: crypto.randomUUID(), quantity: 2 }] };
describe("order validation", () => {
  it("normalizes safe order input", () => expect(orderSchema.parse(order)).toMatchObject({ currency: "INR", notes: null }));
  it("requires at least one item", () => expect(() => orderSchema.parse({ ...order, items: [] })).toThrow());
  it("rejects trusted server fields", () => expect(() => orderSchema.parse({ ...order, organizationId: crypto.randomUUID(), total: 1, createdById: crypto.randomUUID() })).toThrow());
});
