"use client";

import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";

interface Metrics {
  customers: number; leads: number; activeCustomers: number; overdueFollowUps: number;
  openDeals: number; pipelineValue: number; weightedForecast: number; wonRevenue: number;
  activeProjects: number; pendingTasks: number; overdueTasks: number; activeEmployees: number; openInquiries: number;
  invoiced: number; received: number; outstanding: number; expenses: number; netCash: number; currentMonthRevenue: number; currentMonthExpenses: number; currentMonthProfit: number;
  orders: number; activeOrders: number; orderValue: number;
  stockOnHand: number; stockReserved: number; lowStock: number;
  activeCampaigns: number; marketingSpend: number; marketingLeads: number;
  conversions: number; attributedRevenue: number; returnOnSpend: number;
  openTickets: number; overdueTickets: number;
}
interface Alert { type: string; count: number; label: string; view: string }
interface DashboardData { periodDays: number | null; enabledServices: string[]; currency: string; timezone: string; metrics: Metrics; alerts: Alert[]; monthlyCash: { month: string; revenue: number; expenses: number; profit: number }[]; recent: { customers: { id: string; displayName: string; status: string; createdAt: string }[]; projects: { id: string; name: string; code: string; status: string; updatedAt: string }[]; activities: { id: string; type: string; summary: string; occurredAt: string; customer: { displayName: string } }[] } }
interface Payload { success: true; data: DashboardData }

