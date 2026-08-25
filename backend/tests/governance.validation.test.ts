import { describe, expect, it } from "vitest";
import { decisionSchema } from "../src/modules/governance/governance.validation.js";

describe("governance decision validation", () => {
  it("accepts an approved edited collection message", () => {
    const result = decisionSchema.parse({ decision: "APPROVE", note: null, proposedMessage: "Please review the outstanding invoice balance." });
    expect(result.proposedMessage).toContain("outstanding");
  });

  it("requires a reason when returning a request", () => {
    expect(() => decisionSchema.parse({ decision: "RETURN", note: null })).toThrow();
  });

  it("rejects an unreasonably short customer message", () => {
    expect(() => decisionSchema.parse({ decision: "APPROVE", proposedMessage: "Pay now" })).toThrow();
  });
});
