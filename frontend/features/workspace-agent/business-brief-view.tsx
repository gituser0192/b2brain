import type { BusinessBrief } from "./workspace-agent-types";

const cash = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

export function BusinessBriefView({ brief, onNavigate }: {
  brief: BusinessBrief; onNavigate?: (view: string) => void;
}) {
  return <section className="agent-management-view">
    <header><div><p>Daily business brief</p><h3>{brief.meaningful ? "What needs your attention today" : "No meaningful changes need attention"}</h3><span>{brief.period} · Calculated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(brief.calculatedAt))}</span></div><strong className="agent-health-score">{brief.health.score === null ? "—" : brief.health.score}<small>Health / 100</small></strong></header>
    {brief.finance && <div className="workspace-metric-grid"><article><span>Revenue · 30 days</span><strong>{cash(brief.finance.revenue)}</strong></article><article><span>Expenses · 30 days</span><strong>{cash(brief.finance.expenses)}</strong></article><article><span>Profit · 30 days</span><strong>{cash(brief.finance.profit)}</strong></article></div>}
    <div className="workspace-metric-grid"><article><span>New customers today</span><strong>{brief.activity.newCustomers ?? "Restricted"}</strong></article><article><span>Overdue follow-ups</span><strong>{brief.activity.overdueFollowUps ?? "Restricted"}</strong></article><article><span>Overdue tasks</span><strong>{brief.activity.overdueTasks ?? "Restricted"}</strong></article><article><span>At-risk projects</span><strong>{brief.activity.atRiskProjects}</strong></article></div>
    {brief.health.missingData.map((warning) => <div className="agent-warning" key={warning}>{warning}</div>)}
    <div className="agent-alert-list"><h3>Explainable alerts</h3>{brief.alerts.length ? brief.alerts.map((alert) => <article key={alert.code}><span className={`agent-alert-severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span><div><strong>{alert.title}</strong><p>{alert.evidence}</p><small>{alert.why} · {alert.period}</small></div><button onClick={() => onNavigate?.(alert.view)}>Open →</button></article>) : <p className="agent-empty-copy">No deterministic alerts were found in the data you are permitted to view.</p>}</div>
    <div className="agent-recommendations"><h3>Top recommended actions</h3>{brief.recommendations.length ? brief.recommendations.map((item) => <article key={`${item.title}:${item.reason}`}><div><strong>{item.title}</strong><p>{item.reason}</p></div><button onClick={() => onNavigate?.(item.view)}>Review</button></article>) : <p className="agent-empty-copy">No action is currently recommended.</p>}</div>
  </section>;
}
