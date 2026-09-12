"use client";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";
import { WhatsappFollowUpWorkspace } from "./whatsapp-follow-up-workspace";
import { BridgeOverview } from "./bridge-overview";
import { BridgeDialogs, type BridgeDialogKind } from "./bridge-dialogs";
import type { BridgeConnector, BridgeDraft, BridgeEvent, BridgePayload } from "./bridge-types";
import { MetaLeadSetup } from "./meta-lead-setup";
import { WhatsappBusinessSetup } from "./whatsapp-business-setup";
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
export function BridgeManager({ view }: { view: "connections" | "approvals" | "activity" }) {
  const { authorizedRequest, session } = useAuth(),
    queryClient = useQueryClient(),
    [connectors, setConnectors] = useState<BridgeConnector[]>([]),
    [events, setEvents] = useState<BridgeEvent[]>([]),
    [drafts, setDrafts] = useState<BridgeDraft[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [connector, setConnector] = useState(connectorBlank),
    [event, setEvent] = useState(eventBlank),
    [selected, setSelected] = useState(""),
    [open, setOpen] = useState<BridgeDialogKind | null>(null),
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
  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      authorizedRequest<BridgePayload>("/automation-bridge"),
      view === "approvals"
        ? authorizedRequest<{ success: true; data: BridgeDraft[] }>("/automation-bridge/message-drafts")
        : Promise.resolve({ success: true as const, data: [] as BridgeDraft[] }),
    ]);
    setConnectors(r.data.connectors);
    setEvents(r.data.events);
    setMetrics(r.data.metrics);
    setDrafts(d.data);
    setSelected((x) => x || r.data.connectors[0]?.id || "");
  }, [authorizedRequest, view]);
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
        {view === "connections" && canManage && <div>
          <button onClick={() => setOpen("connector")}>New connector</button>
          <button
            disabled={!connectors.some((c) => c.type === "WHATSAPP")}
            onClick={() => {
              const first = connectors.find((c) => c.type === "WHATSAPP");
              if (first) setSelected(first.id);
              setOpen("credentials");
            }}
          >
            Configure WhatsApp
          </button>
          <button
            disabled={!connectors.some((c) => c.status === "ACTIVE")}
            onClick={() => {
              setEvent({ ...eventBlank, externalEventId: crypto.randomUUID() });
              setOpen("event");
            }}
          >
            Receive test event
          </button>
          <button
            disabled={!connectors.some((c) => c.type === "WHATSAPP" && c.status === "ACTIVE" && c.provider.toUpperCase() === "B2BRAIN_SIMULATOR")}
            onClick={() => {
              const first = connectors.find((c) => c.type === "WHATSAPP" && c.status === "ACTIVE" && c.provider.toUpperCase() === "B2BRAIN_SIMULATOR");
              if (first) setSelected(first.id);
              setError("");
              setSimulatorMessage({ externalMessageId: crypto.randomUUID(), from: "", contactName: "", message: "" });
              setSimulatorResult("");
              setOpen("whatsapp-simulator");
            }}
          >
            Simulate WhatsApp
          </button>
        </div>}
      </header>
      {error && !open && <div className="form-alert" role="alert">{error}</div>}
      {secret && (
        <div className="bridge-secret">
          <strong>Webhook secret — copy now</strong>
          <code>{secret}</code>
          <button onClick={() => setSecret("")}>I stored it securely</button>
        </div>
      )}
      <BridgeOverview
        view={view}
        canManage={canManage}
        connectors={connectors}
        events={view === "approvals" ? events.filter((item) => item.status === "AWAITING_APPROVAL") : events}
        drafts={view === "approvals" ? drafts.filter((item) => item.status === "PENDING_APPROVAL") : drafts}
        metrics={metrics}
        onWebsiteForm={(id) => {
          setSelected(id);
          setOpen("website-form");
        }}
        onDecision={(id, decision) => void decide(id, decision)}
        onReply={(item) => void createReply(item)}
        onSendDraft={(id) => void sendDraft(id)}
      />
      {view === "connections" && connectors.filter(item => item.type === "SOCIAL" && item.provider === "META_LEAD_ADS").map(item => <MetaLeadSetup key={item.id} connectorId={item.id} canManage={canManage} />)}
      {view === "connections" && connectors.filter(item => item.type === "WHATSAPP" && item.provider === "META_WHATSAPP_CLOUD").map(item => <WhatsappBusinessSetup key={item.id} connectorId={item.id} canManage={canManage} />)}
      {view === "approvals" && <WhatsappFollowUpWorkspace />}
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
