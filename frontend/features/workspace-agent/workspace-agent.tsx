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
  managementSection?: "brief" | "goals" | "conversation";
};
type Item = { id: string; createdAt: string; message: string; output: Output };
type Brief = {
  calculatedAt: string;
  period: string;
  meaningful: boolean;
  health: {
    score: number | null;
    change: number | null;
    missingData: string[];
  };
  finance: {
    revenue: number;
    expenses: number;
    profit: number;
    previousRevenue: number;
    previousExpenses: number;
    previousProfit: number;
  } | null;
  activity: {
    newCustomers: number | null;
    newLeads: number | null;
    overdueFollowUps: number | null;
    overdueTasks: number | null;
    atRiskProjects: number;
    importantServiceRequests: number | null;
  };
  alerts: {
    code: string;
    title: string;
    why: string;
    evidence: string;
    period: string;
    severity: string;
    action: string;
    view: string;
  }[];
  recommendations: { title: string; reason: string; view: string }[];
};
type Goal = {
  id: string;
  type: string;
  title: string;
  targetValue: number;
  currentValue: number | null;
  progress: number | null;
  requiredPace: number | null;
  risk: string;
  periodEnd: string;
};
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
const initialGoal = () => {
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
    [items, setItems] = useState<Item[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [section, setSection] = useState<"brief" | "goals" | "conversation">(
      "brief",
    ),
    [brief, setBrief] = useState<Brief | null>(null),
    [goals, setGoals] = useState<Goal[]>([]),
    [goalOpen, setGoalOpen] = useState(false),
    [goal, setGoal] = useState(initialGoal);
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
  const loadManagement = useCallback(async () => {
    if (compact) return;
    const [briefResponse, goalResponse] = await Promise.all([
      authorizedRequest<{ success: true; data: Brief }>(
        "/workspace-agent/brief",
      ),
      authorizedRequest<{ success: true; data: Goal[] }>(
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
      {!compact && (
        <nav
          className="workspace-agent-sections"
          aria-label="Ask B² Brain sections"
        >
          <button
            className={section === "brief" ? "active" : ""}
            onClick={() => setSection("brief")}
          >
            Today&apos;s Brief
          </button>
          <button
            className={section === "goals" ? "active" : ""}
            onClick={() => setSection("goals")}
          >
            Goals
          </button>
          <button
            className={section === "conversation" ? "active" : ""}
            onClick={() => setSection("conversation")}
          >
            Conversation
          </button>
        </nav>
      )}
      {!compact && section === "brief" && brief && (
        <section className="agent-management-view">
          <header>
            <div>
              <p>Daily business brief</p>
              <h3>
                {brief.meaningful
                  ? "What needs your attention today"
                  : "No meaningful changes need attention"}
              </h3>
              <span>
                {brief.period} · Calculated{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(brief.calculatedAt))}
              </span>
            </div>
            <strong className="agent-health-score">
              {brief.health.score === null ? "—" : brief.health.score}
              <small>Health / 100</small>
            </strong>
          </header>
          {brief.finance && (
            <div className="workspace-metric-grid">
              <article>
                <span>Revenue · 30 days</span>
                <strong>{cash(brief.finance.revenue)}</strong>
              </article>
              <article>
                <span>Expenses · 30 days</span>
                <strong>{cash(brief.finance.expenses)}</strong>
              </article>
              <article>
                <span>Profit · 30 days</span>
                <strong>{cash(brief.finance.profit)}</strong>
              </article>
            </div>
          )}
          <div className="workspace-metric-grid">
            <article>
              <span>New customers today</span>
              <strong>{brief.activity.newCustomers ?? "Restricted"}</strong>
            </article>
            <article>
              <span>Overdue follow-ups</span>
              <strong>{brief.activity.overdueFollowUps ?? "Restricted"}</strong>
            </article>
            <article>
              <span>Overdue tasks</span>
              <strong>{brief.activity.overdueTasks ?? "Restricted"}</strong>
            </article>
            <article>
              <span>At-risk projects</span>
              <strong>{brief.activity.atRiskProjects}</strong>
            </article>
          </div>
          {brief.health.missingData.map((warning) => (
            <div className="agent-warning" key={warning}>
              {warning}
            </div>
          ))}
          <div className="agent-alert-list">
            <h3>Explainable alerts</h3>
            {brief.alerts.length ? (
              brief.alerts.map((alert) => (
                <article key={alert.code}>
                  <span
                    className={`agent-alert-severity ${alert.severity.toLowerCase()}`}
                  >
                    {alert.severity}
                  </span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.evidence}</p>
                    <small>
                      {alert.why} · {alert.period}
                    </small>
                  </div>
                  <button onClick={() => onNavigate?.(alert.view)}>
                    Open →
                  </button>
                </article>
              ))
            ) : (
              <p className="agent-empty-copy">
                No deterministic alerts were found in the data you are permitted
                to view.
              </p>
            )}
          </div>
          <div className="agent-recommendations">
            <h3>Top recommended actions</h3>
            {brief.recommendations.length ? (
              brief.recommendations.map((item) => (
                <article key={`${item.title}:${item.reason}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.reason}</p>
                  </div>
                  <button onClick={() => onNavigate?.(item.view)}>
                    Review
                  </button>
                </article>
              ))
            ) : (
              <p className="agent-empty-copy">
                No action is currently recommended.
              </p>
            )}
          </div>
        </section>
      )}
      {!compact && section === "goals" && (
        <section className="agent-management-view">
          <header>
            <div>
              <p>Measurable goals</p>
              <h3>Goals and progress</h3>
              <span>
                Progress is calculated from real organization records.
              </span>
            </div>
            <button onClick={() => setGoalOpen((value) => !value)}>
              + New goal
            </button>
          </header>
          {goalOpen && (
            <div className="agent-goal-form">
              <label>
                <span>Goal type</span>
                <select
                  value={goal.type}
                  onChange={(event) =>
                    setGoal({ ...goal, type: event.target.value })
                  }
                >
                  {[
                    "MONTHLY_REVENUE",
                    "NEW_LEADS",
                    "CUSTOMER_CONVERSION",
                    "EXPENSE_LIMIT",
                    "PROJECT_COMPLETION",
                    "FOLLOW_UP_RESPONSE",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Title</span>
                <input
                  value={goal.title}
                  onChange={(event) =>
                    setGoal({ ...goal, title: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Target</span>
                <input
                  type="number"
                  min="0.01"
                  value={goal.targetValue}
                  onChange={(event) =>
                    setGoal({
                      ...goal,
                      targetValue: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Starts</span>
                <input
                  type="date"
                  value={goal.periodStart}
                  onChange={(event) =>
                    setGoal({ ...goal, periodStart: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Ends</span>
                <input
                  type="date"
                  value={goal.periodEnd}
                  onChange={(event) =>
                    setGoal({ ...goal, periodEnd: event.target.value })
                  }
                />
              </label>
              <button
                disabled={loading || goal.targetValue <= 0}
                onClick={() => void createGoal()}
              >
                Create goal
              </button>
            </div>
          )}
          <div className="agent-goal-list">
            {goals.length ? (
              goals.map((item) => (
                <article key={item.id}>
                  <header>
                    <div>
                      <small>{item.type.replaceAll("_", " ")}</small>
                      <strong>{item.title}</strong>
                    </div>
                    <span className={item.risk === "HIGH" ? "risk" : "track"}>
                      {item.risk.replaceAll("_", " ")}
                    </span>
                  </header>
                  <div className="goal-progress">
                    <i
                      style={{ width: `${Math.min(100, item.progress ?? 0)}%` }}
                    />
                  </div>
                  <footer>
                    <span>
                      {item.currentValue === null
                        ? "Restricted"
                        : item.currentValue.toLocaleString("en-IN")}{" "}
                      / {item.targetValue.toLocaleString("en-IN")}
                    </span>
                    <span>
                      {item.progress === null
                        ? "—"
                        : `${Math.round(item.progress)}%`}{" "}
                      · ends{" "}
                      {new Date(item.periodEnd).toLocaleDateString("en-IN")}
                    </span>
                  </footer>
                </article>
              ))
            ) : (
              <p className="agent-empty-copy">
                No goals have been created. Add the first measurable business
                goal.
              </p>
            )}
          </div>
        </section>
      )}
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
