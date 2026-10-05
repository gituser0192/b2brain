"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Capability = "INSTAGRAM_MESSAGES" | "META_LEAD_ADS" | "META_ADVERTISING";
type Item = { capability: Capability; state: string; canManage: boolean; connectorId: string | null };
type Overview = { success: true; data: { providerAvailable: boolean; inboundAvailable: boolean; approvalReady: false; items: Item[] } };
const capabilities: { key: Capability; title: string; purpose: string }[] = [
  { key: "INSTAGRAM_MESSAGES", title: "Instagram Messages", purpose: "Prepare a private professional-account connection for future customer DMs." },
  { key: "META_LEAD_ADS", title: "Meta Lead Ads", purpose: "Prepare Page and lead-form access separately from Instagram messaging." },
  { key: "META_ADVERTISING", title: "Meta Advertising", purpose: "Prepare a separate Ad Account connection for future campaign management." },
];
const labels: Record<string, string> = { SERVICE_UNAVAILABLE: "Service unavailable", NOT_CONFIGURED: "Not configured", TEST_MODE: "Test Mode — not live", INTERNAL_FOUNDATION_READY: "Setup in progress", SETUP_IN_PROGRESS: "Setup in progress", RESET_REQUIRED: "Local reset required", PRIVATE_TEST_READY: "Private test ready", CONNECTED: "Connected", NEEDS_ATTENTION: "Needs attention", RECONNECT_REQUIRED: "Reconnect required", DISCONNECTED: "Disconnected" };

export function MetaFoundationPanel() {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerAvailable, setProviderAvailable] = useState(false);
  const [inboundAvailable, setInboundAvailable] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Capability | null>(null);
  const [helped, setHelped] = useState<Capability[]>([]);
  const statusRequest = useRef(0);
  const [step, setStep] = useState<Record<Capability, "START" | "AUTHORIZATION" | "ASSET_SELECTION" | "VERIFICATION" | "OTHER">>({ INSTAGRAM_MESSAGES: "START", META_LEAD_ADS: "START", META_ADVERTISING: "START" });
  const load = useCallback(async () => {
    const request = ++statusRequest.current;
    try { const response = await authorizedRequest<Overview>("/automation-bridge/meta-foundation"); if (request === statusRequest.current) { setItems(response.data.items); setProviderAvailable(response.data.providerAvailable); setInboundAvailable(response.data.inboundAvailable); setError(""); } }
    catch (reason) { if (request === statusRequest.current) setError(reason instanceof ApiError ? reason.message : "Connection status is unavailable."); }
    finally { if (request === statusRequest.current) setLoading(false); }
  }, [authorizedRequest]);
  useEffect(() => { const counter = statusRequest; const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); counter.current++; }; }, [load]);

  async function connectInstagram(connectorId: string | null) {
    if (pending) return;
    setPending("INSTAGRAM_MESSAGES");
    try {
      const id = connectorId ?? (await authorizedRequest<{ data: { connectorId: string } }>("/automation-bridge/meta-foundation/INSTAGRAM_MESSAGES/draft", { method: "POST" })).data.connectorId;
      const result = await authorizedRequest<{ data: { authorizationUrl: string } }>(`/automation-bridge/meta-foundation/instagram/${encodeURIComponent(id)}/start`, { method: "POST" });
      window.location.assign(result.data.authorizationUrl);
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Instagram setup could not start."); setPending(null); }
  }

  async function disconnectInstagram(connectorId: string) {
    if (pending || !window.confirm("Disconnect Instagram from SATHOS locally? This does not revoke Meta authorization or unsubscribe webhooks.")) return;
    setPending("INSTAGRAM_MESSAGES");
    try { await authorizedRequest(`/automation-bridge/meta-foundation/INSTAGRAM_MESSAGES/${encodeURIComponent(connectorId)}/disconnect`, { method: "POST" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Could not disconnect Instagram locally."); }
    finally { setPending(null); }
  }

  async function requestHelp(capability: Capability) {
    if (pending || helped.includes(capability)) return;
    setPending(capability);
    try {
      await authorizedRequest("/automation-bridge/meta-foundation/help", { method: "POST", body: JSON.stringify({ capability, step: step[capability], category: "SETUP", errorCategory: "UNAVAILABLE" }) });
      setHelped(current => [...current, capability]); setError("");
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to request help."); }
    finally { setPending(null); }
  }

  return <section className="connection-detail" aria-label="Meta connection foundation">
    <header><p>Meta connections</p><h3>Each capability is authorized separately</h3><span>When available, login will happen directly on Meta. SATHOS never asks for Meta passwords, OTPs, app secrets, or pasted access tokens.</span></header>
    <div className="connection-detail-notice">Instagram private testing can be enabled by the SATHOS operator. {inboundAvailable ? "Signed inbound DM processing is enabled for the private test." : "Inbound DM processing is blocked until webhook signature verification is proven and enabled."} External customer access still requires Meta approval. Outbound Instagram replies and ad publishing remain disabled. Local disconnect does not revoke Meta access or unsubscribe the account.</div>
    {loading && <p role="status">Checking connection status…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry status</button></p>}
    <div className="connection-cards">
      {capabilities.map(capability => { const item = items.find(value => value.capability === capability.key); return <article key={capability.key}>
        <header><div><span>{capability.title}</span><i>{item ? labels[item.state] ?? "Provider unavailable" : "Provider unavailable"}</i></div><p>{capability.purpose}</p></header>
        <div className="connection-card-note">{capability.key === "INSTAGRAM_MESSAGES" ? "Only a professional Instagram account with app/test access can connect during private testing." : "Live provider authorization is not available for this capability."}</div>
        {capability.key === "INSTAGRAM_MESSAGES" && item?.canManage && providerAvailable && !["PRIVATE_TEST_READY", "CONNECTED", "RESET_REQUIRED"].includes(item.state) && <button type="button" disabled={Boolean(pending)} onClick={() => void connectInstagram(item.connectorId)}>{pending === capability.key ? "Starting…" : "Connect Instagram"}</button>}
        {capability.key === "INSTAGRAM_MESSAGES" && item?.canManage && item.connectorId && ["SETUP_IN_PROGRESS", "RESET_REQUIRED", "INTERNAL_FOUNDATION_READY", "PRIVATE_TEST_READY", "CONNECTED", "NEEDS_ATTENTION", "RECONNECT_REQUIRED"].includes(item.state) && <button type="button" disabled={Boolean(pending)} onClick={() => void disconnectInstagram(item.connectorId!)}>Disconnect locally</button>}
        {item?.canManage && <><label>Setup step <select aria-label={`${capability.title} setup step`} value={step[capability.key]} onChange={event => setStep(current => ({ ...current, [capability.key]: event.target.value as typeof step[Capability] }))}><option value="START">Start</option><option value="AUTHORIZATION">Authorization</option><option value="ASSET_SELECTION">Asset selection</option><option value="VERIFICATION">Verification</option><option value="OTHER">Other</option></select></label><button type="button" disabled={Boolean(pending) || helped.includes(capability.key)} onClick={() => void requestHelp(capability.key)}>{helped.includes(capability.key) ? "Help requested" : pending === capability.key ? "Requesting…" : "Request SATHOS Help"}</button></>}
      </article>; })}
    </div>
  </section>;
}
