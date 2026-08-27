"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Intelligence = {
  currency: string;
  access: { leads: boolean; finance: boolean };
  metrics: Record<string, number | null>;
  monthly: { month: string; forecast: number; received: number }[];
  sources: { source: string; leads: number; converted: number; wonRevenue: number }[];
  salespeople: { name: string; open: number; won: number; lost: number; wonRevenue: number; weighted: number }[];
  lossReasons: { reason: string; count: number }[];
  insights: { tone: "POSITIVE" | "WARNING" | "INFO"; title: string; detail: string }[];
};
type Response = { success: true; data: Intelligence };

export function SalesIntelligence() {
  const { authorizedRequest } = useAuth();
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData((await authorizedRequest<Response>(`/sales-intelligence?days=${days}`)).data); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load sales intelligence."); }
    finally { setLoading(false); }
  }, [authorizedRequest, days]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const money = useCallback((value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: data?.currency ?? "INR", maximumFractionDigits: 0 }).format(value), [data?.currency]);
  const maxMonth = useMemo(() => Math.max(1, ...(data?.monthly.flatMap((item) => [item.forecast, item.received]) ?? [1])), [data]);
  const metric = (key: string) => Number(data?.metrics[key] ?? 0);
  return <section className="sales-intelligence">
    <header className="sales-intelligence-heading">
      <div><p>REAL-DATA SALES INTELLIGENCE</p><h2>Performance & revenue forecast</h2><span>Conversion, response discipline, pipeline quality and received cash from this organization only.</span></div>
      <label><span>Reporting period</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select></label>
    </header>
    {error && <div className="dashboard-notice error">{error}</div>}
    {loading && !data ? <div className="project-empty"><span>◇</span><h3>Calculating sales intelligence…</h3></div> : data && <>
      <div className="sales-intelligence-metrics">
        <article><span>Leads received</span><strong>{metric("leadsReceived")}</strong><small>{metric("leadsConverted")} converted · {metric("leadConversionRate")}%</small></article>
        <article><span>Response health</span><strong>{data.metrics.averageResponseMinutes === null ? "—" : `${metric("averageResponseMinutes")} min`}</strong><small>{metric("missedResponses")} missed deadline</small></article>
        <article><span>Open pipeline</span><strong>{money(metric("pipelineValue"))}</strong><small>{metric("openDeals")} deals · {metric("overduePipeline")} overdue</small></article>
        <article><span>Weighted forecast</span><strong>{money(metric("weightedForecast"))}</strong><small>Probability-adjusted</small></article>
        <article><span>Won vs lost</span><strong>{metric("wonDeals")} / {metric("lostDeals")}</strong><small>{money(metric("wonRevenue"))} won</small></article>
        <article><span>Quotation acceptance</span><strong>{metric("quotationAcceptanceRate")}%</strong><small>{metric("quotationsConsidered")} considered</small></article>
        <article><span>Average sales cycle</span><strong>{data.metrics.averageSalesCycleDays === null ? "—" : `${metric("averageSalesCycleDays")} days`}</strong><small>Closed deals in period</small></article>
        <article><span>Actual received</span><strong>{data.access.finance ? money(metric("actualReceived")) : "Restricted"}</strong><small>{data.access.finance ? `${money(metric("forecastGap"))} forecast gap` : "Finance access required"}</small></article>
      </div>
      <div className="sales-intelligence-grid">
        <article className="sales-chart-card sales-chart-wide"><header><div><p>FORECAST VS ACTUAL</p><h3>Expected revenue by month</h3></div></header>
          {data.monthly.every((item) => item.forecast === 0 && item.received === 0) ? <Empty text="No dated pipeline or received payments in this period." /> : <div className="sales-month-chart">{data.monthly.map((item) => <div key={item.month} className="sales-month"><div className="sales-bars"><i style={{ height: `${Math.max(2, item.forecast / maxMonth * 100)}%` }} title={`Forecast ${money(item.forecast)}`} /><b style={{ height: `${Math.max(2, item.received / maxMonth * 100)}%` }} title={`Received ${money(item.received)}`} /></div><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" })}</span></div>)}</div>}
          <footer><span><i /> Weighted forecast</span><span><b /> Received</span></footer>
        </article>
        <article className="sales-chart-card"><header><div><p>EXPLANATIONS</p><h3>What may change revenue</h3></div></header><div className="sales-insights">{data.insights.map((item) => <div key={item.title} data-tone={item.tone}><strong>{item.title}</strong><span>{item.detail}</span></div>)}</div></article>
        <article className="sales-chart-card"><header><div><p>ATTRIBUTION</p><h3>Lead source & campaign</h3></div></header>{data.sources.length ? <div className="sales-table">{data.sources.slice(0, 8).map((item) => <div key={item.source}><span><strong>{item.source}</strong><small>{item.converted}/{item.leads} converted</small></span><b>{money(item.wonRevenue)}</b></div>)}</div> : <Empty text={data.access.leads ? "No lead attribution in this period." : "Leads service access is required."} />}</article>
        <article className="sales-chart-card"><header><div><p>TEAM OUTPUT</p><h3>Salesperson performance</h3></div></header>{data.salespeople.length ? <div className="sales-table">{data.salespeople.map((item) => <div key={item.name}><span><strong>{item.name}</strong><small>{item.won} won · {item.lost} lost · {item.open} open</small></span><b>{money(item.wonRevenue)}</b></div>)}</div> : <Empty text="No salesperson-owned deals yet." />}</article>
        <article className="sales-chart-card"><header><div><p>LOSS REVIEW</p><h3>Why deals were lost</h3></div></header>{data.lossReasons.length ? <div className="sales-table">{data.lossReasons.map((item) => <div key={item.reason}><span><strong>{item.reason}</strong></span><b>{item.count}</b></div>)}</div> : <Empty text="No lost deals in this period." />}</article>
      </div>
    </>}
  </section>;
}

function Empty({ text }: { text: string }) { return <div className="sales-intelligence-empty"><span>◇</span><p>{text}</p></div>; }
