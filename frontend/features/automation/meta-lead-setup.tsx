"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useRouter, useSearchParams } from "next/navigation";

type Page = { id: string; name: string; permissions: string[] };
type Form = { id: string; name: string };
type Status = { connectorStatus: string; mode: "TEST" | "PRODUCTION"; setupState: string; page: { name: string; maskedId: string } | null; forms: Form[]; permissionsValid: boolean; subscriptionVerified: boolean; lastVerifiedAt: string | null; lastTestAt: string | null; lastSuccessfulLeadAt: string | null; canActivateProduction: boolean };

export function MetaLeadSetup({ connectorId }: { connectorId: string }) {
  const { authorizedRequest } = useAuth(), router = useRouter(), searchParams = useSearchParams(), callbackStarted = useRef(false), [status, setStatus] = useState<Status | null>(null), [pages, setPages] = useState<Page[]>([]), [forms, setForms] = useState<Form[]>([]), [selectedPage, setSelectedPage] = useState(""), [selectedForms, setSelectedForms] = useState<string[]>([]), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await authorizedRequest<{ success: true; data: Status }>(`/automation-bridge/connectors/${connectorId}/meta/status`); setStatus(response.data); }, [authorizedRequest, connectorId]);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(() => setNotice("Unable to load Meta setup status.")), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const state = searchParams.get("meta_state"), code = searchParams.get("meta_code"); if (!state || !code || callbackStarted.current) return; callbackStarted.current = true; const timer = window.setTimeout(() => { setBusy(true); void authorizedRequest<{ success: true; data: { pages: Page[] } }>(`/automation-bridge/connectors/${connectorId}/meta/callback`, { method: "POST", body: JSON.stringify({ state, code }) }).then(completed => { setPages(completed.data.pages); router.replace("/automation"); setNotice("Test authorization completed. Choose a synthetic Page."); }).catch(error => setNotice(error instanceof ApiError ? error.message : "Meta authorization failed.")).finally(() => setBusy(false)); }, 0); return () => window.clearTimeout(timer); }, [authorizedRequest, connectorId, router, searchParams]);
  async function run(action: () => Promise<void>) { setBusy(true); setNotice(""); try { await action(); await load(); } catch (error) { setNotice(error instanceof ApiError ? error.message : "Meta setup action failed."); } finally { setBusy(false); } }
  async function connect() { await run(async () => { const start = await authorizedRequest<{ success: true; data: { authorizationUrl: string } }>(`/automation-bridge/connectors/${connectorId}/meta/authorize`, { method: "POST", body: JSON.stringify({ returnPath: "/automation" }) }); router.push(start.data.authorizationUrl); }); }
  async function choosePage() { await run(async () => { const response = await authorizedRequest<{ success: true; data: { forms: Form[] } }>(`/automation-bridge/connectors/${connectorId}/meta/page`, { method: "PUT", body: JSON.stringify({ pageId: selectedPage }) }); setForms(response.data.forms); setNotice("Page verified. Choose at least one lead form."); }); }
  async function chooseForms() { await run(async () => { await authorizedRequest(`/automation-bridge/connectors/${connectorId}/meta/forms`, { method: "PUT", body: JSON.stringify({ formIds: selectedForms }) }); setNotice("Lead-form allowlist saved."); }); }
  async function post(action: string, message: string) { await run(async () => { await authorizedRequest(`/automation-bridge/connectors/${connectorId}/meta/${action}`, { method: "POST" }); setNotice(message); }); }
  return <section className="meta-lead-setup" aria-labelledby="meta-setup-title">
    <header><div><p>Meta Lead Ads</p><h3 id="meta-setup-title">Guided connection</h3><span>Authorize, select and verify with synthetic data before production access.</span></div><strong>{status?.mode === "TEST" ? "TEST MODE" : "PRODUCTION"}</strong></header>
    <ol aria-label="Meta Lead Ads setup steps"><li>Requirements</li><li>Connect Meta</li><li>Choose Page</li><li>Choose forms</li><li>Verify</li><li>Test lead</li><li>Review</li><li>Activate</li></ol>
    {notice && <p role="status" className="meta-setup-notice">{notice}</p>}
    <div className="meta-setup-status"><span>State <b>{status?.setupState ?? "Loading"}</b></span><span>Connector <b>{status?.connectorStatus ?? "—"}</b></span><span>Page <b>{status?.page ? `${status.page.name} (${status.page.maskedId})` : "Not selected"}</b></span><span>Permissions <b>{status?.permissionsValid ? "Verified" : "Pending"}</b></span><span>Subscription <b>{status?.subscriptionVerified ? "Verified" : "Pending"}</b></span><span>Last verification <b>{status?.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : "Not run"}</b></span></div>
    <div className="meta-setup-actions">
      <button disabled={busy} onClick={() => void connect()}>Connect Meta</button>
      {pages.length > 0 && <label>Authorized Page<select value={selectedPage} onChange={event => setSelectedPage(event.target.value)}><option value="">Choose Page</option>{pages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select><button disabled={busy || !selectedPage} onClick={() => void choosePage()}>Use Page</button></label>}
      {forms.length > 0 && <fieldset><legend>Permitted lead forms</legend>{forms.map(form => <label key={form.id}><input type="checkbox" checked={selectedForms.includes(form.id)} onChange={event => setSelectedForms(current => event.target.checked ? [...current, form.id] : current.filter(id => id !== form.id))}/>{form.name}</label>)}<button disabled={busy || selectedForms.length === 0} onClick={() => void chooseForms()}>Save forms</button></fieldset>}
      <button disabled={busy || !status?.forms.length} onClick={() => void post("verify", "Synthetic subscription verified.")}>Verify subscription</button>
      <button disabled={busy || !status?.subscriptionVerified} onClick={() => void post("test", "Synthetic lead passed without creating CRM data.")}>Run synthetic test</button>
      <button disabled title="Production activation is unavailable in Test Mode">Activate</button>
      <button disabled={busy} onClick={() => void post("reconnect", "Reconnect authorization started.")}>Reconnect</button>
      <button disabled={busy} onClick={() => { if (window.confirm("Disconnect Meta Lead Ads? Historical CRM records will be preserved.")) void post("disconnect", "Meta Lead Ads disconnected. Historical records were preserved."); }}>Disconnect</button>
    </div>
    <small>Test Mode never contacts Meta, sends messages, changes ads, or activates a production connector. An empty form allowlist accepts no forms.</small>
  </section>;
}
