import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";

export type PublicToolName = "public.calculate" | "public.weather" | "public.reference_search" | "public.currency_convert" | "public.web_search";
export type PublicResult = { toolName: PublicToolName; availability: "VERIFIED" | "UNAVAILABLE" | "FAILED"; provenance: "CALCULATION" | "EXTERNAL_SOURCE"; answer: string; external: boolean; retrievedAt?: string; source?: { name: string; url: string; updatedAt?: string }; details?: Record<string, string | number> };
export const publicToolRegistry: Record<PublicToolName, { category: string; provider: string; mode: "READ"; externalEffect: false; network: boolean; featureFlag: string | null; timeoutMs: number; maxBytes: number; cacheSeconds: number; rateLimitPerMinute: number; provenance: "CALCULATION" | "EXTERNAL_SOURCE"; citationsRequired: boolean; description: string }> = {
  "public.calculate": { category: "CALCULATOR", provider: "LOCAL", mode: "READ", externalEffect: false, network: false, featureFlag: null, timeoutMs: 0, maxBytes: 0, cacheSeconds: 0, rateLimitPerMinute: 30, provenance: "CALCULATION", citationsRequired: false, description: "Local deterministic arithmetic." },
  "public.weather": { category: "WEATHER", provider: "UNCONFIGURED", mode: "READ", externalEffect: false, network: true, featureFlag: "PUBLIC_INFORMATION_TOOLS_ENABLED", timeoutMs: 5000, maxBytes: 65536, cacheSeconds: 900, rateLimitPerMinute: 10, provenance: "EXTERNAL_SOURCE", citationsRequired: true, description: "Current weather and bounded forecast." },
  "public.reference_search": { category: "REFERENCE", provider: "UNCONFIGURED", mode: "READ", externalEffect: false, network: true, featureFlag: "PUBLIC_INFORMATION_TOOLS_ENABLED", timeoutMs: 5000, maxBytes: 65536, cacheSeconds: 3600, rateLimitPerMinute: 10, provenance: "EXTERNAL_SOURCE", citationsRequired: true, description: "Bounded public reference lookup." },
  "public.currency_convert": { category: "CURRENCY", provider: "UNCONFIGURED", mode: "READ", externalEffect: false, network: true, featureFlag: "PUBLIC_INFORMATION_TOOLS_ENABLED", timeoutMs: 5000, maxBytes: 32768, cacheSeconds: 3600, rateLimitPerMinute: 10, provenance: "EXTERNAL_SOURCE", citationsRequired: true, description: "Reference-only currency conversion." },
  "public.web_search": { category: "SEARCH", provider: "UNCONFIGURED", mode: "READ", externalEffect: false, network: true, featureFlag: "PUBLIC_INFORMATION_TOOLS_ENABLED", timeoutMs: 5000, maxBytes: 65536, cacheSeconds: 600, rateLimitPerMinute: 5, provenance: "EXTERNAL_SOURCE", citationsRequired: true, description: "Bounded public web search." },
};

const blocked = /(password|otp|access token|app secret|verify token|encryption key|webhook secret|@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d -]{8,}\d|my (?:customer|employee|crm|finance|invoice|project))/i;
const numeric = (value: string) => Number(value.replace(/[₹,$,]/g, ""));

function calculate(query: string): PublicResult {
  if (query.length > 256 || /(?:eval|function|javascript|<script|[{};`])/i.test(query)) throw new AppError(400, "Use a short arithmetic expression only.", "PUBLIC_CALCULATION_INVALID");
  const text = query.toLowerCase().replace(/,/g, ""), values = [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => numeric(match[0]));
  if (!values.length || values.length > 10) throw new AppError(400, "I need a bounded numeric expression.", "PUBLIC_CALCULATION_INVALID");
  let result: number, step: string;
  if (/average/.test(text)) { result = values.reduce((sum, value) => sum + value, 0) / values.length; step = `${values.join(" + ")} ÷ ${values.length}`; }
  else if (/(profit )?margin|markup/.test(text) && values.length >= 2) { const [cost, selling] = values; if (cost === 0 || selling === 0) throw new AppError(400, "Cost and selling price must be greater than zero.", "PUBLIC_CALCULATION_ZERO_DIVISION"); result = /markup/.test(text) ? (selling! - cost!) / cost! * 100 : (selling! - cost!) / selling! * 100; step = /markup/.test(text) ? `(${selling} - ${cost}) ÷ ${cost} × 100 markup` : `(${selling} - ${cost}) ÷ ${selling} × 100 margin`; }
  else if (/(gst|percent|percentage|discount|minus .*percent)/.test(text) && values.length >= 2) { const percentageFirst = /%.*(?:on|of)|percent(?:age)?.*(?:on|of)/.test(text), base = values[percentageFirst ? 1 : 0]!, rate = values[percentageFirst ? 0 : 1]!, amount = base * rate / 100; result = /discount|minus .*percent/.test(text) ? base - amount : /gst/.test(text) ? base + amount : amount; step = /gst/.test(text) ? `${base} + (${base} × ${rate} ÷ 100)` : /discount|minus .*percent/.test(text) ? `${base} - (${base} × ${rate} ÷ 100)` : `${base} × ${rate} ÷ 100`; }
  else { const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:\+|plus|add|minus|-|times|multiplied by|\*|divided by|\/|÷)\s*(-?\d+(?:\.\d+)?)/), leftText = match?.[1], rightText = match?.[2]; if (!match || !leftText || !rightText) throw new AppError(400, "Please clarify the arithmetic operation.", "PUBLIC_CALCULATION_AMBIGUOUS"); const left = numeric(leftText), right = numeric(rightText), operator = match[0].slice(leftText.length, match[0].length - rightText.length).trim(); if (/divided|\/|÷/.test(operator) && right === 0) throw new AppError(400, "Division by zero is not defined.", "PUBLIC_CALCULATION_ZERO_DIVISION"); result = /plus|add|\+/.test(operator) ? left + right : /times|multiplied|\*/.test(operator) ? left * right : /divided|\/|÷/.test(operator) ? left / right : left - right; step = `${left} ${operator} ${right}`; }
  if (!Number.isFinite(result) || Math.abs(result) > 1e15) throw new AppError(400, "The result is outside the supported range.", "PUBLIC_CALCULATION_OVERFLOW");
  return { toolName: "public.calculate", availability: "VERIFIED", provenance: "CALCULATION", answer: `${step} = ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(result)}.`, external: false, details: { result, calculation: step } };
}

export function executePublicTool(_context: WorkspaceAgentContext, toolName: PublicToolName, query: string): Promise<PublicResult> {
  return Promise.resolve().then(() => {
    if (toolName === "public.calculate") return calculate(query);
    if (blocked.test(query)) throw new AppError(400, "Private or credential-shaped information cannot be sent to a public provider.", "PUBLIC_QUERY_BLOCKED");
    if (!env.PUBLIC_INFORMATION_TOOLS_ENABLED) return { toolName, availability: "UNAVAILABLE", provenance: "EXTERNAL_SOURCE", answer: "This public-information provider is not configured. No external request was made.", external: true } as PublicResult;
    return { toolName, availability: "UNAVAILABLE", provenance: "EXTERNAL_SOURCE", answer: "A provider decision and server-side configuration are still required. No external request was made.", external: true } as PublicResult;
  });
}
