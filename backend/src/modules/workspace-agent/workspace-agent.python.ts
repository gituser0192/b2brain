import { createHmac, randomUUID } from "node:crypto";
import { pythonRequestSchema, pythonResponseSchema } from "./workspace-agent.python-contract.js";
import type { WorkspaceReasoningInput, WorkspaceReasoningProvider, WorkspaceReasoningResult } from "./workspace-agent.provider.js";

export class PythonWorkspaceReasoningProvider implements WorkspaceReasoningProvider {
  readonly enabled = true;
  readonly name = "python-reasoning-v1";
  constructor(private readonly options: { url: string; secret: string; timeoutMs: number; maxIterations: number; maxOutputTokens: number; fetchImpl?: typeof fetch }) {}

  async analyze(input: WorkspaceReasoningInput): Promise<WorkspaceReasoningResult> {
    if (this.options.maxIterations < 1) throw new Error("Reasoning is disabled.");
    const requestId = randomUUID();
    const data = pythonRequestSchema.parse({
      contractVersion: "1", requestId, message: input.request, languageHint: null,
      // Historical free text may contain data from permissions the caller no longer holds.
      // Do not forward it; contextual references must be rehydrated under current permissions.
      shortConversationSummary: "",
      structuredBusinessFacts: input.facts.filter((f) => !/^(health|finance|forecast)\./.test(f.id)),
      calculatedHealthResults: input.facts.filter((f) => f.id.startsWith("health.")),
      calculatedFinancialResults: input.facts.filter((f) => f.id.startsWith("finance.")),
      calculatedForecastResults: input.facts.filter((f) => f.id.startsWith("forecast.")),
      relevantProductHelp: [], allowedToolNames: [], permissionSafeRecordReferences: [],
      maximumToolIterations: this.options.maxIterations,
      responseConstraints: { evidenceOnly: true, noTools: true, maxOutputTokens: this.options.maxOutputTokens },
    });
    const body = JSON.stringify(data), timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", this.options.secret).update(`POST\n/v1/reason\n${timestamp}\n${requestId}\n${body}`).digest("hex");
    const response = await (this.options.fetchImpl ?? fetch)(`${this.options.url.replace(/\/$/, "")}/v1/reason`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs),
      headers: { "Content-Type": "application/json", "X-Agent-Timestamp": timestamp, "X-Agent-Request-Id": requestId, "X-Agent-Signature": signature }, body,
    });
    if (!response.ok || !response.body) throw new Error("Reasoning service unavailable.");
    const reader = response.body.getReader();
    let text = "", size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 65536) throw new Error("Reasoning response too large.");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel(); }
    const result = pythonResponseSchema.parse(JSON.parse(text) as unknown);
    const refs = new Set(input.facts.map((f) => f.id));
    if (result.requestId !== requestId || result.evidenceReferences.some((id) => !refs.has(id))) throw new Error("Invalid reasoning evidence.");
    if (result.providerUsage.outputTokens > this.options.maxOutputTokens || result.providerUsage.totalTokens !== result.providerUsage.inputTokens + result.providerUsage.outputTokens) throw new Error("Invalid reasoning usage.");
    return {
      answer: result.answer, confidence: result.confidence, evidenceReferences: result.evidenceReferences,
      conclusions: result.conclusions, recommendations: result.recommendations, assumptions: result.assumptions,
      missingData: result.missingInformation, proposedToolActions: [], requiresConfirmation: result.requiresConfirmation,
      requiresHumanEscalation: result.requiresHumanEscalation, source: result.providerUsage.source,
      providerName: this.name, model: null, usage: result.providerUsage,
    };
  }
}
