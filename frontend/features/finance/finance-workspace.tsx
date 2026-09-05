"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { PaymentCollectionManager } from "./payment-collection-manager";
import { FinanceLedger, type LedgerData } from "./finance-ledger";
import { InvoiceEntryForm } from "./invoice-entry-form";
import {
  ExpenseEntryForm,
  PaymentEntryForm,
} from "./finance-transaction-forms";
import {
  FinanceRecords,
  formatMoney as money,
  type FinanceExpense as Expense,
  type FinanceInvoice as Invoice,
} from "./finance-records";
interface FinanceResponse {
  success: true;
  data: {
    invoices: Invoice[];
    expenses: Expense[];
    metrics: {
      invoiced: number;
      received: number;
      outstanding: number;
      overdue: number;
      expenses: number;
      netCash: number;
    };
  };
}
interface CustomerResponse {
  success: true;
  data: { customers: { id: string; displayName: string }[] };
}
const blankInvoice = {
  customerId: "",
  invoiceNumber: "",
  issueDate: "",
  dueDate: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  tax: 0,
  discount: 0,
  notes: "",
};
const blankExpense = {
  title: "",
  category: "",
  vendor: "",
  amount: 0,
  expenseDate: "",
  notes: "",
};

export function FinanceWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [data, setData] = useState<FinanceResponse["data"]>({
    invoices: [],
    expenses: [],
    metrics: {
      invoiced: 0,
      received: 0,
      outstanding: 0,
      overdue: 0,
      expenses: 0,
      netCash: 0,
    },
  });
  const [customers, setCustomers] = useState<
    { id: string; displayName: string }[]
  >([]);
  const [mode, setMode] = useState<"invoice" | "expense" | "payment" | null>(
    null,
  );
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [invoice, setInvoice] = useState(blankInvoice);
  const [expense, setExpense] = useState(blankExpense);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [payment, setPayment] = useState({
    amount: 0,
    method: "BANK_TRANSFER",
    reference: "",
    paidAt: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedFollowUpId, setExpandedFollowUpId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "revenue" | "expenses" | "invoices" | "payments">("overview");
  const [ledgerMetrics, setLedgerMetrics] = useState<LedgerData["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const canManage =
    session?.membership.permissions.includes("FINANCE_MANAGE") ?? false;
  const load = useCallback(async () => {
    const response = await authorizedRequest<FinanceResponse>("/finance");
    setData(response.data);
    const customerResponse = await authorizedRequest<CustomerResponse>(
      "/customers?pageSize=100&archived=false",
    );
    setCustomers(customerResponse.data.customers);
    setLoading(false);
  }, [authorizedRequest]);
  useEffect(() => {
    const task = setTimeout(
      () =>
        void load().catch(() => { setError("Unable to load finance records."); setLoading(false); }),
      0,
    );
    return () => clearTimeout(task);
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get("tab");
      if (["overview", "revenue", "expenses", "invoices", "payments"].includes(requestedTab ?? "")) setTab(requestedTab as typeof tab);
      if (params.get("action") === "expense" && canManage) { setTab("expenses"); setExpense(blankExpense); setEditingExpenseId(null); setMode("expense"); }
    }, 0);
    return () => clearTimeout(timer);
  }, [canManage]);
  const captureLedger = useCallback((next: LedgerData) => setLedgerMetrics(next.metrics), []);
  const currency = session?.organization.currency ?? "INR";
  async function action(task: () => Promise<void>, message: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await task();
      setMode(null);
      setSelected(null);
      setNotice(message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to complete the finance action.",
      );
    } finally {
      setSaving(false);
    }
  }
  function openPayment(item: Invoice) {
    setSelected(item);
    setPayment({
      amount: item.outstanding,
      method: "BANK_TRANSFER",
      reference: "",
      paidAt: new Date().toISOString().slice(0, 10),
    });
    setMode("payment");
  }
  async function ensureCollectionFollowUp(item: Invoice) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await authorizedRequest<{ success: true; data: { id: string; reused?: boolean } }>(`/finance/invoices/${item.id}/collection-follow-up`, { method: "POST" });
      setExpandedFollowUpId(response.data.id);
      setNotice(response.data.reused ? "Existing collection follow-up opened." : "Collection follow-up created in CRM.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to prepare the collection follow-up."); }
    finally { setSaving(false); }
  }
  function saveInvoice() {
    void action(
      () =>
        authorizedRequest("/finance/invoices", {
          method: "POST",
          body: JSON.stringify({
            customerId: invoice.customerId,
            projectId: null,
            invoiceNumber: invoice.invoiceNumber,
            status: "ISSUED",
            issueDate: new Date(`${invoice.issueDate}T00:00:00`).toISOString(),
            dueDate: new Date(`${invoice.dueDate}T00:00:00`).toISOString(),
            currency,
            discount: invoice.discount,
            tax: invoice.tax,
            notes: invoice.notes,
            items: [
              {
                description: invoice.description,
                quantity: invoice.quantity,
                unitPrice: invoice.unitPrice,
              },
            ],
          }),
        }).then(() => undefined),
      "Invoice created.",
    );
  }
  function saveExpense() {
    void action(
      () =>
        authorizedRequest(
          editingExpenseId
            ? `/finance/expenses/${editingExpenseId}`
            : "/finance/expenses",
          {
            method: editingExpenseId ? "PUT" : "POST",
            body: JSON.stringify({
              ...expense,
              projectId: null,
              currency,
              status: "RECORDED",
              expenseDate: new Date(
                `${expense.expenseDate}T00:00:00`,
              ).toISOString(),
            }),
          },
        ).then(() => undefined),
      editingExpenseId ? "Expense updated." : "Expense recorded.",
    );
  }
  function savePayment() {
    if (!selected) return;
    void action(
      () =>
        authorizedRequest(`/finance/invoices/${selected.id}/payments`, {
          method: "POST",
          body: JSON.stringify({
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference || null,
            paidAt: new Date(`${payment.paidAt}T00:00:00`).toISOString(),
          }),
        }).then(() => undefined),
      "Payment recorded.",
    );
  }
  return (
    <div className="finance-workspace" aria-busy={loading}>
      <header className="finance-heading">
        <div>
          <p>Money management</p>
          <h2>Finance</h2>
          <span>
            Track invoices, outstanding balances, collections, payments and
            expenses.
          </span>
        </div>
        {canManage && (
          <div>
            <button
              onClick={() => {
                setInvoice(blankInvoice);
                setMode("invoice");
              }}
            >
              Create invoice
            </button>
            <button
              onClick={() => {
                setExpense(blankExpense);
                setEditingExpenseId(null);
                setMode("expense");
              }}
            >
              Add expense
            </button>
          </div>
        )}
      </header>
      <nav className="finance-tabs" aria-label="Finance sections">
        {(["overview", "revenue", "expenses", "invoices", "payments"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}
      {loading ? <section className="finance-state" role="status">Loading verified finance records…</section> : <>
      {tab === "overview" && <>
        <section className="finance-metric-grid" aria-label="Current finance summary">
          <article><span>Revenue</span><strong>{ledgerMetrics ? money(ledgerMetrics.revenue, currency) : "Unavailable"}</strong><small>Selected ledger period</small></article>
          <article><span>Expenses</span><strong>{ledgerMetrics ? money(ledgerMetrics.expenses, currency) : money(data.metrics.expenses, currency)}</strong><small>Selected ledger period</small></article>
          <article className="finance-profit"><span>Profit</span><strong>{ledgerMetrics ? money(ledgerMetrics.profit, currency) : "Unavailable"}</strong><small>Revenue minus expenses</small></article>
          <article className={data.metrics.overdue > 0 ? "metric-alert" : ""}><span>Outstanding balance</span><strong>{money(data.metrics.outstanding, currency)}</strong><small>{data.metrics.overdue > 0 ? `${money(data.metrics.overdue, currency)} overdue` : "No overdue balance"}</small></article>
        </section>
        <section className="finance-next-action"><div><span>Next financial action</span><strong>{data.metrics.overdue > 0 ? "Follow up on overdue invoices" : data.metrics.outstanding > 0 ? "Review outstanding invoices" : "Keep records up to date"}</strong></div><button onClick={() => setTab(data.metrics.outstanding > 0 ? "invoices" : "expenses")}>Review</button></section>
        <FinanceLedger onData={captureLedger} />
      </>}
      {tab === "revenue" && <FinanceLedger recordType="REVENUE" />}
      {tab === "expenses" && <><div className="finance-section-heading"><div><p>EXPENSES</p><h3>Business spending</h3></div>{canManage && <button onClick={() => { setExpense(blankExpense); setEditingExpenseId(null); setMode("expense"); }}>Add expense</button>}</div><FinanceLedger recordType="EXPENSE" /><FinanceRecords
        view="expenses"
        invoices={data.invoices}
        expenses={data.expenses}
        canManage={canManage}
        saving={saving}
        expandedFollowUpId={expandedFollowUpId}
        onRecordPayment={openPayment}
        onCreateFollowUp={(item) => void ensureCollectionFollowUp(item)}
        onToggleFollowUp={(followUpId) =>
          setExpandedFollowUpId(
            expandedFollowUpId === followUpId ? null : followUpId,
          )
        }
        onEditExpense={(item) => {
          setEditingExpenseId(item.id);
          setExpense({
            title: item.title,
            category: item.category,
            vendor: item.vendor ?? "",
            amount: Number(item.amount),
            expenseDate: item.expenseDate.slice(0, 10),
            notes: item.notes ?? "",
          });
          setMode("expense");
        }}
        onArchiveExpense={(expenseId) =>
          void action(
            () =>
              authorizedRequest(`/finance/expenses/${expenseId}`, {
                method: "DELETE",
              }).then(() => undefined),
            "Expense archived.",
          )
        }
        currency={currency}
      /></>}
      {tab === "invoices" && <FinanceRecords
        view="invoices" invoices={data.invoices} expenses={data.expenses} canManage={canManage} saving={saving} expandedFollowUpId={expandedFollowUpId}
        onRecordPayment={openPayment} onCreateFollowUp={(item) => void ensureCollectionFollowUp(item)} onToggleFollowUp={(id) => setExpandedFollowUpId(expandedFollowUpId === id ? null : id)}
        onEditExpense={() => undefined} onArchiveExpense={() => undefined} currency={currency}
      />}
      {tab === "payments" && <PaymentCollectionManager invoices={data.invoices} onFinanceChanged={load} initialAction={new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("action") === "incoming" ? "incoming" : undefined} />}
      </>}
      {mode && (
        <div className="agent-modal">
          <div className="agent-dialog finance-dialog">
            <header>
              <h3>
                {mode === "invoice"
                  ? "Create invoice"
                  : mode === "expense"
                    ? "Record expense"
                    : `Record payment · ${selected?.invoiceNumber}`}
              </h3>
              <button onClick={() => setMode(null)}>×</button>
            </header>
            {error && <div className="form-alert">{error}</div>}
            {mode === "invoice" ? (
              <InvoiceEntryForm
                value={invoice}
                setValue={setInvoice}
                customers={customers}
                saving={saving}
                onSave={saveInvoice}
              />
            ) : mode === "expense" ? (
              <ExpenseEntryForm
                value={expense}
                setValue={setExpense}
                saving={saving}
                isEditing={Boolean(editingExpenseId)}
                onSave={saveExpense}
              />
            ) : (
              <PaymentEntryForm
                value={payment}
                setValue={setPayment}
                invoice={selected}
                saving={saving}
                onSave={savePayment}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
