"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type LedgerData = { records: { id: string; type: "REVENUE" | "EXPENSE"; date: string; description: string; category: string; method: string | null; amount: number; currency: string }[]; metrics: { revenue: number; expenses: number; profit: number }; monthly: { month: string; revenue: number; expenses: number; profit: number }[]; categories: string[] };
type LedgerResponse = { success: true; data: LedgerData };
const empty: LedgerData = { records: [], metrics: { revenue: 0, expenses: 0, profit: 0 }, monthly: [], categories: [] };

export function FinanceLedger() {
  const { authorizedRequest, session } = useAuth();
  const [data, setData] = useState(empty), [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", type: "", category: "", method: "" });
  const query = useMemo(() => { const value = new URLSearchParams(); if (filters.from) value.set("from", new Date(`${filters.from}T00:00:00`).toISOString()); if (filters.to) value.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString()); if (filters.type) value.set("type", filters.type); if (filters.category) value.set("category", filters.category); if (filters.method) value.set("method", filters.method); return value.toString(); }, [filters]);
  const load = useCallback(async () => { try { setData((await authorizedRequest<LedgerResponse>(`/finance/ledger${query ? `?${query}` : ""}`)).data); setError(""); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load cash ledger."); } }, [authorizedRequest, query]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const money = (value: number, currency = session?.organization.currency ?? "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const maximum = Math.max(1, ...data.monthly.flatMap((item) => [item.revenue, item.expenses]));
  return <section className="finance-ledger">
    <header><div><p>CASH LEDGER</p><h3>Revenue, expenses & profit</h3><span>Confirmed payments minus completed refunds, compared with recorded expenses.</span></div></header>
    <div className="ledger-filters"><label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label><label>Type<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value, method: event.target.value === "EXPENSE" ? "" : filters.method })}><option value="">All</option><option value="REVENUE">Revenue</option><option value="EXPENSE">Expense</option></select></label><label>Category<input placeholder="Expense category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} /></label><label>Payment method<select value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value, type: event.target.value ? "REVENUE" : filters.type })}><option value="">All</option>{["CASH","BANK_TRANSFER","CARD","UPI","CHEQUE","OTHER"].map((method) => <option key={method}>{method}</option>)}</select></label><button onClick={() => setFilters({ from: "", to: "", type: "", category: "", method: "" })}>Clear</button></div>
    {error && <div className="dashboard-notice error">{error}</div>}
    <div className="ledger-metrics"><article><span>Net revenue</span><strong>{money(data.metrics.revenue)}</strong></article><article><span>Expenses</span><strong>{money(data.metrics.expenses)}</strong></article><article className={data.metrics.profit < 0 ? "loss" : "profit"}><span>Profit</span><strong>{money(data.metrics.profit)}</strong></article></div>
    {data.monthly.length > 0 && <div className="ledger-monthly">{data.monthly.map((item) => <div key={item.month}><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" })}</span><i style={{ width: `${item.revenue / maximum * 100}%` }} title={`Revenue ${money(item.revenue)}`} /><b style={{ width: `${item.expenses / maximum * 100}%` }} title={`Expenses ${money(item.expenses)}`} /><strong>{money(item.profit)}</strong></div>)}</div>}
    {data.records.length ? <div className="ledger-records">{data.records.map((record) => <article key={`${record.type}-${record.id}`}><i data-type={record.type}>{record.type === "REVENUE" ? "+" : "−"}</i><div><strong>{record.description}</strong><small>{new Date(record.date).toLocaleDateString()} · {record.category}{record.method ? ` · ${record.method.replaceAll("_", " ")}` : ""}</small></div><b>{record.type === "REVENUE" ? "+" : "−"}{money(record.amount, record.currency)}</b></article>)}</div> : <div className="finance-empty"><strong>No cash records for these filters</strong><p>Confirmed payments and recorded expenses will appear here.</p></div>}
  </section>;
}
