"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { WorkspaceAgentHeader } from "./workspace-agent-header";
import { BusinessBriefView } from "./business-brief-view";
import { BusinessGoalsView } from "./business-goals-view";
import type { AgentItem, AgentOutput, AgentSection, BusinessBrief, BusinessGoal, GoalDraft } from "./workspace-agent-types";
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
const initialGoal = (): GoalDraft => {
  const now = new Date();
  return {
    type: "MONTHLY_REVENUE",
    title: "Monthly revenue target",
    targetValue: 0,
    periodStart: now.toISOString().slice(0, 10),
    periodEnd: new Date(now.getTime() + 30 * 86400000)
      .toISOString()
      .slice(0, 10),
  };
};

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
    [items, setItems] = useState<AgentItem[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [section, setSection] = useState<AgentSection>(
      "brief",
    ),
    [brief, setBrief] = useState<BusinessBrief | null>(null),
    [goals, setGoals] = useState<BusinessGoal[]>([]),
    [goalOpen, setGoalOpen] = useState(false),
    [goal, setGoal] = useState(initialGoal);
  const load = useCallback(async () => {
    const response = await authorizedRequest<{ success: true; data: AgentItem[] }>(
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
  const loadManagement = useCallback(async () => {
    if (compact) return;
    const [briefResponse, goalResponse] = await Promise.all([
      authorizedRequest<{ success: true; data: BusinessBrief }>(
        "/workspace-agent/brief",
      ),
      authorizedRequest<{ success: true; data: BusinessGoal[] }>(
        "/workspace-agent/goals",
      ),
    ]);
    setBrief(briefResponse.data);
    setGoals(goalResponse.data);
  }, [authorizedRequest, compact]);
  useEffect(() => {
    const task = window.setTimeout(
      () =>
        void loadManagement().catch((reason) =>
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Unable to calculate the business brief.",
          ),
        ),
      0,
    );
    return () => window.clearTimeout(task);
  }, [loadManagement]);
  async function createGoal() {
    setLoading(true);
    setError("");
    try {
      await authorizedRequest("/workspace-agent/goals", {
        method: "POST",
        body: JSON.stringify({
          ...goal,
          targetValue: Number(goal.targetValue),
          periodStart: new Date(
            `${goal.periodStart}T00:00:00.000Z`,
          ).toISOString(),
          periodEnd: new Date(`${goal.periodEnd}T23:59:59.999Z`).toISOString(),
        }),
      });
      setGoalOpen(false);
      await loadManagement();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to create the goal.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function send(text = message) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest<{ success: true; data: AgentOutput }>(
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
      {!compact && <WorkspaceAgentHeader section={section} onSection={setSection} />}
      {!compact && section === "brief" && brief && <BusinessBriefView brief={brief} onNavigate={onNavigate} />}
      {!compact && section === "goals" && <BusinessGoalsView goals={goals} goal={goal} open={goalOpen} loading={loading} onToggle={() => setGoalOpen((value) => !value)} onGoal={setGoal} onCreate={() => void createGoal()} />}
      {(compact || section === "conversation") && (
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
                  {item.output.reasoning && (
                    <div className="forecast-card">
                      <strong>
                        {item.output.reasoning.source === "REAL_AI"
                          ? "AI-assisted analysis"
                          : "Verified-data fallback"}
                      </strong>
                      <span>
                        Confidence: {item.output.reasoning.confidence.toLowerCase()}
                      </span>
                      {item.output.reasoning.conclusions.length > 0 && (
                        <ul>
                          {item.output.reasoning.conclusions.map((value) => (
                            <li key={value}>{value}</li>
                          ))}
                        </ul>
                      )}
                      {item.output.reasoning.recommendations.length > 0 && (
                        <ol>
                          {item.output.reasoning.recommendations.map((value) => (
                            <li key={`${value.action}:${value.reason}`}>
                              <strong>{value.action}</strong> — {value.reason} ({value.expectedImpact})
                            </li>
                          ))}
                        </ol>
                      )}
                      {item.output.reasoning.missingData.map((value) => (
                        <p className="agent-warning" key={value}>{value}</p>
                      ))}
                      {(item.output.reasoning.requiresConfirmation ||
                        item.output.reasoning.proposedToolActions.length > 0) && (
                        <p className="agent-warning">
                          Suggested actions require your confirmation; none were executed automatically.
                        </p>
                      )}
                    </div>
                  )}
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
                        Assumptions:{" "}
                        {item.output.forecast.assumptions.join("; ")}
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
                  {item.output.managementSection && !compact && (
                    <button
                      className="agent-record-link"
                      onClick={() => setSection(item.output.managementSection!)}
                    >
                      Open{" "}
                      {item.output.managementSection === "brief"
                        ? "Today’s Brief"
                        : "Goals"}{" "}
                      →
                    </button>
                  )}
                  <details>
                    <summary>Source and action details</summary>
                    <p>
                      Authenticated organization context and assigned
                      permissions were enforced by the backend. No organization
                      ID was accepted from this message.
                    </p>
                    {item.output.reasoning?.evidence.map((source) => (
                      <p key={source.id}>
                        <strong>{source.label}:</strong> {source.value ?? "Unavailable"} · {source.period}
                      </p>
                    ))}
                    {item.output.reasoning?.assumptions.length ? (
                      <p>Assumptions: {item.output.reasoning.assumptions.join("; ")}</p>
                    ) : null}
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
      )}
      {error && <div className="dashboard-notice error">{error}</div>}
      {(compact || section === "conversation") && (
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
      )}
    </section>
  );
}
