import { describe, expect, it } from "vitest";
import { invoiceIssueSchema, invoiceSchema, paymentSchema } from "../src/modules/finance/finance.validation.js";

const invoice = { customerId: crypto.randomUUID(), projectId: null, invoiceNumber: " inv-101 ", status: "ISSUED", issueDate: "2026-08-09T00:00:00.000Z", dueDate: "2026-08-20T00:00:00.000Z", currency: "inr", discount: 0, tax: 180, notes: "", items: [{ description: "Monthly service", quantity: 1, unitPrice: 1000 }] };
describe("finance validation", () => {
  it("normalizes trusted invoice fields", () => { const result = invoiceSchema.parse(invoice); expect(result.currency).toBe("INR"); expect(result.notes).toBeNull(); });
  it("rejects tenant and audit identifiers", () => { expect(() => invoiceSchema.parse({ ...invoice, organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow(); });
  it("requires due dates to follow issue dates", () => { expect(() => invoiceSchema.parse({ ...invoice, dueDate: "2026-08-01T00:00:00.000Z" })).toThrow(); });
  it("allows a manually named counterparty only on an unlinked draft invoice", () => {
    const rest = { ...invoice };
    delete rest.customerId;
    expect(invoiceSchema.parse({ ...rest, customerName: "Walk-in customer", status: "DRAFT" }).customerName).toBe("Walk-in customer");
    expect(() => invoiceSchema.parse({ ...rest, customerName: "Walk-in customer", status: "ISSUED" })).toThrow();
    expect(() => invoiceSchema.parse({ ...invoice, customerName: "Different name" })).toThrow();
    expect(() => invoiceSchema.parse({ ...rest, status: "DRAFT" })).toThrow();
  });
  it("accepts a payment reference, limits money precision, and rejects invoice/tenant ownership fields", () => { expect(paymentSchema.parse({ amount: 500, method: "UPI", reference: "UTR-001", paidAt: "2026-08-09T10:00:00.000Z" }).reference).toBe("UTR-001"); expect(() => paymentSchema.parse({ amount: 500.001, method: "UPI", paidAt: "2026-08-09T10:00:00.000Z" })).toThrow(); expect(() => paymentSchema.parse({ amount: 500, method: "UPI", paidAt: "2026-08-09T10:00:00.000Z", organizationId: crypto.randomUUID() })).toThrow(); });
  it("accepts only a version precondition for explicit invoice issuance", () => {
    expect(invoiceIssueSchema.parse({ expectedUpdatedAt: "2026-08-09T10:00:00.000Z" }).expectedUpdatedAt).toBeInstanceOf(Date);
    expect(() => invoiceIssueSchema.parse({ organizationId: crypto.randomUUID() })).toThrow();
  });
});
