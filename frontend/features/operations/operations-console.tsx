"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Status =
  | "SUBMITTED"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "WAITING_CUSTOMER"
  | "AWAITING_CUSTOMER_APPROVAL"
  | "COMPLETED"
  | "CANCELED";
interface Operator {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
}
interface ManagedRequest {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  risk: string;
  deadline: string | null;
  submittedToProviderAt: string;
  providerStatus: Status;
  providerAssignedToId: string | null;
  providerCustomerUpdate: string | null;
  providerInternalNote: string | null;
  providerUpdatedAt: string | null;
  organization: { id: string; name: string; slug: string };
  website: {
    id: string;
    name: string;
    domain: string;
    platform: string;
    status: string;
  };
}
interface ServiceMessage { id: string; type: string; body: string; customerVisible: boolean; createdAt: string; createdBy: { firstName: string; lastName: string | null } }
interface ProviderRequest {
  id: string; requestNumber: string; category: string; subject: string; description: string; priority: string; status: Status;
  assignedToId: string | null; customerUpdate: string | null; internalNote: string | null; createdAt: string; updatedAt: string;
  organization: { id: string; name: string; slug: string }; createdBy: { firstName: string; lastName: string | null; email: string }; messages: ServiceMessage[];
}
interface Response {
  success: true;
  data: {
    requests: ManagedRequest[];
    serviceRequests: ProviderRequest[];
    operators: Operator[];
    metrics: { total: number; new: number; active: number; waiting: number };
  };
}

const statuses: Status[] = [
  "SUBMITTED",
  "TRIAGED",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "AWAITING_CUSTOMER_APPROVAL",
  "COMPLETED",
  "CANCELED",
];

