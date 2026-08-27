import { describe, expect, it } from "vitest";
import { leadToCashConfig } from "../src/modules/automation-bridge/lead-to-cash-automation.service.js";

describe("lead-to-cash automation configuration", () => {
  it("uses safe defaults for an empty policy", () => {
    expect(leadToCashConfig({})).toEqual({ dealAmount: 0, currency: "INR", probability: 20, followUpHours: 24 });
  });

  it("normalizes configured commercial values", () => {
    expect(leadToCashConfig({ dealAmount: 125000, currency: "usd", probability: 65.4, followUpHours: 2.6 }))
      .toEqual({ dealAmount: 125000, currency: "USD", probability: 65, followUpHours: 3 });
  });

  it("clamps unsafe values", () => {
    expect(leadToCashConfig({ dealAmount: -10, currency: "rupees", probability: 500, followUpHours: 0 }))
      .toEqual({ dealAmount: 0, currency: "INR", probability: 100, followUpHours: 1 });
  });
});
