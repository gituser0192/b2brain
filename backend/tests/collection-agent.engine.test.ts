import { describe, expect, it } from "vitest";
import { benchmarkCollectionAgent, evaluateCollection } from "../src/modules/agents/collection-agent.engine.js";
describe("collection agent engine", () => {
  it("calculates refunded balances and keeps actions gated", () => { const result = evaluateCollection({ total: 1000, paid: 800, refunded: 300, dueDate: new Date("2026-06-01"), customerName: "Test", invoiceNumber: "INV-1", currency: "INR" }, new Date("2026-08-20")); expect(result.outstanding).toBe(500); expect(result.risk).toBe("CRITICAL"); expect(result.externalActionPerformed).toBe(false); expect(result.paymentStatusChanged).toBe(false); });
  it("passes its benchmark", () => { const result = benchmarkCollectionAgent(10); expect(result.metrics.cases).toBe(50); expect(result.metrics.passRate).toBe(1); });
});
