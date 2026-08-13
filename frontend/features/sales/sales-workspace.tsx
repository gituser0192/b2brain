"use client";
import { SalesWorkQueue } from "./sales-work-queue";
import { SalesJourney } from "./sales-journey";
import { QuotationManager } from "./quotation-manager";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Stage =
  "PROSPECTING" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
interface Deal {
  id: string;
  name: string;
  stage: Stage;
  amount: string;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  notes: string | null;
  customer: { id: string; displayName: string };
}
interface DR {
  success: true;
  data: {
    deals: Deal[];
    metrics: {
      openDeals: number;
      pipelineValue: number;
      weightedValue: number;
      wonRevenue: number;
      wonDeals: number;
    };
  };
}
interface CR {
  success: true;
  data: { customers: { id: string; displayName: string }[] };
}
const blank = {
  customerId: "",
  name: "",
  stage: "PROSPECTING" as Stage,
  amount: 0,
  currency: "INR",
  probability: 10,
  expectedCloseDate: "",
  lostReason: "",
  notes: "",
};
const defaults: Record<Stage, number> = {
  PROSPECTING: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};
export function SalesWorkspace({ onNavigate }: { onNavigate: (view: "inquiries" | "crm" | "sales" | "calendar") => void }) {
  const { session, authorizedRequest } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<
    { id: string; displayName: string }[]
  >([]);
  const [metrics, setMetrics] = useState({
    openDeals: 0,
    pipelineValue: 0,
    weightedValue: 0,
    wonRevenue: 0,
    wonDeals: 0,
  });
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const canManage =
    session?.membership.permissions.includes("DEAL_MANAGE") ?? false;
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<DR>("/deals?archived=false");
      setDeals(r.data.deals);
      setMetrics(r.data.metrics);
      const c = await authorizedRequest<CR>(
        "/customers?pageSize=100&archived=false",
      );
      setCustomers(c.data.customers);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to load sales pipeline.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  function show(d?: Deal) {
    setEditing(d ?? null);
    setForm(
      d
        ? {
            customerId: d.customer.id,
            name: d.name,
            stage: d.stage,
            amount: Number(d.amount),
            currency: d.currency,
            probability: d.probability,
            expectedCloseDate: d.expectedCloseDate?.slice(0, 10) ?? "",
            lostReason: d.lostReason ?? "",
            notes: d.notes ?? "",
          }
        : blank,
    );
    setOpen(true);
  }
  async function save() {
    try {
      await authorizedRequest(editing ? `/deals/${editing.id}` : "/deals", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          expectedCloseDate: form.expectedCloseDate
            ? new Date(`${form.expectedCloseDate}T00:00:00`).toISOString()
            : null,
        }),
      });
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to save deal.");
    }
  }
  const money = (v: number, c = "INR") =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(v);
  return (
    <div className="sales-workspace">
      <header className="project-heading">
        <div>
          <p>Sales service</p>
          <h2>Pipeline & deals</h2>
          <span>
            Convert customer opportunities into measurable expected and won
            revenue.
          </span>
        </div>
        {canManage && <button onClick={() => show()}>+ New deal</button>}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <SalesWorkQueue onNavigate={onNavigate} />
      <SalesJourney />
      <QuotationManager />
      <section className="sales-metrics">
        <article>
          <span>Open deals</span>
          <strong>{metrics.openDeals}</strong>
        </article>
        <article>
          <span>Pipeline value</span>
          <strong>{money(metrics.pipelineValue)}</strong>
        </article>
        <article>
          <span>Weighted forecast</span>
          <strong>{money(metrics.weightedValue)}</strong>
        </article>
        <article>
          <span>Won revenue</span>
          <strong>{money(metrics.wonRevenue)}</strong>
        </article>
      </section>
      {deals.length === 0 ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>No sales deals yet</h3>
          <p>
            Add a real opportunity when a customer enters your sales process.
          </p>
        </section>
      ) : (
        <section className="deal-board">
          {(
            [
              "PROSPECTING",
              "QUALIFIED",
              "PROPOSAL",
              "NEGOTIATION",
              "WON",
              "LOST",
            ] as Stage[]
          ).map((stage) => (
            <div key={stage}>
              <header>
                <strong>{stage.replace("_", " ")}</strong>
                <span>{deals.filter((d) => d.stage === stage).length}</span>
              </header>
              {deals
                .filter((d) => d.stage === stage)
                .map((d) => (
                  <article key={d.id} onClick={() => show(d)}>
                    <small>{d.customer.displayName}</small>
                    <h3>{d.name}</h3>
                    <strong>{money(Number(d.amount), d.currency)}</strong>
                    <footer>
                      <span>{d.probability}% probability</span>
                      <span>
                        {d.expectedCloseDate
                          ? new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                            }).format(new Date(d.expectedCloseDate))
                          : "No close date"}
                      </span>
                    </footer>
                  </article>
                ))}
            </div>
          ))}
        </section>
      )}
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog">
            <header>
              <div>
                <p>Sales opportunity</p>
                <h3>{editing ? "Update deal" : "Create deal"}</h3>
              </div>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <label>
              <span>Customer</span>
              <select
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
              >
                <option value="">Select CRM customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Deal name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="agent-form-grid">
              <label>
                <span>Stage</span>
                <select
                  value={form.stage}
                  onChange={(e) => {
                    const stage = e.target.value as Stage;
                    setForm({ ...form, stage, probability: defaults[stage] });
                  }}
                >
                  {Object.keys(defaults).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Currency</span>
                <input
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                <span>Probability %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) =>
                    setForm({ ...form, probability: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Expected close</span>
                <input
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(e) =>
                    setForm({ ...form, expectedCloseDate: e.target.value })
                  }
                />
              </label>
            </div>
            {form.stage === "LOST" && (
              <label>
                <span>Lost reason</span>
                <input
                  value={form.lostReason}
                  onChange={(e) =>
                    setForm({ ...form, lostReason: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={
                  !form.customerId ||
                  form.name.length < 2 ||
                  form.amount < 0 ||
                  form.currency.length !== 3 ||
                  (form.stage === "LOST" && !form.lostReason)
                }
                onClick={() => void save()}
              >
                Save deal
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
