"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Item = {
  id: string;
  source: string;
  type: string;
  status: string;
  priority: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  subject: string;
  message: string;
  campaignId: string | null;
  assignedEmployeeId: string | null;
  responseDueAt: string | null;
  disqualifiedReason: string | null;
  createdAt: string;
  customer: {
    displayName: string;
    email: string | null;
    phone: string | null;
  } | null;
  assignedEmployee: { firstName: string; lastName: string | null } | null;
  timeline: {
    id: string;
    summary: string;
    details: string | null;
    createdAt: string;
    createdBy: { firstName: string };
  }[];
};
type Ref = {
  id: string;
  firstName?: string;
  lastName?: string | null;
  name?: string;
};
type Payload = {
  success: true;
  data: {
    inquiries: Item[];
    employees: Ref[];
    campaigns: Ref[];
    metrics: Record<string, number>;
  };
};
const blank = () => ({
  source: "MANUAL",
  type: "UNCLASSIFIED",
  status: "NEW",
  priority: "MEDIUM",
  contactName: "",
  email: "",
  phone: "",
  companyName: "",
  subject: "",
  message: "",
  campaignId: "",
  assignedEmployeeId: "",
  responseDueAt: "",
  disqualifiedReason: "",
});
export function InquiryWorkspace() {
  const { session, authorizedRequest } = useAuth(),
    [items, setItems] = useState<Item[]>([]),
    [employees, setEmployees] = useState<Ref[]>([]),
    [campaigns, setCampaigns] = useState<Ref[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [chosen, setChosen] = useState<Item | null>(null),
    [form, setForm] = useState(blank()),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const manage =
      session?.membership.permissions.includes("INQUIRY_MANAGE") ?? false,
    canConvert =
      session?.membership.permissions.includes("INQUIRY_CONVERT") ?? false;
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<Payload>("/inquiries");
      setItems(r.data.inquiries);
      setEmployees(r.data.employees);
      setCampaigns(r.data.campaigns);
      setMetrics(r.data.metrics);
      setChosen(
        (c) =>
          r.data.inquiries.find((x) => x.id === c?.id) ??
          r.data.inquiries[0] ??
          null,
      );
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load inquiries.");
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  function show(i?: Item) {
    setChosen(i ?? null);
    setForm(
      i
        ? {
            source: i.source,
            type: i.type,
            status: i.status,
            priority: i.priority,
            contactName: i.contactName,
            email: i.email ?? "",
            phone: i.phone ?? "",
            companyName: i.companyName ?? "",
            subject: i.subject,
            message: i.message,
            campaignId: i.campaignId ?? "",
            assignedEmployeeId: i.assignedEmployeeId ?? "",
            responseDueAt: i.responseDueAt?.slice(0, 16) ?? "",
            disqualifiedReason: i.disqualifiedReason ?? "",
          }
        : blank(),
    );
    setOpen(true);
  }
  async function save() {
    try {
      await authorizedRequest(
        chosen ? `/inquiries/${chosen.id}` : "/inquiries",
        {
          method: chosen ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            email: form.email || null,
            phone: form.phone || null,
            companyName: form.companyName || null,
            campaignId: form.campaignId || null,
            assignedEmployeeId: form.assignedEmployeeId || null,
            responseDueAt: form.responseDueAt
              ? new Date(form.responseDueAt).toISOString()
              : null,
            disqualifiedReason: form.disqualifiedReason || null,
          }),
        },
      );
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to save inquiry.");
    }
  }
  async function note() {
    if (!chosen) return;
    const value = prompt("Internal note");
    if (value) {
      await authorizedRequest(`/inquiries/${chosen.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: value }),
      });
      await load();
    }
  }
  async function convert(target: "CUSTOMER" | "DEAL" | "SUPPORT") {
    if (!chosen) return;
    let body: Record<string, unknown> = { target };
    if (target === "DEAL") {
      const name = prompt("Deal name", chosen.subject),
        amount = Number(prompt("Expected amount", "0"));
      if (!name || Number.isNaN(amount)) return;
      body = {
        target,
        name,
        amount,
        currency: "INR",
        probability: 50,
        expectedCloseDate: null,
      };
    }
    if (target === "SUPPORT")
      body = {
        target,
        subject: chosen.subject,
        description: chosen.message,
        priority: chosen.priority,
      };
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/convert`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Conversion failed.");
    }
  }
  return (
    <div className="inquiry-workspace">
      <header className="project-heading">
        <div>
          <p>Controlled intake</p>
          <h2>Lead & inquiry inbox</h2>
          <span>Capture, classify and explicitly convert real inquiries.</span>
        </div>
        {manage && <button onClick={() => show()}>+ Capture inquiry</button>}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <section className="inquiry-metrics">
        {Object.entries(metrics).map(([k, v]) => (
          <article key={k}>
            <span>{k}</span>
            <strong>{k === "conversionRate" ? `${v.toFixed(0)}%` : v}</strong>
          </article>
        ))}
      </section>
      {!items.length ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>No inquiries yet</h3>
          <p>
            Your workspace starts empty. Capture the first real inquiry when it
            arrives.
          </p>
        </section>
      ) : (
        <div className="inquiry-layout">
          <section className="inquiry-list">
            {items.map((i) => (
              <button
                key={i.id}
                className={chosen?.id === i.id ? "active" : ""}
                onClick={() => setChosen(i)}
              >
                <span>
                  {i.source} · {i.priority}
                </span>
                <strong>{i.subject}</strong>
                <p>{i.contactName}</p>
                <b>
                  {i.type.replaceAll("_", " ")} · {i.status}
                </b>
              </button>
            ))}
          </section>
          {chosen && (
            <section className="inquiry-detail">
              <header>
                <div>
                  <p>
                    {chosen.source} ·{" "}
                    {new Date(chosen.createdAt).toLocaleString()}
                  </p>
                  <h3>{chosen.subject}</h3>
                  <span>
                    {chosen.contactName} · {chosen.email || chosen.phone}
                  </span>
                </div>
                {manage && chosen.status !== "CONVERTED" && (
                  <button onClick={() => show(chosen)}>Edit</button>
                )}
              </header>
              {chosen.customer && (
                <div className="duplicate-match">
                  <strong>Existing CRM match</strong>
                  <span>{chosen.customer.displayName}</span>
                </div>
              )}
              <div className="ticket-description">
                <p>{chosen.message}</p>
              </div>
              {canConvert && chosen.status === "QUALIFIED" && (
                <div className="inquiry-convert">
                  <strong>Explicit conversion</strong>
                  <button onClick={() => void convert("CUSTOMER")}>
                    Customer
                  </button>
                  <button onClick={() => void convert("DEAL")}>
                    Sales deal
                  </button>
                  <button onClick={() => void convert("SUPPORT")}>
                    Support ticket
                  </button>
                </div>
              )}
              <section className="inquiry-timeline">
                <header>
                  <strong>Activity</strong>
                  {manage && (
                    <button onClick={() => void note()}>+ Note</button>
                  )}
                </header>
                {chosen.timeline.map((t) => (
                  <article key={t.id}>
                    <div>
                      <strong>{t.summary}</strong>
                      {t.details && <p>{t.details}</p>}
                      <small>
                        {t.createdBy.firstName} ·{" "}
                        {new Date(t.createdAt).toLocaleString()}
                      </small>
                    </div>
                  </article>
                ))}
              </section>
            </section>
          )}
        </div>
      )}
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog inquiry-dialog">
            <header>
              <h3>{chosen ? "Update" : "Capture"} inquiry</h3>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="agent-form-grid">
              {(["source", "type", "status", "priority"] as const).map(
                (key) => (
                  <label key={key}>
                    <span>{key}</span>
                    <select
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    >
                      {{
                        source: [
                          "MANUAL",
                          "WEBSITE",
                          "WHATSAPP",
                          "EMAIL",
                          "PHONE",
                          "SOCIAL",
                          "REFERRAL",
                          "STORE",
                          "OTHER",
                        ],
                        type: [
                          "UNCLASSIFIED",
                          "SALES",
                          "PRODUCT_QUESTION",
                          "SUPPORT",
                          "COMPLAINT",
                          "ORDER_REQUEST",
                          "PARTNERSHIP",
                          "SPAM",
                          "OTHER",
                        ],
                        status: [
                          "NEW",
                          "REVIEWING",
                          "QUALIFIED",
                          "DISQUALIFIED",
                          "SPAM",
                        ],
                        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                      }[key].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                ),
              )}
              {(["contactName", "companyName", "email", "phone"] as const).map(
                (key) => (
                  <label key={key}>
                    <span>{key}</span>
                    <input
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ),
              )}
              <label>
                <span>Assigned employee</span>
                <select
                  value={form.assignedEmployeeId}
                  onChange={(e) =>
                    setForm({ ...form, assignedEmployeeId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {employees.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.firstName} {x.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Campaign</span>
                <select
                  value={form.campaignId}
                  onChange={(e) =>
                    setForm({ ...form, campaignId: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {campaigns.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Response due</span>
                <input
                  type="datetime-local"
                  value={form.responseDueAt}
                  onChange={(e) =>
                    setForm({ ...form, responseDueAt: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              <span>Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label>
              <span>Message</span>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
            {form.status === "DISQUALIFIED" && (
              <label>
                <span>Reason</span>
                <textarea
                  value={form.disqualifiedReason}
                  onChange={(e) =>
                    setForm({ ...form, disqualifiedReason: e.target.value })
                  }
                />
              </label>
            )}
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={
                  !form.contactName ||
                  !form.subject ||
                  !form.message ||
                  (!form.email && !form.phone)
                }
                onClick={() => void save()}
              >
                Save
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
