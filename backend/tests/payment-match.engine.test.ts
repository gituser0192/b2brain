import { describe, expect, it } from "vitest";
import { findExactPaymentMatch } from "../src/modules/payment-collection/payment-match.engine.js";
const invoice = (id: string, invoiceNumber: string, email = "buyer@example.com") => ({ id, invoiceNumber, total: 100, customerEmail: email, payments: [] });
describe("payment matching", () => {
  it("matches a unique invoice number in the provider reference", () => expect(findExactPaymentMatch({ externalReference: "UPI INV-001 8844", payerContact: null, amount: 50 }, [invoice("1", "INV-001")])).toEqual({ matched: true, invoiceId: "1" }));
  it("matches a unique email and exact outstanding amount", () => expect(findExactPaymentMatch({ externalReference: "UTR-1", payerContact: "BUYER@example.com", amount: 100 }, [invoice("1", "INV-001")])).toEqual({ matched: true, invoiceId: "1" }));
  it("does not guess when more than one invoice matches", () => expect(findExactPaymentMatch({ externalReference: "UTR-1", payerContact: "buyer@example.com", amount: 100 }, [invoice("1", "INV-001"), invoice("2", "INV-002")])).toEqual({ matched: false, reason: "AMBIGUOUS" }));
});
