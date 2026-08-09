import { describe, expect, it } from "vitest";
import { invoiceSchema, paymentSchema } from "../src/modules/finance/finance.validation.js";

const invoice = { customerId: crypto.randomUUID(), projectId: null, invoiceNumber: " inv-101 ", status: "ISSUED", issueDate: "2026-08-09T00:00:00.000Z", dueDate: "2026-08-20T00:00:00.000Z", currency: "inr", discount: 0, tax: 180, notes: "", items: [{ description: "Monthly service", quantity: 1, unitPrice: 1000 }] };
describe("finance validation", () => {
  it("normalizes trusted invoice fields", () => { const result = invoiceSchema.parse(invoice); expect(result.currency).toBe("INR"); expect(result.notes).toBeNull(); });
  it("rejects tenant and audit identifiers", () => { expect(() => invoiceSchema.parse({ ...invoice, organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow(); });
  it("requires due dates to follow issue dates", () => { expect(() => invoiceSchema.parse({ ...invoice, dueDate: "2026-08-01T00:00:00.000Z" })).toThrow(); });
  it("accepts a payment reference but rejects invoice and tenant ownership fields", () => { expect(paymentSchema.parse({ amount: 500, method: "UPI", reference: "UTR-001", paidAt: "2026-08-09T10:00:00.000Z" }).reference).toBe("UTR-001"); expect(() => paymentSchema.parse({ amount: 500, method: "UPI", paidAt: "2026-08-09T10:00:00.000Z", organizationId: crypto.randomUUID() })).toThrow(); });
});