export function BusinessDashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { session, authorizedRequest } = useAuth();
  const [days, setDays] = useState("30");
  const organizationId = session?.organization.id ?? "signed-out";
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(organizationId, days),
    queryFn: async () => (await authorizedRequest<Payload>(`/dashboard/summary?days=${days}`)).data,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
  const data = dashboardQuery.data;
  const metrics = data?.metrics;
  const services = data?.enabledServices ?? [];
  const alerts = data?.alerts ?? [];
  const money = (value: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: data?.currency ?? session?.organization.currency ?? "INR",
    maximumFractionDigits: 0, notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
  const has = (code: string) => services.includes(code);
  const bars = metrics ? [
    { label: "Pipeline", value: metrics.pipelineValue, color: "#6757e8" },
    { label: "Forecast", value: metrics.weightedForecast, color: "#2e9bea" },
    { label: "Won", value: metrics.wonRevenue, color: "#18a66a" },
  ] : [];
  const max = Math.max(1, ...bars.map((item) => item.value));
  const cashMax = Math.max(1, ...(data?.monthlyCash.flatMap((item) => [item.revenue, item.expenses]) ?? [1]));

  return <div className="business-dashboard">
    <header className="business-dashboard-head">
      <div><p>Unified business overview</p><h2>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {session?.user.firstName}.</h2><span>Every number below comes from your organization&apos;s real service data.</span></div>
      <label><span>Reporting period</span><select value={days} onChange={(event) => setDays(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All time</option></select></label>
    </header>
    {dashboardQuery.error && <div className="dashboard-notice error">{dashboardQuery.error instanceof ApiError ? dashboardQuery.error.message : "Unable to load dashboard."}</div>}
    {dashboardQuery.isLoading || !metrics ? <div className="dashboard-data-loader"><span className="spinner dark" />Calculating your business…</div> : <>
      {dashboardQuery.isFetching && <div className="dashboard-refresh-status">Refreshing business data…</div>}
      <section className="executive-metrics">
        {has("FINANCE") && <article className="primary"><div><span>Current-month profit</span><strong>{money(metrics.currentMonthProfit)}</strong><small>{money(metrics.currentMonthRevenue)} revenue · {money(metrics.currentMonthExpenses)} expenses</small></div><i>₹</i></article>}
        {has("SALES") && <article><span>Weighted forecast</span><strong>{money(metrics.weightedForecast)}</strong><small>{metrics.openDeals} open deals</small></article>}
        {has("ORDERS") && <article><span>Order value</span><strong>{money(metrics.orderValue)}</strong><small>{metrics.activeOrders} requiring progress</small></article>}
        {has("MARKETING") && <article><span>Marketing return</span><strong>{metrics.returnOnSpend.toFixed(2)}×</strong><small>{metrics.conversions} conversions</small></article>}
        {!services.some((code) => ["FINANCE", "SALES", "ORDERS", "MARKETING"].includes(code)) && <article className="primary"><div><span>Business metrics</span><strong>Ready when you are</strong><small>Assign business services to begin calculating.</small></div></article>}
      </section>
      <section className="business-dashboard-grid">
        <div className="dashboard-panel performance-panel"><header><div><p>Revenue engine</p><h3>Sales performance</h3></div>{has("SALES") && <button onClick={() => onNavigate("sales")}>Open Sales →</button>}</header>{has("SALES") ? <><div className="performance-bars">{bars.map((item) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.value / max * 100}%`, background: item.color }} /></div><strong>{money(item.value)}</strong></div>)}</div><div className="panel-stat-row"><span><small>Open deals</small><strong>{metrics.openDeals}</strong></span><span><small>Won revenue</small><strong>{money(metrics.wonRevenue)}</strong></span><span><small>Pipeline coverage</small><strong>{metrics.weightedForecast ? `${(metrics.pipelineValue / metrics.weightedForecast).toFixed(1)}×` : "—"}</strong></span></div></> : <EmptyService text="Assign Sales to view pipeline performance." />}</div>
        <aside className="dashboard-panel attention-panel"><header><div><p>Needs attention</p><h3>Operational alerts</h3></div><span>{alerts.reduce((sum, item) => sum + item.count, 0)}</span></header>{alerts.length ? <div>{alerts.map((item) => <button key={item.type} onClick={() => onNavigate(item.view)}><i>{item.count}</i><span><strong>{item.label}</strong><small>Review and take action</small></span><b>→</b></button>)}</div> : <div className="all-clear"><span>✓</span><strong>All clear</strong><p>No overdue or low-stock items were found.</p></div>}</aside>
        <div className="dashboard-panel finance-panel"><header><div><p>Cash position</p><h3>Finance snapshot</h3></div>{has("FINANCE") && <button onClick={() => onNavigate("finance")}>Open Finance →</button>}</header>{has("FINANCE") ? <div className="finance-snapshot"><div className="cash-ring" style={{ "--paid": `${metrics.invoiced ? Math.min(100, metrics.received / metrics.invoiced * 100) : 0}%` } as CSSProperties}><span><strong>{metrics.invoiced ? Math.round(metrics.received / metrics.invoiced * 100) : 0}%</strong><small>collected</small></span></div><dl><div><dt>Invoiced</dt><dd>{money(metrics.invoiced)}</dd></div><div><dt>Received</dt><dd>{money(metrics.received)}</dd></div><div><dt>Outstanding</dt><dd>{money(metrics.outstanding)}</dd></div><div><dt>Expenses</dt><dd>{money(metrics.expenses)}</dd></div></dl></div> : <EmptyService text="Assign Finance to see cash and collection metrics." />}</div>
        <div className="dashboard-panel operations-panel"><header><div><p>Operating system</p><h3>Business activity</h3></div></header><div className="operations-cards">{has("CRM") && <button onClick={() => onNavigate("crm")}><i>C</i><span><strong>{metrics.customers}</strong><small>{metrics.activeCustomers} active · {metrics.leads} CRM leads</small></span></button>}{has("PROJECTS") && <button onClick={() => onNavigate("projects")}><i>P</i><span><strong>{metrics.activeProjects}</strong><small>{metrics.pendingTasks} pending · {metrics.overdueTasks} overdue tasks</small></span></button>}{has("PEOPLE") && <button onClick={() => onNavigate("employees")}><i>E</i><span><strong>{metrics.activeEmployees}</strong><small>Active employees</small></span></button>}{has("INVENTORY") && <button onClick={() => onNavigate("inventory")}><i>I</i><span><strong>{metrics.stockOnHand - metrics.stockReserved}</strong><small>Available stock units</small></span></button>}{has("MARKETING") && <button onClick={() => onNavigate("marketing")}><i>M</i><span><strong>{metrics.activeCampaigns}</strong><small>Active campaigns</small></span></button>}</div></div>
        {has("FINANCE") && <div className="dashboard-panel dashboard-cash-chart"><header><div><p>Monthly cash movement</p><h3>Revenue versus expenses</h3></div></header>{data.monthlyCash.some((item) => item.revenue || item.expenses) ? <div>{data.monthlyCash.map((item) => <section key={item.month}><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</span><div><i style={{ height: `${Math.max(2,item.revenue/cashMax*100)}%` }} title={`Revenue ${money(item.revenue)}`} /><b style={{ height: `${Math.max(2,item.expenses/cashMax*100)}%` }} title={`Expenses ${money(item.expenses)}`} /></div><strong>{money(item.profit)}</strong></section>)}</div> : <EmptyService text="No received payments or recorded expenses in the last six months." />}</div>}
        <div className="dashboard-panel dashboard-recent"><header><div><p>Latest records</p><h3>Recent business activity</h3></div></header>{data.recent.customers.length || data.recent.projects.length || data.recent.activities.length ? <div className="dashboard-recent-grid">{has("CRM") && <section><h4>Customers</h4>{data.recent.customers.map((item) => <button key={item.id} onClick={() => onNavigate("crm")}><span><strong>{item.displayName}</strong><small>{item.status}</small></span><b>→</b></button>)}</section>}{has("PROJECTS") && <section><h4>Projects</h4>{data.recent.projects.map((item) => <button key={item.id} onClick={() => onNavigate("projects")}><span><strong>{item.name}</strong><small>{item.code} · {item.status}</small></span><b>→</b></button>)}</section>}{data.recent.activities.length > 0 && <section><h4>CRM activity</h4>{data.recent.activities.map((item) => <button key={item.id} onClick={() => onNavigate("crm")}><span><strong>{item.summary}</strong><small>{item.customer.displayName} · {item.type}</small></span><b>→</b></button>)}</section>}</div> : <EmptyService text="No recent permitted business records yet." />}</div>
      </section>
    </>}
  </div>;
}

function EmptyService({ text }: { text: string }) {
  return <div className="panel-empty"><span>◇</span><p>{text}</p></div>;
}
