"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";
import { BusinessHealthCard, BusinessTrendCard, DashboardGreeting, DashboardMetricGrid, DashboardPriorityList, RecentActivityCard, ReportingPeriodSelector, WorkSummaryCard } from "./dashboard-sections";
import type { DashboardPayload } from "./dashboard-types";

export function BusinessDashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { session, authorizedRequest } = useAuth();
  const [days, setDays] = useState("30");
  const organizationId = session?.organization.id ?? "signed-out";
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(organizationId, days),
    queryFn: async () => (await authorizedRequest<DashboardPayload>(`/dashboard/summary?days=${days}`)).data,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
  const data = dashboardQuery.data;
  const services = data?.enabledServices ?? [];
  const has = (code: string) => services.includes(code);
  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: data?.currency ?? session?.organization.currency ?? "INR", maximumFractionDigits: 0, notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard" }).format(value);

  return <div className="business-dashboard">
    <section className="dashboard-opening" aria-labelledby="dashboard-greeting">
      <DashboardGreeting firstName={session?.user.firstName} organizationName={session?.organization.name} agentEnabled={has("B2BRAIN_AGENT")} onAskAgent={() => onNavigate("b2agent")} />
      <ReportingPeriodSelector days={days} onChange={setDays} />
    </section>
    {dashboardQuery.error && <div className="dashboard-notice error" role="alert">{dashboardQuery.error instanceof ApiError ? dashboardQuery.error.message : "Unable to load dashboard."}</div>}
    {dashboardQuery.isLoading && <div className="dashboard-data-loader"><span className="spinner dark" />Calculating your business…</div>}
    {data && <>
      {dashboardQuery.isFetching && <div className="dashboard-refresh-status" role="status">Refreshing business data…</div>}
      <DashboardMetricGrid metrics={data.metrics} financeEnabled={has("FINANCE")} analysisEnabled={has("BUSINESS_ANALYSIS")} money={money} />
      <DashboardPriorityList alerts={data.alerts} onNavigate={onNavigate} />
      <section className="dashboard-command-grid" aria-label="Business command centre">
        <div className="dashboard-command-primary">
          {has("FINANCE") && <BusinessTrendCard monthlyCash={data.monthlyCash} money={money} />}
          {has("SALES") && <WorkSummaryCard title="Lead pipeline" eyebrow="Sales" actionLabel="Open Sales" onAction={() => onNavigate("sales")} items={[{ label: "Open deals", value: String(data.metrics.openDeals) }, { label: "Pipeline", value: money(data.metrics.pipelineValue) }, { label: "Weighted forecast", value: money(data.metrics.weightedForecast) }]} />}
          <RecentActivityCard recent={data.recent} crmEnabled={has("CRM")} projectsEnabled={has("PROJECTS")} onNavigate={onNavigate} />
        </div>
        <aside className="dashboard-command-secondary">
          <BusinessHealthCard analysisEnabled={has("BUSINESS_ANALYSIS")} agentEnabled={has("B2BRAIN_AGENT")} onNavigate={onNavigate} />
          {(has("CRM") || has("LEADS") || has("PROJECTS")) && <WorkSummaryCard title="Today’s work" eyebrow="Operations" items={[...(has("CRM") || has("LEADS") ? [{ label: "Overdue follow-ups", value: String(data.metrics.overdueFollowUps), view: "crm" }] : []), ...(has("LEADS") ? [{ label: "Open inquiries", value: String(data.metrics.openInquiries), view: "inquiries" }] : []), ...(has("PROJECTS") ? [{ label: "Pending tasks", value: String(data.metrics.pendingTasks), view: "projects" }, { label: "Overdue tasks", value: String(data.metrics.overdueTasks), view: "projects" }] : [])]} onNavigate={onNavigate} />}
          {has("FINANCE") && <WorkSummaryCard title="Cash position" eyebrow="Finance" actionLabel="Open Finance" onAction={() => onNavigate("finance")} items={[{ label: "Invoiced", value: money(data.metrics.invoiced) }, { label: "Received", value: money(data.metrics.received) }, { label: "Outstanding", value: money(data.metrics.outstanding) }]} />}
        </aside>
      </section>
    </>}
  </div>;
}
