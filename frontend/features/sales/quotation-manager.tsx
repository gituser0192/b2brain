"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Status =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED"
  | "CANCELED";
interface Item {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}
interface Quotation {
  id: string;
  quotationNumber: string;
  status: Status;
  issueDate: string;
  validUntil: string;
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  notes: string | null;
  terms: string | null;
  nextFollowUpAt: string | null;
  customer: { id: string; displayName: string };
  inquiry: { id: string; subject: string } | null;
  deal: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
  }[];
}
interface Payload {
  success: true;
  data: {
    quotations: Quotation[];
    customers: { id: string; displayName: string }[];
    inquiries: {
      id: string;
      customerId: string;
      contactName: string;
      subject: string;
    }[];
    deals: { id: string; customerId: string; name: string }[];
    metrics: {
      total: number;
      draft: number;
      awaitingDecision: number;
      acceptedValue: number;
      openValue: number;
      expiringSoon: number;
    };
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const future = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const emptyItem = (): Item => ({ description: "", quantity: 1, unitPrice: 0 });
const blank = () => ({
  customerId: "",
  inquiryId: "",
  dealId: "",
  quotationNumber: "",
  issueDate: today(),
  validUntil: future(15),
  currency: "INR",
  discount: 0,
  tax: 0,
  notes: "",
  terms: "",
  nextFollowUpAt: "",
  items: [emptyItem()],
});

export function QuotationManager() {
  const { session, authorizedRequest } = useAuth();
  const [data, setData] = useState<Payload["data"]>({
    quotations: [],
    customers: [],
    inquiries: [],
    deals: [],
    metrics: {
      total: 0,
      draft: 0,
      awaitingDecision: 0,
      acceptedValue: 0,
      openValue: 0,
      expiringSoon: 0,
    },
  });
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage =
    session?.membership.permissions.includes("DEAL_MANAGE") ?? false;
  const canConvert =
    session?.membership.permissions.includes("FINANCE_MANAGE") ?? false;
  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Payload>("/quotations");
      setData(response.data);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load quotations.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);
  const money = (value: number, currency = "INR") =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  const subtotal = form.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const total = Math.max(0, subtotal - form.discount + form.tax);
  const relatedInquiries = data.inquiries.filter(
    (item) => item.customerId === form.customerId,
  );
  const relatedDeals = data.deals.filter(
    (item) => item.customerId === form.customerId,
  );

  function show(item?: Quotation) {
    setEditing(item ?? null);
    setForm(
      item
        ? {
            customerId: item.customer.id,
            inquiryId: item.inquiry?.id ?? "",
            dealId: item.deal?.id ?? "",
            quotationNumber: item.quotationNumber,
            issueDate: item.issueDate.slice(0, 10),
            validUntil: item.validUntil.slice(0, 10),
            currency: item.currency,
            discount: Number(item.discount),
            tax: Number(item.tax),
            notes: item.notes ?? "",
            terms: item.terms ?? "",
            nextFollowUpAt: item.nextFollowUpAt?.slice(0, 16) ?? "",
            items: item.items.map((line) => ({
              description: line.description,
              quantity: Number(line.quantity),
              unitPrice: Number(line.unitPrice),
            })),
          }
        : blank(),
    );
    setOpen(true);
  }

  async function run(task: () => Promise<unknown>, message: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await task();
      setOpen(false);
      setNotice(message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to complete quotation action.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    await run(
      () =>
        authorizedRequest(
          editing ? `/quotations/${editing.id}` : "/quotations",
          {
            method: editing ? "PUT" : "POST",
            body: JSON.stringify({
              ...form,
              inquiryId: form.inquiryId || null,
              dealId: form.dealId || null,
              issueDate: new Date(`${form.issueDate}T00:00:00`).toISOString(),
              validUntil: new Date(`${form.validUntil}T23:59:59`).toISOString(),
              nextFollowUpAt: form.nextFollowUpAt
                ? new Date(form.nextFollowUpAt).toISOString()
                : null,
            }),
          },
        ),
      editing ? "Quotation updated." : "Quotation created.",
    );
  }
  async function status(
    item: Quotation,
    target: "SENT" | "ACCEPTED" | "REJECTED" | "CANCELED",
  ) {
    await run(
      () =>
        authorizedRequest(`/quotations/${item.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: target }),
        }),
      `Quotation marked ${target.toLowerCase()}.`,
    );
  }
  async function followUp(item: Quotation) {
    const date = prompt(
      "Follow-up date and time (YYYY-MM-DDTHH:mm)",
      future(2) + "T10:00",
    );
    if (!date) return;
    const note = prompt(
      "Follow-up note",
      `Check the decision on quotation ${item.quotationNumber}.`,
    );
    if (!note?.trim()) return;
    await run(
      () =>
        authorizedRequest(`/quotations/${item.id}/follow-up`, {
          method: "POST",
          body: JSON.stringify({ dueAt: new Date(date).toISOString(), note }),
        }),
      "Quotation follow-up scheduled.",
    );
  }
  async function convert(item: Quotation) {
    const invoiceNumber = prompt(
      "Invoice number",
      item.quotationNumber.replace(/^Q/i, "INV"),
    );
    if (!invoiceNumber?.trim()) return;
    const issueDate = prompt("Invoice issue date (YYYY-MM-DD)", today());
    if (!issueDate) return;
    const dueDate = prompt("Invoice due date (YYYY-MM-DD)", future(15));
    if (!dueDate) return;
    await run(
      () =>
        authorizedRequest(`/quotations/${item.id}/convert`, {
          method: "POST",
          body: JSON.stringify({
            invoiceNumber,
            issueDate: new Date(`${issueDate}T00:00:00`).toISOString(),
            dueDate: new Date(`${dueDate}T23:59:59`).toISOString(),
          }),
        }),
      "Quotation converted into an issued invoice.",
    );
  }

  return (
    <section className="quotation-manager">
      <header>
        <div>
          <p>Quote to cash</p>
          <h2>Quotations</h2>
          <span>
            Turn real customer requirements into approved revenue and invoices.
          </span>
        </div>
        {canManage && <button onClick={() => show()}>+ New quotation</button>}
      </header>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="quotation-metrics">
        <article>
          <span>Open value</span>
          <strong>
            {money(data.metrics.openValue, session?.organization.currency)}
          </strong>
        </article>
        <article>
          <span>Awaiting decision</span>
          <strong>{data.metrics.awaitingDecision}</strong>
        </article>
        <article>
          <span>Accepted value</span>
          <strong>
            {money(data.metrics.acceptedValue, session?.organization.currency)}
          </strong>
        </article>
        <article className={data.metrics.expiringSoon ? "warning" : ""}>
          <span>Expiring in 3 days</span>
          <strong>{data.metrics.expiringSoon}</strong>
        </article>
      </div>
      {data.quotations.length === 0 ? (
        <div className="quotation-empty">
          <strong>No quotations yet</strong>
          <span>
            Create the first quotation from a real CRM customer. Nothing is
            pre-filled or seeded.
          </span>
        </div>
      ) : (
        <div className="quotation-list">
          {data.quotations.map((item) => (
            <article
              key={item.id}
              className={`status-${item.status.toLowerCase()}`}
            >
              <div>
                <span>{item.status}</span>
                <h3>{item.quotationNumber}</h3>
                <p>
                  {item.customer.displayName}
                  {item.deal ? ` · ${item.deal.name}` : ""}
                </p>
                <small>
                  Valid until{" "}
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                  }).format(new Date(item.validUntil))}
                </small>
              </div>
              <div className="quotation-value">
                <strong>{money(Number(item.total), item.currency)}</strong>
                <small>
                  {item.items.length} line item
                  {item.items.length === 1 ? "" : "s"}
                </small>
                {item.invoice && <b>Invoice {item.invoice.invoiceNumber}</b>}
              </div>
              {canManage && (
                <footer>
                      {["DRAFT", "SENT", "EXPIRED"].includes(item.status) && (
                    <button onClick={() => show(item)}>Edit</button>
                  )}
                  {["DRAFT", "EXPIRED"].includes(item.status) && (
                    <button onClick={() => void status(item, "SENT")}>
                      Mark sent
                    </button>
                  )}
                  {item.status === "SENT" && (
                    <>
                      <button onClick={() => void status(item, "ACCEPTED")}>
                        Accept
                      </button>
                      <button onClick={() => void status(item, "REJECTED")}>
                        Reject
                      </button>
                    </>
                  )}
                  {["DRAFT", "SENT", "EXPIRED"].includes(item.status) && (
                    <button onClick={() => void followUp(item)}>
                      Follow-up
                    </button>
                  )}
                  {item.status === "ACCEPTED" && canConvert && (
                    <button
                      className="convert"
                      onClick={() => void convert(item)}
                    >
                      Create invoice
                    </button>
                  )}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog quotation-dialog">
            <header>
              <div>
                <p>Commercial document</p>
                <h3>{editing ? "Edit quotation" : "Create quotation"}</h3>
              </div>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="quotation-form-grid">
              <label>
                <span>Customer</span>
                <select
                  value={form.customerId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customerId: event.target.value,
                      inquiryId: "",
                      dealId: "",
                    })
                  }
                >
                  <option value="">Select customer</option>
                  {data.customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Quotation number</span>
                <input
                  value={form.quotationNumber}
                  onChange={(event) =>
                    setForm({ ...form, quotationNumber: event.target.value })
                  }
                  placeholder="Q-0001"
                />
              </label>
              <label>
                <span>Issue date</span>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(event) =>
                    setForm({ ...form, issueDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Valid until</span>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(event) =>
                    setForm({ ...form, validUntil: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Related inquiry</span>
                <select
                  value={form.inquiryId}
                  onChange={(event) =>
                    setForm({ ...form, inquiryId: event.target.value })
                  }
                >
                  <option value="">None</option>
                  {relatedInquiries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.subject}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Related deal</span>
                <select
                  value={form.dealId}
                  onChange={(event) =>
                    setForm({ ...form, dealId: event.target.value })
                  }
                >
                  <option value="">None</option>
                  {relatedDeals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <section className="quotation-lines">
              <header>
                <strong>Line items</strong>
                <button
                  onClick={() =>
                    setForm({ ...form, items: [...form.items, emptyItem()] })
                  }
                >
                  + Add line
                </button>
              </header>
              {form.items.map((item, index) => (
                <div key={index}>
                  <input
                    value={item.description}
                    placeholder="Product or service"
                    onChange={(event) => {
                      const items = [...form.items];
                      items[index] = {
                        ...item,
                        description: event.target.value,
                      };
                      setForm({ ...form, items });
                    }}
                  />
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    title="Quantity"
                    onChange={(event) => {
                      const items = [...form.items];
                      items[index] = {
                        ...item,
                        quantity: Number(event.target.value),
                      };
                      setForm({ ...form, items });
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    title="Unit price"
                    onChange={(event) => {
                      const items = [...form.items];
                      items[index] = {
                        ...item,
                        unitPrice: Number(event.target.value),
                      };
                      setForm({ ...form, items });
                    }}
                  />
                  <strong>
                    {money(item.quantity * item.unitPrice, form.currency)}
                  </strong>
                  <button
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        items: form.items.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>
            <div className="quotation-form-grid">
              <label>
                <span>Discount</span>
                <input
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(event) =>
                    setForm({ ...form, discount: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Tax</span>
                <input
                  type="number"
                  min="0"
                  value={form.tax}
                  onChange={(event) =>
                    setForm({ ...form, tax: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Currency</span>
                <input
                  maxLength={3}
                  value={form.currency}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label>
                <span>Follow-up time</span>
                <input
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={(event) =>
                    setForm({ ...form, nextFollowUpAt: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              <span>Terms</span>
              <textarea
                value={form.terms}
                onChange={(event) =>
                  setForm({ ...form, terms: event.target.value })
                }
                placeholder="Payment and delivery terms"
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
            <div className="quotation-total">
              <span>Subtotal {money(subtotal, form.currency)}</span>
              <strong>Total {money(total, form.currency)}</strong>
            </div>
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={
                  saving ||
                  !form.customerId ||
                  !form.quotationNumber ||
                  !form.issueDate ||
                  !form.validUntil ||
                  form.currency.length !== 3 ||
                  form.items.some(
                    (item) =>
                      !item.description ||
                      item.quantity <= 0 ||
                      item.unitPrice < 0,
                  )
                }
                onClick={() => void save()}
              >
                {saving ? "Saving..." : "Save quotation"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
