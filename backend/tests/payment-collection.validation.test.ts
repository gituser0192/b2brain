import { describe, expect, it } from "vitest";
import { ignoreIncomingPaymentSchema, incomingPaymentSchema, paymentAccountSchema, reconcileSchema, refundSchema } from "../src/modules/payment-collection/payment-collection.validation.js";

describe("payment collection validation", () => {
  it("accepts a payment account without client ownership fields", () => expect(paymentAccountSchema.parse({ name: "Primary UPI", type: "UPI", identifier: "billing@example", bankName: "", accountLast4: "", instructions: "", isActive: true }).type).toBe("UPI"));
  it("rejects organization identity supplied by the client", () => expect(() => paymentAccountSchema.parse({ name: "Primary UPI", type: "UPI", identifier: "billing@example", bankName: "", accountLast4: "", instructions: "", isActive: true, organizationId: crypto.randomUUID() })).toThrow());
  it("normalizes incoming payment currency", () => expect(incomingPaymentSchema.parse({ paymentAccountId: crypto.randomUUID(), externalReference: "UTR-123", payerName: "Customer", payerContact: "", amount: 500, currency: "inr", receivedAt: new Date().toISOString(), notes: "" }).currency).toBe("INR"));
  it("requires a server-resolved invoice id for reconciliation", () => expect(reconcileSchema.parse({ invoiceId: crypto.randomUUID() }).invoiceId).toBeTruthy());
  it("requires a reason before ignoring money", () => { expect(ignoreIncomingPaymentSchema.parse({ reason: "Duplicate of a manually recorded payment" }).reason).toContain("Duplicate"); expect(() => ignoreIncomingPaymentSchema.parse({ reason: "" })).toThrow(); });
  it("requires a meaningful refund reason", () => expect(() => refundSchema.parse({ amount: 100, reason: "bad" })).toThrow());
});
