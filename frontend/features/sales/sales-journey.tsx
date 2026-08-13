"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Kind = "INQUIRY" | "CRM" | "FOLLOW_UP" | "DEAL" | "QUOTATION" | "INVOICE" | "PAYMENT";
interface JourneyEvent {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  occurredAt: string;
  status?: string;
  amount?: number;
  currency?: string;
}
interface Journey {
  customer: { id: string; displayName: string };
  currentStage: Kind;
  lastActivityAt: string;
  metrics: { deals: number; quotations: number; dealValue: number; received: number };
  events: JourneyEvent[];
}
interface JourneyResponse {
  success: true;
  data: {
    journeys: Journey[];
    visibility: { leads: boolean; crm: boolean; crmActivity: boolean; finance: boolean };
  };
}

const stageOrder: Kind[] = ["INQUIRY", "CRM", "DEAL", "QUOTATION", "INVOICE", "PAYMENT"];

export function SalesJourney() {
  const { authorizedRequest } = useAuth();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authorizedRequest<JourneyResponse>("/sales-work-queue/journeys");
      setJourneys(response.data.journeys);
      setSelectedId((current) => current || response.data.journeys[0]?.customer.id || "");
      setError("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load sales journeys.");
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const filtered = useMemo(
    () => journeys.filter((item) => item.customer.displayName.toLowerCase().includes(query.trim().toLowerCase())),
    [journeys, query],
  );
  const selected = journeys.find((item) => item.customer.id === selectedId) ?? filtered[0];
  const money = (value: number, currency = "INR") =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const date = (value: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return (
    <section className="sales-journey">
      <header>
        <div>
          <p>Connected revenue lifecycle</p>
          <h2>Sales journey</h2>
          <span>Follow each real customer from first inquiry to collected payment.</span>
        </div>
        <input aria-label="Search sales journeys" placeholder="Search customer" value={query} onChange={(event) => setQuery(event.target.value)} />
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {loading ? (
        <div className="sales-journey-empty"><span className="spinner dark" /> Loading connected records…</div>
      ) : journeys.length === 0 ? (
        <div className="sales-journey-empty">
          <strong>No sales journeys yet</strong>
          <span>Your workspace stays empty until a real inquiry, deal, or quotation is created.</span>
        </div>
      ) : (
        <div className="sales-journey-layout">
          <aside>
            {filtered.length === 0 ? <p>No matching customer.</p> : filtered.map((item) => (
              <button key={item.customer.id} className={selected?.customer.id === item.customer.id ? "active" : ""} onClick={() => setSelectedId(item.customer.id)}>
                <span><strong>{item.customer.displayName}</strong><small>{item.currentStage.replaceAll("_", " ")} · {date(item.lastActivityAt)}</small></span>
                <b>{money(item.metrics.dealValue)}</b>
              </button>
            ))}
          </aside>
          {selected && <div className="sales-journey-detail">
            <header>
              <div><p>Customer journey</p><h3>{selected.customer.displayName}</h3></div>
              <dl>
                <div><dt>Deals</dt><dd>{selected.metrics.deals}</dd></div>
                <div><dt>Quotes</dt><dd>{selected.metrics.quotations}</dd></div>
                <div><dt>Deal value</dt><dd>{money(selected.metrics.dealValue)}</dd></div>
                <div><dt>Collected</dt><dd>{money(selected.metrics.received)}</dd></div>
              </dl>
            </header>
            <div className="journey-progress">
              {stageOrder.map((stage) => {
                const reached = selected.events.some((event) => event.kind === stage) || (stage === "CRM" && selected.events.some((event) => event.kind === "DEAL"));
                return <span key={stage} className={reached ? "reached" : ""}><i>{reached ? "✓" : ""}</i><b>{stage}</b></span>;
              })}
            </div>
            <div className="journey-events">
              {selected.events.map((event) => <article key={event.id}>
                <i className={event.kind.toLowerCase()}>{event.kind.slice(0, 1)}</i>
                <div><header><strong>{event.title}</strong>{event.status && <b>{event.status.replaceAll("_", " ")}</b>}</header><p>{event.detail}</p><small>{date(event.occurredAt)}</small></div>
                {event.amount !== undefined && <em>{money(event.amount, event.currency)}</em>}
              </article>)}
            </div>
          </div>}
        </div>
      )}
    </section>
  );
}
