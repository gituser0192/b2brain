"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Policy = { mode: "MANUAL" | "SEND_AFTER_APPROVAL"; dailyContactLimit: number; quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string; timezone: string; maxAttempts: number; emergencyPaused: boolean };
type Connector = { id: string; name: string; provider: string; status: string; policy: Policy; lastSuccessfulAt: string | null; lastErrorMessage: string | null };
type Delivery = { id: string; connectorId: string; sourceId: string | null; recipient: string; subject: string | null; status: string; externalMessageId: string | null; failureMessage: string | null; attemptCount: number; nextRetryAt: string | null; providerStatus: string | null; sentAt: string | null; createdAt: string };
type Ready = { id: string; title: string; description: string | null; context: { deliveryState?: string } | null; invoice: { invoiceNumber: string; currency: string; total: string; customer: { displayName: string; email: string | null } } | null; delivery: Delivery | null };
type Workspace = { smtpConfigured: boolean; connectors: Connector[]; ready: Ready[]; deliveries: Delivery[] };

export function EmailDeliveryManager() {
  const { authorizedRequest, session } = useAuth();
  const [data, setData] = useState<Workspace>({ smtpConfigured: false, connectors: [], ready: [], deliveries: [] });
  const [connectorId, setConnectorId] = useState("");
  const [sending, setSending] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<Policy>({ mode: "MANUAL", dailyContactLimit: 50, quietHoursEnabled: true, quietHoursStart: "20:00", quietHoursEnd: "08:00", timezone: "Asia/Kolkata", maxAttempts: 3, emergencyPaused: false });
  const load = useCallback(async () => {
    const response = await authorizedRequest<{ success: true; data: Workspace }>("/automation-bridge/email-deliveries");
    setData(response.data);
    setConnectorId((current) => current || response.data.connectors.find((item) => item.status === "ACTIVE")?.id || "");
  }, [authorizedRequest]);
  useEffect(() => { const connector = data.connectors.find((item) => item.id === connectorId); if (connector) setPolicy(connector.policy); }, [connectorId, data.connectors]);
  useEffect(() => { const timer = setTimeout(() => void load().catch(() => setError("Unable to load email delivery.")), 0); return () => clearTimeout(timer); }, [load]);
  async function send(approvalId: string) {
    setSending(approvalId); setError(""); setNotice("");
    try {
      await authorizedRequest("/automation-bridge/email-deliveries/send", { method: "POST", body: JSON.stringify({ connectorId, approvalId }) });
      setNotice("Approved collection reminder sent and recorded.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to send the reminder."); }
    finally { setSending(""); }
  }
  async function savePolicy() { setError(""); setNotice(""); try { await authorizedRequest(`/automation-bridge/connectors/${connectorId}/email-policy`, { method: "PUT", body: JSON.stringify(policy) }); setNotice("Email delivery policy saved."); await load(); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save email policy."); } }
  const activeConnectors = data.connectors.filter((item) => item.status === "ACTIVE");
  const canManage = session?.membership.permissions.includes("AUTOMATION_MANAGE") ?? false;
  return <section className="email-delivery-manager">
    <header><div><p>Controlled delivery</p><h3>Email delivery connector</h3><span>Send only approved collection reminders, with tenant isolation, duplicate protection, and a complete audit trail.</span></div><b>{data.deliveries.filter((item) => item.status === "SENT").length} sent</b></header>
    {!data.smtpConfigured && <div className="form-alert">SMTP is not configured on the backend. Delivery remains blocked.</div>}
    {data.smtpConfigured && activeConnectors.length === 0 && <div className="form-alert">Create and activate an EMAIL connector in the Automation Bridge.</div>}
    {notice && <div className="dashboard-notice success">{notice}</div>}{error && <div className="form-alert">{error}</div>}
    <div className="email-delivery-toolbar"><label><span>Active connector</span><select value={connectorId} onChange={(event) => setConnectorId(event.target.value)}><option value="">Select connector</option>{activeConnectors.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.provider}</option>)}</select></label><small>Approval authorizes the message. Clicking Send performs the external action.</small></div>
    {connectorId && canManage && <div className="email-policy"><label><span>After approval</span><select value={policy.mode} onChange={(event) => setPolicy({ ...policy, mode: event.target.value as Policy["mode"] })}><option value="MANUAL">Wait for Send click</option><option value="SEND_AFTER_APPROVAL">Send immediately after approval</option></select></label><label><span>Daily contact limit</span><input type="number" min={1} max={1000} value={policy.dailyContactLimit} onChange={(event) => setPolicy({ ...policy, dailyContactLimit: Number(event.target.value) })} /></label><label><span>Quiet from</span><input type="time" value={policy.quietHoursStart} onChange={(event) => setPolicy({ ...policy, quietHoursStart: event.target.value })} /></label><label><span>Quiet until</span><input type="time" value={policy.quietHoursEnd} onChange={(event) => setPolicy({ ...policy, quietHoursEnd: event.target.value })} /></label><label><span>Timezone</span><input value={policy.timezone} onChange={(event) => setPolicy({ ...policy, timezone: event.target.value })} /></label><label><span>Maximum attempts</span><input type="number" min={1} max={5} value={policy.maxAttempts} onChange={(event) => setPolicy({ ...policy, maxAttempts: Number(event.target.value) })} /></label><label className="approval-toggle"><input type="checkbox" checked={policy.quietHoursEnabled} onChange={(event) => setPolicy({ ...policy, quietHoursEnabled: event.target.checked })} /><span><strong>Quiet hours enabled</strong></span></label><label className="approval-toggle emergency"><input type="checkbox" checked={policy.emergencyPaused} onChange={(event) => setPolicy({ ...policy, emergencyPaused: event.target.checked })} /><span><strong>Emergency pause</strong><small>Block every outgoing collection email.</small></span></label><button onClick={() => void savePolicy()}>Save delivery policy</button></div>}
    <div className="email-delivery-list">{data.ready.length === 0 ? <div className="agent-run-empty"><strong>No approved reminders ready</strong><span>Run the Finance Collection Agent and approve its reminder first.</span></div> : data.ready.map((item) => {
      const sent = item.delivery?.status === "SENT";
      return <article key={item.id}><header><div><strong>{item.invoice?.invoiceNumber ?? item.title}</strong><span>{item.invoice?.customer.displayName ?? "Customer unavailable"} · {item.invoice?.customer.email ?? "Email required"}</span></div><i className={`agent-run-status ${(item.delivery?.status ?? item.context?.deliveryState ?? "ready_for_provider").toLowerCase()}`}>{item.delivery?.status?.replaceAll("_", " ") ?? item.context?.deliveryState?.replaceAll("_", " ") ?? "READY"}</i></header><p>{item.description}</p><footer><small>{item.delivery?.failureMessage ?? (sent ? `Provider: ${item.delivery?.providerStatus ?? "ACCEPTED"} · Reference: ${item.delivery?.externalMessageId ?? "not supplied"}` : item.delivery ? `Attempt ${item.delivery.attemptCount}${item.delivery.nextRetryAt ? ` · retry ${new Date(item.delivery.nextRetryAt).toLocaleString()}` : ""}` : "No payment state will be changed.")}</small>{canManage && <button disabled={!connectorId || !data.smtpConfigured || !item.invoice?.customer.email || sent || sending === item.id || policy.emergencyPaused} onClick={() => void send(item.id)}>{sent ? "Sent" : sending === item.id ? "Sending…" : item.delivery?.status === "FAILED" ? "Retry email" : "Send approved email"}</button>}</footer></article>;
    })}</div>
  </section>;
}
