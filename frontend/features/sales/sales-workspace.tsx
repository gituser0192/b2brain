"use client";
import { SalesWorkQueue } from "./sales-work-queue";
import { SalesJourney } from "./sales-journey";
import { QuotationManager } from "./quotation-manager";
import { SalesIntelligence } from "./sales-intelligence";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import {
  SalesDealBoard,
  type SalesDeal,
} from "./sales-deal-board";
import {
  SalesDealDialog,
  type DealFormState,
} from "./sales-deal-dialog";
interface DR {
  success: true;
  data: {
    deals: SalesDeal[];
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
const blank: DealFormState = {
  customerId: "",
  name: "",
  stage: "PROSPECTING",
  amount: 0,
  currency: "INR",
  probability: 10,
  expectedCloseDate: "",
  lostReason: "",
  notes: "",
};
export function SalesWorkspace({
  onNavigate,
}: {
  onNavigate: (
    view: "inquiries" | "crm" | "automation" | "sales" | "calendar",
  ) => void;
}) {
  const { session, authorizedRequest } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[]>([]);
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
  const [editing, setEditing] = useState<SalesDeal | null>(null);
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
  function show(d?: SalesDeal) {
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
      <SalesIntelligence />
      <SalesWorkQueue onNavigate={onNavigate} />
      <SalesJourney />
      <QuotationManager />
      <SalesDealBoard
        deals={deals}
        metrics={metrics}
        money={money}
        onSelect={show}
      />
      {open && (
        <SalesDealDialog
          editing={editing}
          form={form}
          customers={customers}
          onChange={setForm}
          onClose={() => setOpen(false)}
          onSave={() => void save()}
        />
      )}
    </div>
  );
}
