"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Capability = "INSTAGRAM_MESSAGES" | "META_LEAD_ADS" | "META_ADVERTISING";
type Item = { capability: Capability; state: string; canManage: boolean; connectorId: string | null };
type Overview = { success: true; data: { providerAvailable: false; approvalReady: false; items: Item[] } };
const capabilities: { key: Capability; title: string; purpose: string }[] = [
  { key: "INSTAGRAM_MESSAGES", title: "Instagram Messages", purpose: "Prepare a private professional-account connection for future customer DMs." },
  { key: "META_LEAD_ADS", title: "Meta Lead Ads", purpose: "Prepare Page and lead-form access separately from Instagram messaging." },
  { key: "META_ADVERTISING", title: "Meta Advertising", purpose: "Prepare a separate Ad Account connection for future campaign management." },
];
const labels: Record<string, string> = { SERVICE_UNAVAILABLE: "Service unavailable", NOT_CONFIGURED: "Not configured", TEST_MODE: "Test Mode — not live", INTERNAL_FOUNDATION_READY: "Internal foundation ready", EXPIRED: "Expired — reconnect later", DISCONNECTED: "Disconnected" };

export function MetaFoundationPanel() {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Capability | null>(null);
  const [helped, setHelped] = useState<Capability[]>([]);
  const [step, setStep] = useState<Record<Capability, "START" | "AUTHORIZATION" | "ASSET_SELECTION" | "VERIFICATION" | "OTHER">>({ INSTAGRAM_MESSAGES: "START", META_LEAD_ADS: "START", META_ADVERTISING: "START" });
  const load = useCallback(async () => {
    try { const response = await authorizedRequest<Overview>("/automation-bridge/meta-foundation"); setItems(response.data.items); setError(""); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Connection status is unavailable."); }
    finally { setLoading(false); }
  }, [authorizedRequest]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

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
    <div className="connection-detail-notice">Setup unavailable pending Meta approval. No live Meta login, message intake, or ad publishing is enabled here. SATHOS responds to help requests within 24 hours; connection completion may take longer.</div>
    {loading && <p role="status">Checking connection status…</p>}
    {error && <p role="alert">{error}</p>}
    <div className="connection-cards">
      {capabilities.map(capability => { const item = items.find(value => value.capability === capability.key); return <article key={capability.key}>
        <header><div><span>{capability.title}</span><i>{item ? labels[item.state] ?? "Provider unavailable" : "Provider unavailable"}</i></div><p>{capability.purpose}</p></header>
        <div className="connection-card-note">Connect with Meta is unavailable until the official authorization route and approvals are ready.</div>
        {item?.canManage && <><label>Setup step <select aria-label={`${capability.title} setup step`} value={step[capability.key]} onChange={event => setStep(current => ({ ...current, [capability.key]: event.target.value as typeof step[Capability] }))}><option value="START">Start</option><option value="AUTHORIZATION">Authorization</option><option value="ASSET_SELECTION">Asset selection</option><option value="VERIFICATION">Verification</option><option value="OTHER">Other</option></select></label><button type="button" disabled={Boolean(pending) || helped.includes(capability.key)} onClick={() => void requestHelp(capability.key)}>{helped.includes(capability.key) ? "Help requested" : pending === capability.key ? "Requesting…" : "Request SATHOS Help"}</button></>}
      </article>; })}
    </div>
  </section>;
}
