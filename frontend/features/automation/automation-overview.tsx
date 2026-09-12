"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import type { BridgeConnector, BridgeDraft, BridgeEvent, BridgePayload } from "./bridge-types";

type Agent = { id: string; name: string; status: string; supportedService: string };
type Run = { id: string; status: string; agent: { name: string }; createdAt: string };
type OverviewData = { connectors: BridgeConnector[]; events: BridgeEvent[]; drafts: BridgeDraft[]; agents: Agent[]; runs: Run[] };
const empty: OverviewData = { connectors: [], events: [], drafts: [], agents: [], runs: [] };

function connectionStatus(connector: BridgeConnector) {
  if (connector.status === "PAUSED") return "Paused";
  if (connector.status === "ERROR") return "Needs attention";
  if (connector.status === "ACTIVE" && ["B2BRAIN_SIMULATOR", "META_LEAD_ADS", "META_WHATSAPP_CLOUD"].includes(connector.provider)) return "Test ready";
  if (connector.status === "ACTIVE") return "Connected";
  if (connector.credentialsConfiguredAt) return "Setup in progress";
  return "Not connected";
}

function friendlyActivity(event: BridgeEvent) {
  if (event.status === "FAILED" || event.status === "QUARANTINED") return `${event.connector.name} needs attention`;
  if (event.status === "AWAITING_APPROVAL") return `${event.connector.name} is waiting for approval`;
  return `${event.connector.name} activity was ${event.status.toLowerCase().replaceAll("_", " ")}`;
}

export function AutomationOverview() {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState<OverviewData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      authorizedRequest<BridgePayload>("/automation-bridge"),
      authorizedRequest<{ success: true; data: BridgeDraft[] }>("/automation-bridge/message-drafts"),
      authorizedRequest<{ success: true; data: Agent[] }>("/agents"),
      authorizedRequest<{ success: true; data: { items: Run[] } }>("/agents/runs/centre"),
    ]);
    const [bridge, drafts, agents, runs] = results;
    setData({
      connectors: bridge.status === "fulfilled" ? bridge.value.data.connectors : [],
      events: bridge.status === "fulfilled" ? bridge.value.data.events : [],
      drafts: drafts.status === "fulfilled" ? drafts.value.data : [],
      agents: agents.status === "fulfilled" ? agents.value.data : [],
      runs: runs.status === "fulfilled" ? runs.value.data.items : [],
    });
    if (results.every((result) => result.status === "rejected")) setError("Automation information is unavailable right now.");
    else if (results.some((result) => result.status === "rejected")) setError("Some automation information is temporarily unavailable.");
    setLoading(false);
  }, [authorizedRequest]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <div className="automation-overview-state" role="status"><span className="spinner dark" />Loading automation summary…</div>;

  const activeAgents = data.agents.filter((agent) => agent.status === "ACTIVE");
  const pendingDrafts = data.drafts.filter((draft) => draft.status === "PENDING_APPROVAL");
  const pendingEvents = data.events.filter((event) => event.status === "AWAITING_APPROVAL");
  const attention = data.events.filter((event) => ["FAILED", "QUARANTINED"].includes(event.status));
  const setupIncomplete = data.connectors.some((connector) => connectionStatus(connector) === "Setup in progress");
  const recommendation = data.connectors.length === 0
    ? ["Connect a business channel", "connections"]
    : setupIncomplete
      ? ["Continue test setup", "connections"]
      : pendingDrafts.length + pendingEvents.length > 0
        ? ["Review pending approvals", "approvals"]
        : attention.length > 0
          ? ["Review items needing attention", "activity"]
          : ["Review recent automation activity", "activity"];
  const recent = [
    ...data.events.map((event) => ({ id: `event-${event.id}`, text: friendlyActivity(event), createdAt: event.createdAt })),
    ...data.runs.map((run) => ({ id: `run-${run.id}`, text: `${run.agent.name} run was ${run.status.toLowerCase().replaceAll("_", " ")}`, createdAt: run.createdAt })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return <div className="automation-overview">
    {error && <div className="dashboard-notice error" role="alert">{error}</div>}
    <section className="automation-summary" aria-label="Automation summary">
      <article><span>Connections configured</span><strong>{data.connectors.length}</strong><Link href="/automation?section=connections">View all connections</Link></article>
      <article><span>Active agents</span><strong>{activeAgents.length}</strong><Link href="/automation?section=automations">Manage automations</Link></article>
      <article><span>Approvals waiting</span><strong>{pendingDrafts.length + pendingEvents.length}</strong><Link href="/automation?section=approvals">Review approvals</Link></article>
      <article><span>Needs attention</span><strong>{attention.length}</strong><Link href="/automation?section=activity">View activity</Link></article>
    </section>
    <section className="automation-recommendation">
      <div><span>Recommended next step</span><h3>{recommendation[0]}</h3><p>Based on the current verified Automation state.</p></div>
      <Link href={`/automation?section=${recommendation[1]}`}>Open section</Link>
    </section>
    <div className="automation-overview-grid">
      <section><header><h3>Connections</h3><Link href="/automation?section=connections">View all</Link></header>{data.connectors.length ? data.connectors.slice(0, 3).map((item) => <article key={item.id}><strong>{item.name}</strong><span>{connectionStatus(item)}</span></article>) : <p>No connections configured.</p>}</section>
      <section><header><h3>Running automations</h3><Link href="/automation?section=automations">Manage</Link></header>{activeAgents.length ? activeAgents.slice(0, 3).map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.supportedService}</span></article>) : <p>No automations are running.</p>}</section>
      <section><header><h3>Waiting for approval</h3><Link href="/automation?section=approvals">Review</Link></header>{pendingDrafts.length + pendingEvents.length ? <><p>{pendingDrafts.length} message drafts</p><p>{pendingEvents.length} integration items</p></> : <p>Nothing is waiting for approval.</p>}</section>
      <section><header><h3>Recent activity</h3><Link href="/automation?section=activity">View all</Link></header>{recent.length ? recent.map((item) => <article key={item.id}><strong>{item.text}</strong></article>) : <p>No recent automation activity.</p>}</section>
    </div>
  </div>;
}
