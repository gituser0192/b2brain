"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

interface Message {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string | null };
}
interface Request {
  id: string;
  requestNumber: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  customerUpdate: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}
interface Response {
  success: true;
  data: { requests: Request[] };
}
const blank = {
  category: "TECHNICAL_SUPPORT",
  subject: "",
  description: "",
  priority: "MEDIUM",
};
const categories = [
  "PLAN_BILLING",
  "WEBSITE",
  "CRM",
  "MARKETING",
  "AUTOMATION",
  "FINANCE",
  "PROJECTS",
  "TECHNICAL_SUPPORT",
  "OTHER",
];

export function ServiceRequestWorkspace() {
  const { authorizedRequest } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Request | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Response>("/service-requests");
      setRequests(response.data.requests);
      setSelected((current) =>
        current
          ? (response.data.requests.find((item) => item.id === current.id) ??
            response.data.requests[0] ??
            null)
          : (response.data.requests[0] ?? null),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load your B² Brain requests.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function submit() {
    try {
      await authorizedRequest("/service-requests", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(blank);
      setOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to submit your request.",
      );
    }
  }
  async function send() {
    if (!selected || !message.trim()) return;
    try {
      await authorizedRequest(`/service-requests/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: message }),
      });
      setMessage("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to send your message.",
      );
    }
  }

  return (
    <div className="provider-help-workspace">
      <header className="project-heading">
        <div>
          <p>B² Brain customer care</p>
          <h2>Help & service requests</h2>
          <span>
            Request an update, report a problem, or ask B² Brain for help with
            any service.
          </span>
        </div>
        <button onClick={() => setOpen(true)}>+ Contact B² Brain</button>
      </header>
      <div className="provider-help-security">
        Only your organization and authorized B² Brain staff can see these
        requests.
      </div>
      {error && <div className="dashboard-notice error">{error}</div>}
      {requests.length === 0 ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>No requests yet</h3>
          <p>
            When you need help, create a request and it will go directly to B²
            Brain.
          </p>
          <button onClick={() => setOpen(true)}>
            Create your first request
          </button>
        </section>
      ) : (
        <section className="provider-help-layout">
          <aside className="provider-help-list">
            {requests.map((item) => (
              <button
                key={item.id}
                className={selected?.id === item.id ? "active" : ""}
                onClick={() => setSelected(item)}
              >
                <small>
                  {item.requestNumber} · {item.category.replaceAll("_", " ")}
                </small>
                <strong>{item.subject}</strong>
                <span>
                  {item.status.replaceAll("_", " ")} · {item.priority}
                </span>
              </button>
            ))}
          </aside>
          {selected && (
            <article className="provider-help-detail">
              <header>
                <div>
                  <small>
                    {selected.requestNumber} ·{" "}
                    {selected.category.replaceAll("_", " ")}
                  </small>
                  <h3>{selected.subject}</h3>
                </div>
                <i>{selected.status.replaceAll("_", " ")}</i>
              </header>
              <section>
                <small>YOUR REQUEST</small>
                <p>{selected.description}</p>
              </section>
              {selected.customerUpdate && (
                <div className="provider-help-update">
                  <small>LATEST B² BRAIN UPDATE</small>
                  <strong>{selected.customerUpdate}</strong>
                </div>
              )}
              <div className="provider-help-conversation">
                <h4>Conversation</h4>
                {selected.messages.map((item) => (
                  <article
                    key={item.id}
                    className={
                      item.type === "PROVIDER_REPLY" ? "provider" : "customer"
                    }
                  >
                    <header>
                      <strong>
                        {item.type === "PROVIDER_REPLY"
                          ? "B² Brain"
                          : item.type === "SYSTEM_EVENT"
                            ? "Status"
                            : `${item.createdBy.firstName} ${item.createdBy.lastName ?? ""}`}
                      </strong>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </header>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
              {!["COMPLETED", "CANCELED"].includes(selected.status) && (
                <div className="provider-help-reply">
                  <textarea
                    rows={3}
                    placeholder="Add more information or reply to B² Brain…"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <button
                    disabled={!message.trim()}
                    onClick={() => void send()}
                  >
                    Send message
                  </button>
                </div>
              )}
            </article>
          )}
        </section>
      )}
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog">
            <header>
              <div>
                <p>Secure request</p>
                <h3>Contact B² Brain</h3>
              </div>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <label>
              <span>What do you need help with?</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject</span>
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm({ ...form, subject: event.target.value })
                }
                placeholder="Briefly describe your request"
              />
            </label>
            <label>
              <span>Details</span>
              <textarea
                rows={6}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Explain the problem, requested update, or expected outcome…"
              />
            </label>
            <label>
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value })
                }
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </label>
            <div className="provider-request-warning">
              Submitting shares only this request with B² Brain. It does not
              expose your CRM, finance, or other private records.
            </div>
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={
                  form.subject.trim().length < 3 ||
                  form.description.trim().length < 5
                }
                onClick={() => void submit()}
              >
                Submit securely
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
