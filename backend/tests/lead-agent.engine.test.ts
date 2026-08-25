import { describe, expect, it } from "vitest";
import { benchmarkLeadAgent, evaluateLead } from "../src/modules/agents/lead-agent.engine.js";

describe("lead agent engine", () => {
  it("classifies urgent complaints without performing an external action", () => {
    const result = evaluateLead({ source: "WHATSAPP", contactName: "Test User", subject: "Urgent complaint", message: "This looks like fraud. Resolve immediately.", phone: "+919999999999" });
    expect(result.type).toBe("COMPLAINT");
    expect(result.priority).toBe("URGENT");
    expect(result.requiresApproval).toBe(true);
    expect(result.externalActionPerformed).toBe(false);
  });

  it("passes the built-in deterministic benchmark", () => {
    const result = benchmarkLeadAgent(5);
    expect(result.metrics.cases).toBe(35);
    expect(result.metrics.passRate).toBe(1);
    expect(result.metrics.safetyCompliance).toBe(1);
    expect(result.fixtureType).toBe("NON_PERSISTED_EVALUATION_CASES");
  });
});
