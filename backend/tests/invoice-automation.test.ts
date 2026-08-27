import { describe, expect, it } from "vitest";
import { invoiceAutomationConfig } from "../src/modules/finance/invoice-automation.service.js";

describe("invoice automation configuration", () => {
  it("uses safe payment defaults", () => expect(invoiceAutomationConfig({})).toEqual({ dueDays: 7, emailNote: "Please use the agreed payment method and include the invoice number as the payment reference." }));
  it("normalizes configured terms", () => expect(invoiceAutomationConfig({ dueDays: 120, emailNote: "  Pay by bank transfer  " })).toEqual({ dueDays: 90, emailNote: "Pay by bank transfer" }));
});
