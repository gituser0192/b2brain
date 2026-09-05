import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { env } from "../src/config/env.js";
import { PythonWorkspaceReasoningProvider } from "../src/modules/workspace-agent/workspace-agent.python.js";
import { pythonRequestSchema, pythonResponseSchema } from "../src/modules/workspace-agent/workspace-agent.python-contract.js";
import { createWorkspaceReasoningProvider, DeterministicWorkspaceReasoningFallback, FallbackWorkspaceReasoningProvider } from "../src/modules/workspace-agent/workspace-agent.provider.js";
import { routeWorkspaceRequest } from "../src/modules/workspace-agent/workspace-agent.router.js";

const input = { tenantKey: "org-a-private", request: "Why is my business health falling?", conversationSummary: "private prior record", facts: [{ id: "health.score", label: "Score", value: 50, period: "Today" }] };
const secret = "synthetic-test-secret-never-used-for-deployment";
const options = { url: "http://127.0.0.1:8000", secret, timeoutMs: 100, maxIterations: 1, maxOutputTokens: 700 };
const answer = (id: string) => ({ contractVersion: "1", requestId: id, answer: "The supplied score needs context.", confidence: "LOW", evidenceReferences: ["health.score"], conclusions: [], recommendations: [], assumptions: [], missingInformation: ["Historical scores"], proposedToolCalls: [], requiresConfirmation: false, requiresHumanEscalation: false, escalationReason: null, providerUsage: { source: "REAL_AI", inputTokens: 10, outputTokens: 10, totalTokens: 20 } });
const transport = (change: Record<string, unknown> = {}) => vi.fn<typeof fetch>().mockImplementation((_url, init) => {
  if (typeof init?.body !== "string") throw new Error("Expected JSON body");
  const request = pythonRequestSchema.parse(JSON.parse(init.body) as unknown);
  return Promise.resolve(new Response(JSON.stringify({ ...answer(request.requestId), ...change }), { status: 200 }));
});

afterEach(() => vi.restoreAllMocks());

describe("Python reasoning boundary", () => {
  it("validates the same synthetic request fixture as Python", () => {
    const fixture: unknown = JSON.parse(readFileSync(new URL("../../agent-service/tests/contract-v1.json", import.meta.url), "utf8"));
    expect(pythonRequestSchema.parse(fixture).contractVersion).toBe("1");
    expect(pythonResponseSchema.parse(answer("00000000-0000-4000-8000-000000000001")).proposedToolCalls).toEqual([]);
  });
  it("signs exact bytes and excludes tenant IDs, history, credentials and raw records", async () => {
    const fetchImpl = transport();
    const result = await new PythonWorkspaceReasoningProvider({ ...options, fetchImpl }).analyze(input);
    const init = fetchImpl.mock.calls[0]![1]!;
    if (typeof init.body !== "string") throw new Error("Expected JSON body");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Agent-Signature"]).toBe(createHmac("sha256", secret).update(`POST\n/v1/reason\n${headers["X-Agent-Timestamp"]}\n${headers["X-Agent-Request-Id"]}\n${String(init.body)}`).digest("hex"));
    expect(String(init.body)).not.toContain(input.tenantKey);
    expect(String(init.body)).not.toContain(input.conversationSummary);
    expect(String(init.body)).not.toContain(secret);
    expect(result.source).toBe("REAL_AI");
  });
  it.each(["Count customers", "Show overdue tasks", "Show goals", "Calculate business health", "financial score", "forecast next month", "Add Rahul with phone 9876543210 to CRM"])("leaves deterministic request local: %s", (message) => {
    expect(routeWorkspaceRequest(message).aiRequired).toBe(false);
  });
  it.each([input.request, "What should I improve first?", "Explain my financial score.", "Create a practical plan to reach my monthly revenue goal.", "Mere leads aa rahe hain, lekin conversion kam hai aur follow-ups overdue hain. Pehle kya improve karun?"])("routes complex request: %s", (message) => {
    expect(routeWorkspaceRequest(message).aiRequired).toBe(true);
  });
  it.each([
    { contractVersion: "2" }, { requestId: "00000000-0000-4000-8000-000000000099" },
    { evidenceReferences: ["org-b.secret"] }, { proposedToolCalls: [{ name: "REFUND", arguments: { organizationId: "B" } }] },
    { proposedToolCalls: [{ name: "CREATE_TASK", arguments: { title: "test" } }], requiresConfirmation: false },
    { organizationId: "org-b" }, { providerUsage: { source: "REAL_AI", inputTokens: 0, outputTokens: 7000, totalTokens: 7000 } },
  ])("rejects invalid or unauthorized provider output and falls back", async (change) => {
    const provider = new FallbackWorkspaceReasoningProvider(new PythonWorkspaceReasoningProvider({ ...options, fetchImpl: transport(change) }), new DeterministicWorkspaceReasoningFallback());
    expect(await provider.analyze(input)).toMatchObject({ source: "DETERMINISTIC_FALLBACK", providerFailed: true, proposedToolActions: [] });
  });
  it("falls back on timeout without retrying writes or provider requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Timeout", "TimeoutError"));
    const provider = new FallbackWorkspaceReasoningProvider(new PythonWorkspaceReasoningProvider({ ...options, fetchImpl }), new DeterministicWorkspaceReasoningFallback());
    expect((await provider.analyze(input)).providerFailed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("enforces the iteration ceiling before network access", async () => {
    const fetchImpl = transport();
    await expect(new PythonWorkspaceReasoningProvider({ ...options, maxIterations: 0, fetchImpl }).analyze(input)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(pythonRequestSchema.safeParse({ maximumToolIterations: 2 }).success).toBe(false);
  });
  it("uses Python only with both flags and honors kill switches", () => {
    const saved = { ...env };
    try {
      Object.assign(env, { WORKSPACE_AI_PROVIDER: "disabled", WORKSPACE_AGENT_REASONING_BACKEND: "python", PYTHON_AGENT_ENABLED: false, WORKSPACE_AI_DETERMINISTIC_ONLY: false, WORKSPACE_AI_KILL_SWITCH: false, PYTHON_AGENT_SERVICE_URL: options.url, PYTHON_AGENT_SERVICE_SECRET: secret });
      expect(createWorkspaceReasoningProvider().name).not.toContain("python");
      env.PYTHON_AGENT_ENABLED = true;
      expect(createWorkspaceReasoningProvider().name).toBe("python-reasoning-v1");
      env.WORKSPACE_AI_KILL_SWITCH = true;
      expect(createWorkspaceReasoningProvider().name).not.toContain("python");
      env.WORKSPACE_AI_KILL_SWITCH = false;
      env.WORKSPACE_AGENT_REASONING_BACKEND = "typescript";
      expect(createWorkspaceReasoningProvider().name).not.toContain("python");
    } finally { Object.assign(env, saved); }
  });
});
