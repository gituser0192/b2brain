"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

type Output = {
  answer: string;
  duplicate?: boolean;
  metrics?: { label: string; value: number }[];
  warnings?: string[];
  suggestions?: string[];
  health?: {
    overall: number | null;
    components: { name: string; score: number; evidence: string }[];
    warnings: string[];
    recommendations: string[];
    period: string;
  };
  finance?: {
    currency: string;
    current: { revenue: number; expenses: number; profit: number };
    margin: number | null;
    score: number | null;
  };
  forecast?: {
    method: string;
    dateRange: string;
    confidence: string;
    assumptions: string[];
  };
  records?: { type: string; id: string; label: string }[];
  escalation?: { id: string; requestNumber: string; status: string };
  setup?: { step: string; completed: boolean };
};
type Item = { id: string; createdAt: string; message: string; output: Output };
const prompts = [
  "Check my business health",
  "Summarize revenue, expenses and profit",
  "Count all CRM customers",
  "What should I improve?",
  "How do I add a customer in CRM?",
];
const cash = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function WorkspaceAgent({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: (view: string) => void;
}) {
  const { session, authorizedRequest } = useAuth(),
    storageKey = `b2brain-agent-conversation:${session?.organization.id ?? "none"}:${session?.membership.id ?? "none"}`;
  const [conversationId] = useState(() => {
      if (typeof window === "undefined") return crypto.randomUUID();
      const saved = window.localStorage.getItem(storageKey),
        id = saved ?? crypto.randomUUID();
      window.localStorage.setItem(storageKey, id);
      return id;
    }),
    [items, setItems] = useState<Item[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await authorizedRequest<{ success: true; data: Item[] }>(
      `/workspace-agent/conversations/${conversationId}`,
    );
    setItems(response.data);
  }, [authorizedRequest, conversationId]);
  useEffect(() => {
    const task = window.setTimeout(
      () =>
        void load()
          .catch((reason) =>
            setError(
              reason instanceof ApiError
                ? reason.message
                : "Unable to load Ask B² Brain.",
            ),
          )
          .finally(() => setLoading(false)),
      0,
    );
    return () => window.clearTimeout(task);
  }, [load]);
  async function send(text = message) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest<{ success: true; data: Output }>(
        "/workspace-agent/messages",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId,
            externalMessageId: crypto.randomUUID(),
            message: text.trim(),
          }),
        },
      );
      setItems((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          message: text.trim(),
          output: response.data,
        },
      ]);
      setMessage("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Ask B² Brain could not complete that request safely.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className={`workspace-agent ${compact ? "compact" : "full"}`}>
      {!compact && (
        <header>
          <div>
            <p>B² Brain Agent</p>
            <h2>Ask B² Brain</h2>
            <span>Your organization-scoped Business Operating Agent.</span>
          </div>
          <div className="agent-trust">
            <span>✓ Permission aware</span>
            <span>✓ Organization isolated</span>
            <span>✓ Real business data</span>
          </div>
        </header>
      )}
      <div className="workspace-agent-thread">
        {items.length === 0 && !loading ? (
          <div className="workspace-agent-welcome">
            <div>✦</div>
            <h3>How can I help your business?</h3>
            <p>
              I can analyse permitted data, explain B² Brain and perform
              explicit low-risk actions.
            </p>
            <div>
              {prompts.map((prompt) => (
                <button key={prompt} onClick={() => void send(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="workspace-agent-exchange">
              <div className="workspace-user-message">
                <strong>You</strong>
                <p>{item.message}</p>
              </div>
              <div className="workspace-agent-answer">
                <header>
                  <span>✦</span>
                  <strong>Ask B² Brain</strong>
                </header>
                <p>{item.output.answer}</p>
                {item.output.metrics?.length ? (
                  <div className="workspace-metric-grid">
                    {item.output.metrics.map((metric) => (
                      <article key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </article>
                    ))}
                  </div>
                ) : null}
                {item.output.health && (
                  <div className="health-card">
                    <header>
                      <span>Business health</span>
                      <strong>
                        {item.output.health.overall === null
                          ? "Insufficient data"
                          : `${item.output.health.overall}/100`}
                      </strong>
                    </header>
                    {item.output.health.components.map((component) => (
                      <article key={component.name}>
                        <div>
                          <strong>{component.name}</strong>
                          <span>{component.evidence}</span>
                        </div>
                        <b>{Math.round(component.score)}/100</b>
                      </article>
                    ))}
                    {item.output.health.recommendations.length > 0 && (
                      <ol>
                        {item.output.health.recommendations.map((value) => (
                          <li key={value}>{value}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
                {item.output.finance && (
                  <div className="workspace-metric-grid">
                    <article>
                      <span>Revenue</span>
                      <strong>
                        {cash(
                          item.output.finance.current.revenue,
                          item.output.finance.currency,
                        )}
                      </strong>
                    </article>
                    <article>
                      <span>Expenses</span>
                      <strong>
                        {cash(
                          item.output.finance.current.expenses,
                          item.output.finance.currency,
                        )}
                      </strong>
                    </article>
                    <article>
                      <span>Profit</span>
                      <strong>
                        {cash(
                          item.output.finance.current.profit,
                          item.output.finance.currency,
                        )}
                      </strong>
                    </article>
                  </div>
                )}
                {item.output.forecast && (
                  <div className="forecast-card">
                    <strong>Transparent forecast</strong>
                    <span>
                      {item.output.forecast.method} ·{" "}
                      {item.output.forecast.dateRange} ·{" "}
                      {item.output.forecast.confidence.replaceAll("_", " ")}
                    </span>
                    <p>
                      Assumptions: {item.output.forecast.assumptions.join("; ")}
                    </p>
                  </div>
                )}
                {item.output.warnings?.map((warning) => (
                  <div className="agent-warning" key={warning}>
                    {warning}
                  </div>
                ))}
                {item.output.records?.map((record) => (
                  <button
                    className="agent-record-link"
                    key={`${record.type}:${record.id}`}
                    onClick={() => onNavigate?.("crm")}
                  >
                    Open {record.label} →
                  </button>
                ))}
                {item.output.escalation && (
                  <div className="agent-escalation">
                    <strong>Escalated to B² Brain team</strong>
                    <span>
                      {item.output.escalation.requestNumber} ·{" "}
                      {item.output.escalation.status.replaceAll("_", " ")}
                    </span>
                    <button onClick={() => onNavigate?.("b2help")}>
                      Track request
                    </button>
                  </div>
                )}
                {item.output.setup && (
                  <button
                    className="agent-record-link"
                    onClick={() => onNavigate?.("settings")}
                  >
                    Continue agent setup →
                  </button>
                )}
                <details>
                  <summary>Source and action details</summary>
                  <p>
                    Authenticated organization context and assigned permissions
                    were enforced by the backend. No organization ID was
                    accepted from this message.
                  </p>
                </details>
              </div>
            </article>
          ))
        )}
        {loading && (
          <div className="workspace-agent-thinking">
            <span className="spinner dark" />
            Ask B² Brain is checking permitted data…
          </div>
        )}
      </div>
      {error && <div className="dashboard-notice error">{error}</div>}
      <footer className="workspace-agent-composer">
        <textarea
          rows={compact ? 2 : 3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask about your business or request a safe action…"
          maxLength={4096}
        />
        <button
          disabled={loading || !message.trim()}
          onClick={() => void send()}
        >
          {loading ? "Working…" : "Send"}
        </button>
      </footer>
    </section>
  );
}