export function OperationsConsole() {
  const router = useRouter();
  const { session, isLoading, authorizedRequest, logout } = useAuth();
  const [requests, setRequests] = useState<ManagedRequest[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ProviderRequest[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceForm, setServiceForm] = useState({ status: "SUBMITTED" as Status, assignedToId: "", customerUpdate: "", internalNote: "" });
  const [reply, setReply] = useState("");
  const [replyType, setReplyType] = useState<"PROVIDER_REPLY" | "INTERNAL_NOTE">("PROVIDER_REPLY");
  const [operators, setOperators] = useState<Operator[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    new: 0,
    active: 0,
    waiting: 0,
  });
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    status: "SUBMITTED" as Status,
    assignedToId: "",
    customerUpdate: "",
    internalNote: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Response>("/managed-services");
      setRequests(response.data.requests);
      setServiceRequests(response.data.serviceRequests);
      setOperators(response.data.operators);
      setMetrics(response.data.metrics);
      const next =
        response.data.requests.find((item) => item.id === selectedId) ??
        response.data.requests[0] ??
        null;
      setSelectedId(next?.id ?? "");
      if (next)
        setForm({
          status: next.providerStatus,
          assignedToId: next.providerAssignedToId ?? "",
          customerUpdate: next.providerCustomerUpdate ?? "",
          internalNote: next.providerInternalNote ?? "",
        });
      const nextService = response.data.serviceRequests.find((item) => item.id === selectedServiceId) ?? response.data.serviceRequests[0] ?? null;
      setSelectedServiceId(nextService?.id ?? "");
      if (nextService) setServiceForm({ status: nextService.status, assignedToId: nextService.assignedToId ?? "", customerUpdate: nextService.customerUpdate ?? "", internalNote: nextService.internalNote ?? "" });
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load B² Brain Operations.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, selectedId, selectedServiceId]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (!isLoading && session && !session.user.isPlatformAdmin)
      router.replace("/dashboard");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session?.user.isPlatformAdmin) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [session, load]);
  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) ?? null,
    [requests, selectedId],
  );
  const selectedService = useMemo(() => serviceRequests.find((item) => item.id === selectedServiceId) ?? null, [serviceRequests, selectedServiceId]);
  function selectRequest(item: ManagedRequest) {
    setSelectedId(item.id);
    setForm({
      status: item.providerStatus,
      assignedToId: item.providerAssignedToId ?? "",
      customerUpdate: item.providerCustomerUpdate ?? "",
      internalNote: item.providerInternalNote ?? "",
    });
  }
  function selectServiceRequest(item: ProviderRequest) {
    setSelectedServiceId(item.id);
    setServiceForm({ status: item.status, assignedToId: item.assignedToId ?? "", customerUpdate: item.customerUpdate ?? "", internalNote: item.internalNote ?? "" });
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await authorizedRequest(`/managed-services/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || null,
          internalNote: form.internalNote || null,
        }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to update this request.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveServiceRequest() {
    if (!selectedService) return;
    setSaving(true); setError("");
    try {
      await authorizedRequest(`/managed-services/service-requests/${selectedService.id}`, { method: "PATCH", body: JSON.stringify({ ...serviceForm, assignedToId: serviceForm.assignedToId || null, internalNote: serviceForm.internalNote || null }) });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update this service request."); }
    finally { setSaving(false); }
  }
  async function sendServiceReply() {
    if (!selectedService || !reply.trim()) return;
    setSaving(true); setError("");
    try {
      await authorizedRequest(`/managed-services/service-requests/${selectedService.id}/messages`, { method: "POST", body: JSON.stringify({ type: replyType, body: reply }) });
      setReply(""); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save the message."); }
    finally { setSaving(false); }
  }

  if (isLoading || loading || !session?.user.isPlatformAdmin)
    return (
      <main className="screen-loader">
        <span className="spinner dark" />
        <p>Opening B² Brain Operations…</p>
      </main>
    );
  return (
    <div className="operations-shell">
      <aside className="operations-sidebar">
        <div className="dashboard-logo">
          <Image src="/brand/b2brain-logo.png" alt="" width={40} height={40} />
          <span>
            <strong>B² Brain</strong>
            <small>Operations</small>
          </span>
        </div>
        <div className="operations-nav-title">Service delivery</div>
        <button className="active">
          Service desk <b>{metrics.total}</b>
        </button>
        <div className="operations-sidebar-footer">
          <button onClick={() => router.push("/super-admin")}>
            Super Admin
          </button>
          <button onClick={() => router.push("/dashboard")}>
            Organization workspace
          </button>
          <button
            onClick={() => void logout().then(() => router.replace("/login"))}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="operations-main">
        <header>
          <div>
            <p>PROVIDER DELIVERY DESK</p>
            <h1>Managed service requests</h1>
            <span>
              Work on customer-approved scope without opening their private
              business workspace.
            </span>
          </div>
        </header>
        {error && <div className="dashboard-notice error">{error}</div>}
        <section className="operations-metrics">
          <article>
            <span>Total submitted</span>
            <strong>{metrics.total}</strong>
          </article>
          <article>
            <span>New</span>
            <strong>{metrics.new}</strong>
          </article>
          <article>
            <span>In delivery</span>
            <strong>{metrics.active}</strong>
          </article>
          <article>
            <span>Waiting</span>
            <strong>{metrics.waiting}</strong>
          </article>
        </section>
        <section className="operations-section-heading"><div><p>ALL SERVICES</p><h2>Customer help requests</h2></div><span>{serviceRequests.length}</span></section>
        {serviceRequests.length === 0 ? <section className="operations-empty compact"><h3>No general service requests</h3><p>Plan, billing, CRM, marketing, automation and support requests will appear here.</p></section> : <section className="operations-layout service-desk-layout">
          <aside className="operations-queue">{serviceRequests.map((item) => <button key={item.id} className={selectedServiceId === item.id ? "active" : ""} onClick={() => selectServiceRequest(item)}><small>{item.organization.name} · {item.category.replaceAll("_", " ")}</small><strong>{item.subject}</strong><span>{item.createdBy.email}</span><i>{item.status.replaceAll("_", " ")} · {item.priority}</i></button>)}</aside>
          {selectedService && <article className="operations-detail"><header><div><small>{selectedService.requestNumber} · {selectedService.category.replaceAll("_", " ")}</small><h2>{selectedService.subject}</h2><span>{selectedService.organization.name} · {selectedService.createdBy.email}</span></div><i>{selectedService.priority}</i></header><div className="operations-description"><small>CUSTOMER REQUEST</small><p>{selectedService.description}</p></div><div className="operations-form"><label><span>Status</span><select value={serviceForm.status} onChange={(event) => setServiceForm({ ...serviceForm, status: event.target.value as Status })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Assigned operator</span><select value={serviceForm.assignedToId} onChange={(event) => setServiceForm({ ...serviceForm, assignedToId: event.target.value })}><option value="">Unassigned</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.firstName} {operator.lastName ?? ""}</option>)}</select></label><label className="wide"><span>Customer-visible progress summary</span><textarea rows={2} value={serviceForm.customerUpdate} onChange={(event) => setServiceForm({ ...serviceForm, customerUpdate: event.target.value })} /></label><label className="wide private"><span>Private internal note</span><textarea rows={2} value={serviceForm.internalNote} onChange={(event) => setServiceForm({ ...serviceForm, internalNote: event.target.value })} /></label><button onClick={() => void saveServiceRequest()} disabled={saving || serviceForm.customerUpdate.trim().length < 2}>Save request status</button></div><div className="operations-conversation"><h3>Conversation</h3>{selectedService.messages.map((item) => <article key={item.id} className={!item.customerVisible ? "internal" : ""}><header><strong>{item.type.replaceAll("_", " ")}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></header><p>{item.body}</p></article>)}</div>{!["COMPLETED", "CANCELED"].includes(selectedService.status) && <div className="operations-reply"><div><button className={replyType === "PROVIDER_REPLY" ? "active" : ""} onClick={() => setReplyType("PROVIDER_REPLY")}>Reply to customer</button><button className={replyType === "INTERNAL_NOTE" ? "active" : ""} onClick={() => setReplyType("INTERNAL_NOTE")}>Internal note</button></div><textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={replyType === "INTERNAL_NOTE" ? "Only B² Brain can see this note…" : "Write a reply visible to the customer…"} /><button disabled={saving || !reply.trim()} onClick={() => void sendServiceReply()}>Save message</button></div>}</article>}
        </section>}
        <section className="operations-section-heading"><div><p>WEBSITE DELIVERY</p><h2>Website change requests</h2></div><span>{requests.length}</span></section>
        {requests.length === 0 ? (
          <section className="operations-empty">
            <span>◇</span>
            <h2>No customer requests submitted</h2>
            <p>
              Requests appear here only after an organization explicitly sends
              them to B² Brain.
            </p>
          </section>
        ) : (
          <section className="operations-layout">
            <aside className="operations-queue">
              {requests.map((item) => (
                <button
                  key={item.id}
                  className={selectedId === item.id ? "active" : ""}
                  onClick={() => selectRequest(item)}
                >
                  <small>
                    {item.organization.name} · {item.priority}
                  </small>
                  <strong>{item.title}</strong>
                  <span>{item.website.domain}</span>
                  <i>{item.providerStatus.replaceAll("_", " ")}</i>
                </button>
              ))}
            </aside>
            {selected && (
              <article className="operations-detail">
                <header>
                  <div>
                    <small>
                      {selected.requestNumber} · {selected.type}
                    </small>
                    <h2>{selected.title}</h2>
                    <span>{selected.organization.name}</span>
                  </div>
                  <i className={selected.risk.toLowerCase()}>
                    {selected.risk} RISK
                  </i>
                </header>
                <section className="operations-scope">
                  <div>
                    <small>Website</small>
                    <strong>{selected.website.name}</strong>
                    <a
                      href={`https://${selected.website.domain}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.website.domain} ↗
                    </a>
                  </div>
                  <div>
                    <small>Platform</small>
                    <strong>{selected.website.platform}</strong>
                  </div>
                  <div>
                    <small>Deadline</small>
                    <strong>
                      {selected.deadline
                        ? new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "medium",
                          }).format(new Date(selected.deadline))
                        : "Not specified"}
                    </strong>
                  </div>
                </section>
                <div className="operations-description">
                  <small>CUSTOMER REQUEST</small>
                  <p>{selected.description}</p>
                </div>
                <div className="operations-form">
                  <label>
                    <span>Delivery status</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as Status,
                        })
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Assigned B² Brain operator</span>
                    <select
                      value={form.assignedToId}
                      onChange={(event) =>
                        setForm({ ...form, assignedToId: event.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {operators.map((operator) => (
                        <option key={operator.id} value={operator.id}>
                          {operator.firstName} {operator.lastName ?? ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    <span>Update visible to customer</span>
                    <textarea
                      rows={3}
                      value={form.customerUpdate}
                      onChange={(event) =>
                        setForm({ ...form, customerUpdate: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="wide private">
                    <span>
                      Internal B² Brain note — never shared with customer
                    </span>
                    <textarea
                      rows={4}
                      value={form.internalNote}
                      onChange={(event) =>
                        setForm({ ...form, internalNote: event.target.value })
                      }
                    />
                  </label>
                  <button
                    onClick={() => void save()}
                    disabled={saving || form.customerUpdate.trim().length < 2}
                  >
                    {saving ? "Saving…" : "Save progress update"}
                  </button>
                </div>
              </article>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
