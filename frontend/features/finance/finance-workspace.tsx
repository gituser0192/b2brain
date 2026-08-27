"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { PaymentCollectionManager } from "./payment-collection-manager";
import { FinanceLedger } from "./finance-ledger";
interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  dueDate: string;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  customer: { id: string; displayName: string };
  payments: { amount: string }[];
  collectionFollowUps: { id: string; title: string; description: string | null; dueAt: string; status: string; assignedTo: { id: string; firstName: string; lastName: string | null } }[];
}
interface Expense {
  id: string;
  title: string;
  category: string;
  amount: string;
  expenseDate: string;
  vendor: string | null;
  notes: string | null;
  status: "RECORDED" | "VOIDED";
}
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
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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
  const canManage =
    session?.membership.permissions.includes("FINANCE_MANAGE") ?? false;
  const load = useCallback(async () => {
    const response = await authorizedRequest<FinanceResponse>("/finance");
    setData(response.data);
    const customerResponse = await authorizedRequest<CustomerResponse>(
      "/customers?pageSize=100&archived=false",
    );
    setCustomers(customerResponse.data.customers);
  }, [authorizedRequest]);
  useEffect(() => {
    const task = setTimeout(
      () =>
        void load().catch(() => setError("Unable to load finance records.")),
      0,
    );
    return () => clearTimeout(task);
  }, [load]);
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
  return (
    <div className="finance-workspace">
      <header className="project-heading">
        <div>
          <p>Finance service</p>
          <h2>Accounts receivable</h2>
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
              + Invoice
            </button>
            <button
              onClick={() => {
                setExpense(blankExpense);
                setEditingExpenseId(null);
                setMode("expense");
              }}
            >
              + Expense
            </button>
          </div>
        )}
      </header>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}
      <section className="sales-metrics">
        {Object.entries(data.metrics).map(([key, value]) => (
          <article
            key={key}
            className={key === "overdue" && value > 0 ? "metric-alert" : ""}
          >
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
            <strong>{money(value)}</strong>
          </article>
        ))}
      </section>
      <FinanceLedger />
      <PaymentCollectionManager />
      <div className="finance-columns">
        <section>
          <h3>Customer invoices</h3>
          {data.invoices.length === 0 ? (
            <div className="finance-empty">
              <strong>No invoices yet</strong>
              <p>Create the first real customer invoice when you are ready.</p>
            </div>
          ) : (
            data.invoices.map((item) => (
              <article
                key={item.id}
                className={item.status === "OVERDUE" ? "invoice-overdue" : ""}
              >
                <div>
                  <strong>{item.invoiceNumber}</strong>
                  <small>
                    {item.customer.displayName} · {item.status}
                    {item.daysOverdue
                      ? ` · ${item.daysOverdue} days overdue`
                      : ""}
                  </small>
                  <small>
                    Due{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(item.dueDate))}
                  </small>
                </div>
                <div className="invoice-balance">
                  <small>Total {money(Number(item.total))}</small>
                  <strong>{money(item.outstanding)} due</strong>
                  <small>{money(item.paid)} received</small>
                </div>
                {canManage &&
                  item.outstanding > 0 &&
                  !["DRAFT", "CANCELED"].includes(item.status) && (
                    <div className="invoice-actions">
                      <button onClick={() => openPayment(item)}>
                        Record payment
                      </button>
                      {item.collectionFollowUps[0] ? <button onClick={() => setExpandedFollowUpId(expandedFollowUpId === item.collectionFollowUps[0]!.id ? null : item.collectionFollowUps[0]!.id)}>View existing follow-up</button> : <button disabled={saving} onClick={() => void ensureCollectionFollowUp(item)}>Create follow-up</button>}
                    </div>
                  )}
                {item.collectionFollowUps[0] && expandedFollowUpId === item.collectionFollowUps[0].id && <div className="invoice-follow-up-detail"><strong>{item.collectionFollowUps[0].title}</strong><span>{item.collectionFollowUps[0].status} · Due {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.collectionFollowUps[0].dueAt))}</span><span>Assigned to {item.collectionFollowUps[0].assignedTo.firstName} {item.collectionFollowUps[0].assignedTo.lastName ?? ""}</span>{item.collectionFollowUps[0].description && <p>{item.collectionFollowUps[0].description}</p>}</div>}
              </article>
            ))
          )}
        </section>
        <section>
          <h3>Expenses</h3>
          {data.expenses.length === 0 ? (
            <div className="finance-empty">
              <strong>No expenses yet</strong>
              <p>Recorded business expenses will appear here.</p>
            </div>
          ) : (
            data.expenses.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.category}</small>
                </div>
                <strong>{money(Number(item.amount))}</strong>
                {canManage && <div className="invoice-actions"><button onClick={() => { setEditingExpenseId(item.id); setExpense({ title: item.title, category: item.category, vendor: item.vendor ?? "", amount: Number(item.amount), expenseDate: item.expenseDate.slice(0,10), notes: item.notes ?? "" }); setMode("expense"); }}>Edit</button><button onClick={() => void action(() => authorizedRequest(`/finance/expenses/${item.id}`, { method: "DELETE" }).then(() => undefined), "Expense archived.")}>Archive</button></div>}
              </article>
            ))
          )}
        </section>
      </div>
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
              <>
                <label>
                  <span>Customer</span>
                  <select
                    value={invoice.customerId}
                    onChange={(event) =>
                      setInvoice({ ...invoice, customerId: event.target.value })
                    }
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="agent-form-grid">
                  <label>
                    <span>Invoice number</span>
                    <input
                      value={invoice.invoiceNumber}
                      onChange={(event) =>
                        setInvoice({
                          ...invoice,
                          invoiceNumber: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Issue date</span>
                    <input
                      type="date"
                      value={invoice.issueDate}
                      onChange={(event) =>
                        setInvoice({
                          ...invoice,
                          issueDate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Due date</span>
                    <input
                      type="date"
                      value={invoice.dueDate}
                      onChange={(event) =>
                        setInvoice({ ...invoice, dueDate: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Item</span>
                    <input
                      value={invoice.description}
                      onChange={(event) =>
                        setInvoice({
                          ...invoice,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={invoice.quantity}
                      onChange={(event) =>
                        setInvoice({
                          ...invoice,
                          quantity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Unit price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoice.unitPrice}
                      onChange={(event) =>
                        setInvoice({
                          ...invoice,
                          unitPrice: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    disabled={
                      saving ||
                      !invoice.customerId ||
                      !invoice.invoiceNumber ||
                      !invoice.issueDate ||
                      !invoice.dueDate ||
                      !invoice.description
                    }
                    onClick={() =>
                      void action(
                        () =>
                          authorizedRequest("/finance/invoices", {
                            method: "POST",
                            body: JSON.stringify({
                              customerId: invoice.customerId,
                              projectId: null,
                              invoiceNumber: invoice.invoiceNumber,
                              status: "ISSUED",
                              issueDate: new Date(
                                `${invoice.issueDate}T00:00:00`,
                              ).toISOString(),
                              dueDate: new Date(
                                `${invoice.dueDate}T00:00:00`,
                              ).toISOString(),
                              currency: "INR",
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
                      )
                    }
                  >
                    {saving ? "Saving..." : "Create invoice"}
                  </button>
                </footer>
              </>
            ) : mode === "expense" ? (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Title</span>
                    <input
                      value={expense.title}
                      onChange={(event) =>
                        setExpense({ ...expense, title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Category</span>
                    <input
                      value={expense.category}
                      onChange={(event) =>
                        setExpense({ ...expense, category: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={expense.amount}
                      onChange={(event) =>
                        setExpense({
                          ...expense,
                          amount: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      value={expense.expenseDate}
                      onChange={(event) =>
                        setExpense({
                          ...expense,
                          expenseDate: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    disabled={
                      saving ||
                      !expense.title ||
                      !expense.category ||
                      !expense.expenseDate ||
                      expense.amount <= 0
                    }
                    onClick={() =>
                      void action(
                        () =>
                          authorizedRequest(editingExpenseId ? `/finance/expenses/${editingExpenseId}` : "/finance/expenses", {
                            method: editingExpenseId ? "PUT" : "POST",
                            body: JSON.stringify({
                              ...expense,
                              projectId: null,
                              currency: "INR",
                              status: "RECORDED",
                              expenseDate: new Date(
                                `${expense.expenseDate}T00:00:00`,
                              ).toISOString(),
                            }),
                          }).then(() => undefined),
                        editingExpenseId ? "Expense updated." : "Expense recorded.",
                      )
                    }
                  >
                    {saving ? "Saving..." : editingExpenseId ? "Update expense" : "Record expense"}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <p className="payment-balance">
                  Outstanding balance:{" "}
                  <strong>{money(selected?.outstanding ?? 0)}</strong>
                </p>
                <div className="agent-form-grid">
                  <label>
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0.01"
                      max={selected?.outstanding}
                      step="0.01"
                      value={payment.amount}
                      onChange={(event) =>
                        setPayment({
                          ...payment,
                          amount: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Method</span>
                    <select
                      value={payment.method}
                      onChange={(event) =>
                        setPayment({ ...payment, method: event.target.value })
                      }
                    >
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Payment reference</span>
                    <input
                      value={payment.reference}
                      onChange={(event) =>
                        setPayment({
                          ...payment,
                          reference: event.target.value,
                        })
                      }
                      placeholder="UTR, receipt or transaction ID"
                    />
                  </label>
                  <label>
                    <span>Paid date</span>
                    <input
                      type="date"
                      value={payment.paidAt}
                      onChange={(event) =>
                        setPayment({ ...payment, paidAt: event.target.value })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    disabled={
                      saving ||
                      !selected ||
                      payment.amount <= 0 ||
                      payment.amount > (selected?.outstanding ?? 0) ||
                      !payment.paidAt
                    }
                    onClick={() =>
                      selected &&
                      void action(
                        () =>
                          authorizedRequest(
                            `/finance/invoices/${selected.id}/payments`,
                            {
                              method: "POST",
                              body: JSON.stringify({
                                amount: payment.amount,
                                method: payment.method,
                                reference: payment.reference || null,
                                paidAt: new Date(
                                  `${payment.paidAt}T00:00:00`,
                                ).toISOString(),
                              }),
                            },
                          ).then(() => undefined),
                        "Payment recorded.",
                      )
                    }
                  >
                    {saving ? "Saving..." : "Record payment"}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
