"use client";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";
import { BridgeOverview } from "./bridge-overview";
import { BridgeDialogs, type BridgeDialogKind } from "./bridge-dialogs";
import type { BridgeConnector, BridgeDraft, BridgeEvent, BridgePayload } from "./bridge-types";
import { MetaLeadSetup } from "./meta-lead-setup";
import { WhatsappBusinessSetup } from "./whatsapp-business-setup";
import { EmailDeliveryManager } from "./email-delivery-manager";
const connectorBlank = {
    name: "",
    type: "WHATSAPP",
    provider: "Official provider",
    externalAccountRef: "",
    status: "DRAFT",
    mode: "MANUAL_APPROVAL",
  },
  eventBlank = {
    externalEventId: "",
    eventName: "message.received",
    kind: "INQUIRY",
    contactName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    raw: {},
  };
type ConnectionChannel = "whatsapp" | "meta" | "website" | "email";

export function BridgeManager({ view, channel = null }: { view: "connections" | "approvals" | "activity"; channel?: ConnectionChannel | null }) {
  const { authorizedRequest, session } = useAuth(),
    queryClient = useQueryClient(),
    [connectors, setConnectors] = useState<BridgeConnector[]>([]),
    [events, setEvents] = useState<BridgeEvent[]>([]),
    [drafts, setDrafts] = useState<BridgeDraft[]>([]),
    [connector, setConnector] = useState(connectorBlank),
    [event, setEvent] = useState(eventBlank),
    [selected, setSelected] = useState(""),
    [open, setOpen] = useState<BridgeDialogKind | null>(null),
    [showAllConnectors, setShowAllConnectors] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [secret, setSecret] = useState(""),
    [credentials, setCredentials] = useState({
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      appSecret: "",
    }),
    [websiteForm, setWebsiteForm] = useState({
      title: "How can we help?",
      description: "Share your requirement and our team will contact you.",
      submitLabel: "Send inquiry",
      successMessage: "Thank you. Your inquiry has been received.",
      accentColor: "#087ce3",
      askService: true,
      serviceLabel: "Service required",
    }),
    [simulatorMessage, setSimulatorMessage] = useState({ externalMessageId: "", from: "", contactName: "", message: "" }),
    [simulatorResult, setSimulatorResult] = useState("");
  const canManage = session?.membership.permissions.includes("AUTOMATION_MANAGE") ?? false;
  const permissions = session?.membership.permissions ?? [];
  const canViewApprovals = permissions.includes("APPROVAL_VIEW");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bridgeResult, draftResult] = await Promise.allSettled([
        authorizedRequest<BridgePayload>("/automation-bridge"),
        view === "approvals" && canViewApprovals
          ? authorizedRequest<{ success: true; data: BridgeDraft[] }>("/automation-bridge/message-drafts")
          : Promise.resolve({ success: true as const, data: [] as BridgeDraft[] }),
      ]);
      const bridge = bridgeResult.status === "fulfilled" ? bridgeResult.value.data : null;
      const nextDrafts = draftResult.status === "fulfilled" ? draftResult.value.data : [];
      setConnectors(bridge?.connectors ?? []);
      setEvents(bridge?.events ?? []);
      setDrafts(nextDrafts);
      setSelected((x) => x || bridge?.connectors[0]?.id || "");
      const bridgeUnavailable = bridgeResult.status === "rejected";
      const draftsUnavailable = view === "approvals" && draftResult.status === "rejected";
      setError(
        bridgeUnavailable && (view !== "approvals" || draftsUnavailable)
          ? "Unable to load Automation Bridge."
          : bridgeUnavailable || draftsUnavailable
            ? "Some Automation information is temporarily unavailable."
            : "",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, canViewApprovals, view]);
  useEffect(() => {
    const t = setTimeout(
      () =>
        void load().catch(() => setError("Unable to load Automation Bridge.")),
      0,
    );
    return () => clearTimeout(t);
  }, [load]);
  async function createConnector() {
    try {
      const r = await authorizedRequest<{
        success: true;
        data: { webhookSecret: string };
      }>("/automation-bridge/connectors", {
        method: "POST",
        body: JSON.stringify({
          ...connector,
          externalAccountRef: connector.externalAccountRef || null,
        }),
      });
      setSecret(r.data.webhookSecret);
      setOpen(null);
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to create connector.",
      );
    }
  }
  async function submitEvent() {
    try {
      await authorizedRequest(
        `/automation-bridge/connectors/${selected}/test-events`,
        {
          method: "POST",
          body: JSON.stringify({
            ...event,
            email: event.email || null,
            phone: event.phone || null,
            raw: {},
          }),
        },
      );
      setEvent({ ...eventBlank, externalEventId: crypto.randomUUID() });
      setOpen(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to receive event.");
    }
  }
  async function saveCredentials() {
    try {
      await authorizedRequest(
        `/automation-bridge/connectors/${selected}/whatsapp-credentials`,
        { method: "PUT", body: JSON.stringify(credentials) },
      );
      setCredentials({
        phoneNumberId: "",
        businessAccountId: "",
        accessToken: "",
        appSecret: "",
      });
      setOpen(null);
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to save WhatsApp credentials.",
      );
    }
  }
  async function saveWebsiteForm() {
    try {
      await authorizedRequest(`/automation-bridge/connectors/${selected}/website-form`, {
        method: "PUT",
        body: JSON.stringify(websiteForm),
      });
      setOpen(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to configure website form.");
    }
  }
  async function simulateWhatsapp() {
    try {
      setError("");
      const response = await authorizedRequest<{ success: true; data: { duplicate: boolean; classification?: string; customerCreated?: boolean; customerName?: string; humanTakeover?: boolean } }>("/automation-bridge/whatsapp-simulator/messages", {
        method: "POST",
        body: JSON.stringify({ ...simulatorMessage, connectorId: selected }),
      });
      setSimulatorResult(response.data.duplicate ? "Duplicate safely ignored." : `${response.data.classification?.replaceAll("_", " ")} processed. ${response.data.customerCreated ? `CRM lead ${response.data.customerName ?? "created"} was created.` : `Matched existing CRM customer: ${response.data.customerName ?? "customer"}.`}`);
      setSimulatorMessage({ externalMessageId: crypto.randomUUID(), from: simulatorMessage.from, contactName: simulatorMessage.contactName, message: "" });
      if (session) await queryClient.invalidateQueries({ queryKey: queryKeys.crm(session.organization.id) });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to simulate WhatsApp intake.");
    }
  }
  async function createReply(item: BridgeEvent) {
    const connector = connectors.find((c) => c.name === item.connector.name),
      body = prompt("Reply text");
    if (!connector || !item.payload.phone || !body) return;
    try {
      await authorizedRequest(
        `/automation-bridge/connectors/${connector.id}/message-drafts`,
        {
          method: "POST",
          body: JSON.stringify({
            eventId: item.id,
            recipient: item.payload.phone,
            body,
          }),
        },
      );
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to create reply draft.",
      );
    }
  }
  async function sendDraft(id: string) {
    if (!confirm("Approve and send this WhatsApp message now?")) return;
    try {
      await authorizedRequest(
        `/automation-bridge/message-drafts/${id}/approve-send`,
        { method: "POST" },
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "WhatsApp send failed.");
    }
  }
  async function decide(
    id: string,
    decision: "APPROVE" | "IGNORE" | "QUARANTINE",
  ) {
    const reason =
      decision === "APPROVE"
        ? "Approved by authorized administrator"
        : prompt("Reason")?.trim();
    if (!reason) return;
    try {
      await authorizedRequest(`/automation-bridge/events/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Decision failed.");
    }
  }
  return (
    <section className={`bridge-manager bridge-manager-${view}`}>
      <header>
        <div>
          <p>{view === "connections" ? "Business channels" : view === "approvals" ? "Review queue" : "Automation history"}</p>
          <h3>{view === "connections" ? "Connections" : view === "approvals" ? "Approvals" : "Activity"}</h3>
          <span>
            {view === "connections" ? "Configure test and business channels available to this workspace." : view === "approvals" ? "Review work that requires a person before it can continue." : "Inspect completed, failed, and quarantined integration activity."}
          </span>
        </div>
        {view === "connections" && channel && <Link className="connection-back" href="/automation?section=connections">← All connections</Link>}
      </header>
      {error && !open && <div className="form-alert" role="alert">{error}</div>}
      {view === "approvals" && !canViewApprovals && <div className="dashboard-notice" role="status">Approval viewing permission is required.</div>}
      {view === "approvals" && canViewApprovals && <Link className="conversation-entry" href="/automation?section=approvals&view=conversations"><strong>Customer conversations</strong><span>Review WhatsApp Test Mode and Simulator conversations →</span></Link>}
      {secret && (
        <div className="bridge-secret">
          <strong>Webhook secret — copy now</strong>
          <code>{secret}</code>
          <button onClick={() => setSecret("")}>I stored it securely</button>
        </div>
      )}
      {loading && view === "connections" && <p className="connection-loading" role="status">Loading connection status…</p>}
      {!loading && !(error && view === "connections") && !(view === "approvals" && !canViewApprovals) && <BridgeOverview
        view={view}
        canManage={canManage}
        canViewFinance={permissions.includes("FINANCE_VIEW")}
        canViewInquiry={permissions.includes("INQUIRY_VIEW")}
        canViewTechnical={canManage || permissions.includes("AUDIT_VIEW")}
        connectors={connectors}
        events={view === "approvals" ? events.filter((item) => item.status === "AWAITING_APPROVAL") : events}
        drafts={view === "approvals" ? drafts.filter((item) => item.status === "PENDING_APPROVAL") : drafts}
        channel={channel}
        onWebsiteForm={(id) => {
          setSelected(id);
          setOpen("website-form");
        }}
        onDecision={(id, decision) => void decide(id, decision)}
        onReply={(item) => void createReply(item)}
        onSendDraft={(id) => void sendDraft(id)}
      />}
      {view === "connections" && channel === "meta" && connectors.filter(item => item.type === "SOCIAL" && item.provider === "META_LEAD_ADS").map(item => <MetaLeadSetup key={item.id} connectorId={item.id} canManage={canManage} />)}
      {view === "connections" && channel === "whatsapp" && connectors.filter(item => item.type === "WHATSAPP" && item.provider === "META_WHATSAPP_CLOUD").map(item => <WhatsappBusinessSetup key={item.id} connectorId={item.id} canManage={canManage} />)}
      {view === "connections" && channel === "email" && <EmailDeliveryManager />}
      {view === "connections" && !channel && canManage && <details className="connection-advanced-management">
        <summary>Advanced connector management</summary>
        <p>Technical tools for administrators. Opening this panel does not create or change a connector.</p>
        <div>
          <button onClick={() => setOpen("connector")}>New connector</button>
          <button disabled={!connectors.some((c) => c.type === "WHATSAPP")} onClick={() => { const first = connectors.find((c) => c.type === "WHATSAPP"); if (first) setSelected(first.id); setOpen("credentials"); }}>Configure WhatsApp</button>
          <button disabled={!connectors.some((c) => c.status === "ACTIVE")} onClick={() => { setEvent({ ...eventBlank, externalEventId: crypto.randomUUID() }); setOpen("event"); }}>Receive test event</button>
          <button disabled={!connectors.some((c) => c.type === "WHATSAPP" && c.status === "ACTIVE" && c.provider.toUpperCase() === "B2BRAIN_SIMULATOR")} onClick={() => { const first = connectors.find((c) => c.type === "WHATSAPP" && c.status === "ACTIVE" && c.provider.toUpperCase() === "B2BRAIN_SIMULATOR"); if (first) setSelected(first.id); setError(""); setSimulatorMessage({ externalMessageId: crypto.randomUUID(), from: "", contactName: "", message: "" }); setSimulatorResult(""); setOpen("whatsapp-simulator"); }}>Simulate WhatsApp</button>
        </div>
        <section className="advanced-connector-list" aria-label="Configured connectors">
          {connectors.length === 0 ? <p>No connectors configured.</p> : connectors.slice(0, showAllConnectors ? undefined : 3).map((item) => <article className="connector-card" key={item.id}><div><strong>{item.name}</strong><i>{item.status.replaceAll("_", " ")}</i></div><p>{item.type} · {item.provider}</p><small>{item.mode.replaceAll("_", " ")} · {item._count.events} events</small><details className="connector-advanced"><summary>Advanced details</summary><code>{item.type === "WHATSAPP" ? `/api/v1/webhooks/whatsapp/${item.webhookKey}` : `/api/v1/webhooks/intake/${item.webhookKey}`}</code></details></article>)}
          {connectors.length > 3 && <button className="bridge-see-more" aria-expanded={showAllConnectors} onClick={() => setShowAllConnectors((value) => !value)}>{showAllConnectors ? "Show less" : `See ${connectors.length - 3} more`}</button>}
        </section>
      </details>}
      {view === "connections" && <BridgeDialogs
        open={open}
        connectors={connectors}
        selected={selected}
        connector={connector}
        event={event}
        credentials={credentials}
        websiteForm={websiteForm}
        simulatorMessage={simulatorMessage}
        simulatorResult={simulatorResult}
        error={error}
        setSelected={setSelected}
        setConnector={setConnector}
        setEvent={setEvent}
        setCredentials={setCredentials}
        setWebsiteForm={setWebsiteForm}
        setSimulatorMessage={setSimulatorMessage}
        onClose={() => setOpen(null)}
        onCreateConnector={() => void createConnector()}
        onSubmitEvent={() => void submitEvent()}
        onSaveCredentials={() => void saveCredentials()}
        onSaveWebsiteForm={() => void saveWebsiteForm()}
        onSimulateWhatsapp={() => void simulateWhatsapp()}
      />}
    </section>
  );
}
