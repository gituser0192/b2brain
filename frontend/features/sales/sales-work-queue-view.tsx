export type WorkView =
  | "inquiries"
  | "crm"
  | "automation"
  | "sales"
  | "calendar";

export interface SalesWorkItem {
  id: string;
  sourceId: string;
  type:
    | "INQUIRY"
    | "CRM_FOLLOW_UP"
    | "AUTOMATED_FOLLOW_UP"
    | "PIPELINE_ALERT"
    | "DEAL"
    | "APPOINTMENT";
  title: string;
  contact: string;
  detail: string | null;
  dueAt: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner: string | null;
  value: number | null;
  currency: string | null;
  view: WorkView;
  canComplete: boolean;
  email: string | null;
  phone: string | null;
}

export interface SalesQueueMetrics {
  total: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  forecastAtRisk: number;
}

type QueueScope = "MINE" | "TEAM";
type QueueFilter = "ALL" | SalesWorkItem["type"];
type AlertDecision = "EXECUTE" | "DISMISS" | "SNOOZE";

const filters: QueueFilter[] = [
  "ALL",
  "PIPELINE_ALERT",
  "INQUIRY",
  "CRM_FOLLOW_UP",
  "AUTOMATED_FOLLOW_UP",
  "DEAL",
  "APPOINTMENT",
];

const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

function dueLabel(value: string | null) {
  if (!value) return "No deadline";
  const due = new Date(value);
  const now = new Date();
  if (due < now) {
    return `Overdue · ${new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(due)}`;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(due);
}

export function SalesWorkQueueView({
  scope,
  filter,
  items,
  metrics,
  loading,
  error,
  canViewTeam,
  canManageDeals,
  onScopeChange,
  onFilterChange,
  onNavigate,
  onComplete,
  onDecideAlert,
}: {
  scope: QueueScope;
  filter: QueueFilter;
  items: SalesWorkItem[];
  metrics: SalesQueueMetrics;
  loading: boolean;
  error: string;
  canViewTeam: boolean;
  canManageDeals: boolean;
  onScopeChange: (scope: QueueScope) => void;
  onFilterChange: (filter: QueueFilter) => void;
  onNavigate: (view: WorkView) => void;
  onComplete: (item: SalesWorkItem) => void;
  onDecideAlert: (item: SalesWorkItem, decision: AlertDecision) => void;
}) {
  return (
    <section className="sales-queue">
      <header>
        <div>
          <p>Daily execution</p>
          <h3>Unified sales work queue</h3>
          <span>
            Prioritized from real leads, CRM follow-ups, deals, and
            appointments.
          </span>
        </div>
        <div className="sales-queue-scope">
          <button
            className={scope === "MINE" ? "active" : ""}
            onClick={() => onScopeChange("MINE")}
          >
            My work
          </button>
          {canViewTeam && (
            <button
              className={scope === "TEAM" ? "active" : ""}
              onClick={() => onScopeChange("TEAM")}
            >
              Team
            </button>
          )}
        </div>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="sales-queue-metrics">
        <article>
          <span>Open work</span>
          <strong>{metrics.total}</strong>
        </article>
        <article className={metrics.overdue ? "danger" : ""}>
          <span>Overdue</span>
          <strong>{metrics.overdue}</strong>
        </article>
        <article>
          <span>Due today</span>
          <strong>{metrics.dueToday}</strong>
        </article>
        <article>
          <span>Unassigned leads</span>
          <strong>{metrics.unassigned}</strong>
        </article>
        <article>
          <span>Forecast at risk</span>
          <strong>{money(metrics.forecastAtRisk)}</strong>
        </article>
      </div>
      <div className="sales-queue-filters">
        {filters.map((option) => (
          <button
            key={option}
            className={filter === option ? "active" : ""}
            onClick={() => onFilterChange(option)}
          >
            {option.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="sales-queue-empty">
          <span className="spinner dark" /> Loading work queue…
        </div>
      ) : items.length === 0 ? (
        <div className="sales-queue-empty">
          <strong>No sales work is due.</strong>
          <span>
            New organizations stay empty until real inquiries, follow-ups,
            deals, or appointments are created.
          </span>
        </div>
      ) : (
        <div className="sales-queue-list">
          {items.map((item, index) => {
            const overdue = Boolean(
              item.dueAt && new Date(item.dueAt) < new Date(),
            );
            return (
              <article key={item.id}>
                <span className="queue-rank">{index + 1}</span>
                <div className="queue-main">
                  <header>
                    <i className={item.type.toLowerCase()}>
                      {item.type.replaceAll("_", " ")}
                    </i>
                    <em className={item.priority.toLowerCase()}>
                      {item.priority}
                    </em>
                  </header>
                  <button onClick={() => onNavigate(item.view)}>
                    <strong>{item.title}</strong>
                    <span>{item.contact}</span>
                  </button>
                  <p>{item.detail ?? "Open the source record for full context."}</p>
                </div>
                <div className="queue-context">
                  <strong className={overdue ? "overdue" : ""}>
                    {dueLabel(item.dueAt)}
                  </strong>
                  <span>{item.owner ?? "Unassigned"}</span>
                  {item.value !== null && (
                    <b>{money(item.value, item.currency ?? "INR")}</b>
                  )}
                </div>
                <div className="queue-actions">
                  {item.phone && <a href={`tel:${item.phone}`}>Call</a>}
                  {item.email && <a href={`mailto:${item.email}`}>Email</a>}
                  {item.phone && (
                    <a
                      href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button onClick={() => onNavigate(item.view)}>Open</button>
                  {item.type === "PIPELINE_ALERT" && canManageDeals && (
                    <>
                      <button onClick={() => onDecideAlert(item, "EXECUTE")}>
                        Create next action
                      </button>
                      <button onClick={() => onDecideAlert(item, "SNOOZE")}>
                        Snooze 1 day
                      </button>
                      <button onClick={() => onDecideAlert(item, "DISMISS")}>
                        Resolve
                      </button>
                    </>
                  )}
                  {item.canComplete && (
                    <button
                      className="complete"
                      onClick={() => onComplete(item)}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
