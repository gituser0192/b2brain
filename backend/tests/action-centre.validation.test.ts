import { describe, expect, it } from "vitest";
import { recommendationDecisionSchema } from "../src/modules/action-centre/action-centre.validation.js";

describe("business action centre validation", () => {
  it("accepts controlled execution", () => expect(recommendationDecisionSchema.parse({ decision: "EXECUTE", note: null })).toMatchObject({ decision: "EXECUTE" }));
  it("requires a dismissal reason", () => expect(() => recommendationDecisionSchema.parse({ decision: "DISMISS", note: "" })).toThrow());
  it("rejects trusted identifiers", () => expect(() => recommendationDecisionSchema.parse({ decision: "EXECUTE", userId: crypto.randomUUID(), organizationId: crypto.randomUUID() })).toThrow());
});
