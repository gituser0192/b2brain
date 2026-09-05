import { describe, expect, it } from "vitest";
import { PythonWorkspaceReasoningProvider } from "../src/modules/workspace-agent/workspace-agent.python.js";

// Explicit opt-in, synthetic local FastAPI only. Never contacts a production endpoint.
const url = process.env.PYTHON_AGENT_TEST_URL;
describe("TypeScript to FastAPI wire contract", () => {
  it.runIf(url === "http://127.0.0.1:8017")("round-trips signed synthetic facts through the Python fake provider", async () => {
    const provider = new PythonWorkspaceReasoningProvider({ url: url!, secret: "synthetic-test-only-secret-not-a-real-key", timeoutMs: 3000, maxIterations: 1, maxOutputTokens: 700 });
    const result = await provider.analyze({ tenantKey: "synthetic-only", request: "What should I improve first?", conversationSummary: "", facts: [{ id: "health.score", label: "Business score", value: 50, period: "Today" }] });
    expect(result.source).toBe("DETERMINISTIC_FALLBACK");
    expect(result.evidenceReferences).toEqual(["health.score"]);
    expect(result.usage.totalTokens).toBe(0);
  });
});
