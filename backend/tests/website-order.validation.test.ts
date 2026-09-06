import { describe, expect, it } from "vitest";
import { websiteOrderSchema } from "../src/modules/automation-bridge/website-order.validation.js";

const valid = { version: "1", eventId: "order-event-1", submittedAt: new Date().toISOString(), externalOrderId: "shop-1001", customer: { email: "Buyer@Example.Test", phone: "+91 98765-43210" }, currency: "inr", items: [{ sku: "COURSE-1", quantity: 2 }] };
describe("website order validation", () => {
  it("normalizes contact and currency", () => expect(websiteOrderSchema.parse(valid)).toMatchObject({ customer: { email: "buyer@example.test", phone: "919876543210" }, currency: "INR" }));
  it("rejects tenant, payment, totals and status authority", () => {
    for (const extra of [{ organizationId: crypto.randomUUID() }, { paymentStatus: "PAID" }, { status: "CONFIRMED" }, { discount: 50 }]) expect(() => websiteOrderSchema.parse({ ...valid, ...extra })).toThrow();
  });
  it("rejects missing contacts, invalid quantities, excessive or duplicate items", () => {
    expect(() => websiteOrderSchema.parse({ ...valid, customer: {} })).toThrow();
    for (const quantity of [0, -1, 10001, 1.5]) expect(() => websiteOrderSchema.parse({ ...valid, items: [{ sku: "COURSE-1", quantity }] })).toThrow();
    expect(() => websiteOrderSchema.parse({ ...valid, items: Array.from({ length: 51 }, (_, i) => ({ sku: `SKU-${i}`, quantity: 1 })) })).toThrow();
    expect(() => websiteOrderSchema.parse({ ...valid, items: [{ sku: "SAME", quantity: 1 }, { sku: "same", quantity: 2 }] })).toThrow();
  });
});
