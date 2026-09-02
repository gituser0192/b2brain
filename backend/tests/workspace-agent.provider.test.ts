import { describe, expect, it, vi } from "vitest";
import {
  DeterministicWorkspaceReasoningFallback,
  FallbackWorkspaceReasoningProvider,
  OpenAIWorkspaceReasoningProvider,
} from "../src/modules/workspace-agent/workspace-agent.provider.js";

const input = {
  tenantKey: "org-a",
  request: "Why is profit down?",
  conversationSummary: "",
  facts: [{ id: "finance.profit", label: "Profit", value: -100, period: "Current month" }],
};

describe("workspace hosted reasoning provider", () => {
  it("accepts strict grounded output and records usage", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          answer: "Profit is negative in the supplied current-month data.",
          evidenceReferences: ["finance.profit"], conclusions: ["Profit is negative."],
          recommendations: [], assumptions: [], missingData: [], confidence: "HIGH",
          proposedToolActions: [], requiresConfirmation: false, requiresHumanEscalation: false,
        }) }] }],
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      }),
    });
    const provider = new OpenAIWorkspaceReasoningProvider({
      apiKey: "secret", model: "test", baseUrl: "https://example.invalid/v1",
      timeoutMs: 1000, maxRetries: 0, maxOutputTokens: 500, maxInputChars: 4000,
      failureThreshold: 3, resetMs: 1000, fetchImpl,
    });
    const result = await provider.analyze(input);
    expect(result).toMatchObject({ source: "REAL_AI", usage: { totalTokens: 30 } });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("org-a");
  });

  it("falls back safely when output references unsupported evidence", async () => {
    const primary = { enabled: true, name: "bad", analyze: vi.fn().mockRejectedValue(new Error("bad output")) };
    const provider = new FallbackWorkspaceReasoningProvider(
      primary,
      new DeterministicWorkspaceReasoningFallback(),
    );
    const result = await provider.analyze(input);
    expect(result).toMatchObject({ source: "DETERMINISTIC_FALLBACK", providerFailed: true });
    expect(result.answer).toContain("verified data");
  });
});
