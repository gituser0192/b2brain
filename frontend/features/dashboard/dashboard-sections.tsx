import Link from "next/link";
import { useState } from "react";
import type { BusinessHealthData, DashboardAlert, DashboardMetrics, DashboardRecent } from "./dashboard-types";

export function DashboardGreeting({ firstName, organizationName, agentEnabled, onAskAgent }: { firstName?: string; organizationName?: string; agentEnabled: boolean; onAskAgent: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return <div className="dashboard-greeting"><p>Business command centre</p><h2 id="dashboard-greeting">Good {greeting}, {firstName ?? "there"}.</h2><span>Here is the verified operating picture for {organizationName ?? "your workspace"}.</span>{agentEnabled && <button type="button" onClick={onAskAgent}>Ask Business Agent →</button>}</div>;
}

export function ReportingPeriodSelector({ days, onChange }: { days: string; onChange: (days: string) => void }) {
  return <label className="dashboard-period"><span>Reporting period</span><select value={days} onChange={(event) => onChange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All time</option></select><small>Operational and recent-record totals use this period. Finance cards below are current month.</small></label>;
}

function DashboardMetricCard({ label, value, detail, tone, href }: { label: string; value: string; detail: string; tone?: string; href?: string }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{detail}</small></>;
  return <article className={tone ? `dashboard-metric-card ${tone}` : "dashboard-metric-card"}>{href ? <Link href={href}>{content}</Link> : content}</article>;
}

export function DashboardMetricGrid({ metrics, financeEnabled, analysisEnabled, health, money }: { metrics: DashboardMetrics; financeEnabled: boolean; analysisEnabled: boolean; health?: BusinessHealthData; money: (value: number) => string }) {
  return <section className="dashboard-metric-grid" aria-label="Primary business metrics">
    {financeEnabled ? <><DashboardMetricCard label="Revenue" value={money(metrics.currentMonthRevenue)} detail="Current month · received payments" href="/finance" /><DashboardMetricCard label="Expenses" value={money(metrics.currentMonthExpenses)} detail="Current month · recorded expenses" href="/finance" /><DashboardMetricCard label="Profit" value={money(metrics.currentMonthProfit)} detail="Current month · revenue minus expenses" tone={metrics.currentMonthProfit < 0 ? "negative" : "primary"} href="/finance" /></> : <><DashboardMetricCard label="Revenue" value="Unavailable" detail="Enable Finance to verify revenue" /><DashboardMetricCard label="Expenses" value="Unavailable" detail="Enable Finance to verify expenses" /><DashboardMetricCard label="Profit" value="Unavailable" detail="Enable Finance to verify profit" /></>}
    <DashboardMetricCard label="Business Health" value={health?.overallScore === null || !health ? "Not scored" : `${health.overallScore}/100`} detail={health ? `${health.scoreLabel} · ${health.dataStatus.toLowerCase()} data` : analysisEnabled ? "Calculating verified assessment" : "Enable Business Analysis to calculate health"} href={analysisEnabled ? "/dashboard?view=analysis" : undefined} />
  </section>;
}

export function DashboardPriorityList({ alerts, onNavigate }: { alerts: DashboardAlert[]; onNavigate: (view: string) => void }) {
  return <section className="dashboard-priorities" aria-labelledby="dashboard-priorities-title"><header><div><p>Today’s priorities</p><h3 id="dashboard-priorities-title">What needs attention</h3></div><span>{alerts.reduce((sum, alert) => sum + alert.count, 0)} verified</span></header>{alerts.length ? <div>{alerts.map((alert) => <button key={alert.type} type="button" onClick={() => onNavigate(alert.view)}><i aria-hidden="true">{alert.count}</i><span><strong>{alert.label}</strong><small>{alert.count} verified item{alert.count === 1 ? "" : "s"} require review</small></span><b aria-hidden="true">→</b></button>)}</div> : <div className="dashboard-all-clear"><span aria-hidden="true">✓</span><div><strong>No urgent priorities</strong><p>No overdue or exception alerts were returned for this reporting period.</p></div></div>}</section>;
}

export function BusinessTrendCard({ monthlyCash, money }: { monthlyCash: { month: string; revenue: number; expenses: number; profit: number }[]; money: (value: number) => string }) {
  const maximum = Math.max(1, ...monthlyCash.flatMap((item) => [item.revenue, item.expenses]));
  const populated = monthlyCash.some((item) => item.revenue || item.expenses);
  return <section className="dashboard-card dashboard-trend"><header><div><p>Six-month trend</p><h3>Revenue, expenses and profit</h3></div><Link href="/finance">Open Finance →</Link></header>{populated ? <div className="dashboard-trend-chart">{monthlyCash.map((item) => <section key={item.month}><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</span><div><i style={{ height: `${Math.max(2, item.revenue / maximum * 100)}%` }} title={`Revenue ${money(item.revenue)}`} /><b style={{ height: `${Math.max(2, item.expenses / maximum * 100)}%` }} title={`Expenses ${money(item.expenses)}`} /></div><strong>{money(item.profit)}</strong></section>)}</div> : <CompactEmpty text="No received payments or expenses were recorded in the last six months." />}</section>;
}

export function BusinessHealthCard({ analysisEnabled, permissionGranted, agentEnabled, health, loading, error, onNavigate }: { analysisEnabled: boolean; permissionGranted: boolean; agentEnabled: boolean; health?: BusinessHealthData; loading: boolean; error: unknown; onNavigate: (view: string) => void }) {
  const [renderedAt] = useState(() => Date.now());
  const stale = health ? renderedAt - new Date(health.period.currentEnd).getTime() > 15 * 60_000 : false;
  const availableFactors = health?.components.filter((factor) => factor.score !== null) ?? [];
  const state = !analysisEnabled ? "Business Analysis is not enabled for this workspace." : !permissionGranted ? "You do not have permission to view Business Analysis." : error ? "The verified health calculation is temporarily unavailable." : loading ? "Calculating from permitted business records…" : !health || health.overallScore === null ? "There is not enough verified activity to calculate a health score." : null;
  return <section className="dashboard-card dashboard-health"><header><div><p>Calculated health assessment</p><h3>Business Health</h3></div>{health?.overallScore !== null && health && <strong className="dashboard-health-score" aria-label={`Business health score ${health.overallScore} out of 100`}>{health.overallScore}<small>/100</small></strong>}</header>{state ? <div className="dashboard-health-state"><strong>{loading ? "Calculating" : "Score unavailable"}</strong><p>{state}</p></div> : health && <div className="dashboard-health-details"><div className="dashboard-health-meta"><strong>{health.scoreLabel}</strong><span>{health.period.days}-day assessment · {health.recordCount} verified records</span><small>{stale ? "Stale calculation — refresh required" : `Calculated through ${new Date(health.period.currentEnd).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}</small></div><section aria-labelledby="health-factors"><h4 id="health-factors">Verified business facts</h4>{availableFactors.length ? <ul>{availableFactors.map((factor) => <li key={factor.key}><div><strong>{factor.label}</strong><span>{factor.score}/100</span></div><p>{factor.evidence}</p></li>)}</ul> : <p>No scored factors are available.</p>}</section>{health.recommendations.length > 0 && <section aria-labelledby="health-risks"><h4 id="health-risks">Recommendations</h4><ul>{health.recommendations.slice(0, 2).map((item) => <li key={item.key}><strong>{item.title}</strong><p>{item.evidence}</p></li>)}</ul></section>}</div>}<footer>{analysisEnabled && permissionGranted && <button type="button" onClick={() => onNavigate("analysis")}>Open Business Analysis</button>}{agentEnabled && <button type="button" className="secondary" onClick={() => onNavigate("b2agent")}>Ask Business Agent</button>}</footer></section>;
}

export function WorkSummaryCard({ eyebrow, title, items, actionLabel, onAction, onNavigate }: { eyebrow: string; title: string; items: { label: string; value: string; view?: string }[]; actionLabel?: string; onAction?: () => void; onNavigate?: (view: string) => void }) {
  return <section className="dashboard-card dashboard-work-summary"><header><div><p>{eyebrow}</p><h3>{title}</h3></div>{actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel} →</button>}</header><dl>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.view && onNavigate ? <button type="button" onClick={() => onNavigate(item.view!)}>{item.value}</button> : item.value}</dd></div>)}</dl></section>;
}

export function RecentActivityCard({ recent, crmEnabled, projectsEnabled, onNavigate }: { recent: DashboardRecent; crmEnabled: boolean; projectsEnabled: boolean; onNavigate: (view: string) => void }) {
  const available = Boolean((crmEnabled && (recent.customers.length || recent.activities.length)) || (projectsEnabled && recent.projects.length));
  return <section className="dashboard-card dashboard-recent"><header><div><p>Latest records</p><h3>Recent business activity</h3></div></header>{available ? <div className="dashboard-recent-grid">{crmEnabled && recent.customers.length > 0 && <section><h4>Customers</h4>{recent.customers.map((item) => <button key={item.id} onClick={() => onNavigate("crm")}><span><strong>{item.displayName}</strong><small>{item.status}</small></span><b>→</b></button>)}</section>}{projectsEnabled && recent.projects.length > 0 && <section><h4>Projects</h4>{recent.projects.map((item) => <button key={item.id} onClick={() => onNavigate("projects")}><span><strong>{item.name}</strong><small>{item.code} · {item.status}</small></span><b>→</b></button>)}</section>}{crmEnabled && recent.activities.length > 0 && <section><h4>CRM activity</h4>{recent.activities.map((item) => <button key={item.id} onClick={() => onNavigate("crm")}><span><strong>{item.summary}</strong><small>{item.customer.displayName} · {item.type}</small></span><b>→</b></button>)}</section>}</div> : <CompactEmpty text="No recent permitted business records yet." />}</section>;
}

function CompactEmpty({ text }: { text: string }) { return <div className="dashboard-compact-empty"><span aria-hidden="true">◇</span><p>{text}</p></div>; }
