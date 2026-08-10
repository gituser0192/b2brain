import { describe, expect, it } from "vitest";
import {
  quotationConversionSchema,
  quotationSchema,
  quotationStatusSchema,
} from "../src/modules/quotations/quotation.validation.js";

const base = {
  customerId: crypto.randomUUID(),
  inquiryId: null,
  dealId: null,
  quotationNumber: "Q-001",
  issueDate: "2026-08-10T00:00:00.000Z",
  validUntil: "2026-08-25T00:00:00.000Z",
  currency: "inr",
  discount: 100,
  tax: 180,
  notes: "Real customer quotation",
  terms: "Payment due in 15 days",
  nextFollowUpAt: null,
  items: [
    { description: "Website development", quantity: 1, unitPrice: 10_000 },
  ],
};

describe("quotation validation", () => {
  it("accepts a complete quotation and normalizes currency", () =>
    expect(quotationSchema.parse(base).currency).toBe("INR"));
  it("rejects validity before issue date", () =>
    expect(() =>
      quotationSchema.parse({
        ...base,
        validUntil: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow());
  it("rejects frontend ownership fields", () =>
    expect(() =>
      quotationSchema.parse({ ...base, organizationId: crypto.randomUUID() }),
    ).toThrow());
  it("allows only controlled lifecycle actions", () => {
    expect(quotationStatusSchema.parse({ status: "ACCEPTED" }).status).toBe(
      "ACCEPTED",
    );
    expect(() =>
      quotationStatusSchema.parse({ status: "CONVERTED" }),
    ).toThrow();
  });
  it("validates invoice conversion dates", () =>
    expect(() =>
      quotationConversionSchema.parse({
        invoiceNumber: "INV-1",
        issueDate: "2026-08-10T00:00:00.000Z",
        dueDate: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow());
});
