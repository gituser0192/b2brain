import { describe, expect, it } from "vitest";
import { quotationAutomationConfig } from "../src/modules/quotations/quotation-automation.service.js";

describe("quotation automation configuration", () => {
  it("provides conservative defaults", () => {
    expect(quotationAutomationConfig({})).toEqual({ validDays: 7, taxPercent: 0, discount: 0, terms: "Subject to approval and the agreed scope of work." });
  });
  it("normalizes and clamps configured values", () => {
    expect(quotationAutomationConfig({ validDays: 120, taxPercent: 18, discount: -50, terms: "  Net 15  " }))
      .toEqual({ validDays: 90, taxPercent: 18, discount: 0, terms: "Net 15" });
  });
});
