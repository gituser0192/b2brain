"use client";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";
import { WhatsappFollowUpWorkspace } from "./whatsapp-follow-up-workspace";
import { BridgeOverview } from "./bridge-overview";
import type { BridgeConnector, BridgeDraft, BridgeEvent, BridgePayload } from "./bridge-types";
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
export function BridgeManager() {
  const { authorizedRequest, session } = useAuth(),
    queryClient = useQueryClient(),
    [connectors, setConnectors] = useState<BridgeConnector[]>([]),
    [events, setEvents] = useState<BridgeEvent[]>([]),
    [drafts, setDrafts] = useState<BridgeDraft[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [connector, setConnector] = useState(connectorBlank),
    [event, setEvent] = useState(eventBlank),
    [selected, setSelected] = useState(""),
    [open, setOpen] = useState<"connector" | "event" | "credentials" | "website-form" | "whatsapp-simulator" | null>(
      null,
    ),
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
  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      authorizedRequest<BridgePayload>("/automation-bridge"),
      authorizedRequest<{ success: true; data: BridgeDraft[] }>(
        "/automation-bridge/message-drafts",
      ),
    ]);
    setConnectors(r.data.connectors);
    setEvents(r.data.events);
    setMetrics(r.data.metrics);
    setDrafts(d.data);
    setSelected((x) => x || r.data.connectors[0]?.id || "");
  }, [authorizedRequest]);
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
    <section className="bridge-manager">
      <header>
        <div>
          <p>Event and execution layer</p>
          <h3>B² Automation Bridge</h3>
          <span>
            Provider-neutral intake, idempotency, approval, quarantine, retry,
            and traceability.
          </span>
        </div>
        <div>
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
        </div>
      </header>
      {error && <div className="form-alert">{error}</div>}
      {secret && (
        <div className="bridge-secret">
          <strong>Webhook secret — copy now</strong>
          <code>{secret}</code>
          <button onClick={() => setSecret("")}>I stored it securely</button>
        </div>
      )}
      <BridgeOverview
        connectors={connectors}
        events={events}
        drafts={drafts}
        metrics={metrics}
        onWebsiteForm={(id) => {
          setSelected(id);
          setOpen("website-form");
        }}
        onDecision={(id, decision) => void decide(id, decision)}
        onReply={(item) => void createReply(item)}
        onSendDraft={(id) => void sendDraft(id)}
      />
      <WhatsappFollowUpWorkspace />
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog bridge-dialog">
            <header>
              <h3>
                {open === "credentials"
                  ? "Configure WhatsApp"
                  : open === "whatsapp-simulator"
                    ? "WhatsApp CRM Intake Simulator"
                  : open === "website-form"
                    ? "Configure website lead form"
                  : open === "connector"
                    ? "Create connector"
                    : "Receive controlled test event"}
              </h3>
              <button onClick={() => setOpen(null)}>×</button>
            </header>
            {open === "whatsapp-simulator" ? (
              <>
                <div className="inventory-control-note">This simulator creates real organization-scoped CRM records and approval drafts, but it never contacts Meta or sends a message.</div>
                {simulatorResult && <div className="bridge-secret"><strong>{simulatorResult}</strong></div>}
                <div className="agent-form-grid">
                  <label><span>Simulator connector</span><select value={selected} onChange={(e) => setSelected(e.target.value)}>{connectors.filter((c) => c.type === "WHATSAPP" && c.provider.toUpperCase() === "B2BRAIN_SIMULATOR").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label><span>External WhatsApp message ID</span><input value={simulatorMessage.externalMessageId} onChange={(e) => setSimulatorMessage({ ...simulatorMessage, externalMessageId: e.target.value })} /></label>
                  <label><span>Customer name</span><input value={simulatorMessage.contactName} onChange={(e) => setSimulatorMessage({ ...simulatorMessage, contactName: e.target.value })} /></label>
                  <label><span>WhatsApp phone</span><input placeholder="919876543210" value={simulatorMessage.from} onChange={(e) => setSimulatorMessage({ ...simulatorMessage, from: e.target.value })} /></label>
                </div>
                <label><span>Incoming customer message</span><textarea rows={4} maxLength={4096} value={simulatorMessage.message} onChange={(e) => setSimulatorMessage({ ...simulatorMessage, message: e.target.value })} /></label>
                <footer><button onClick={() => setOpen(null)}>Close</button><button onClick={() => void simulateWhatsapp()}>Process message</button></footer>
              </>
            ) : open === "website-form" ? (
              <>
                <div className="agent-form-grid">
                  <label><span>Form title</span><input value={websiteForm.title} onChange={(e) => setWebsiteForm({ ...websiteForm, title: e.target.value })} /></label>
                  <label><span>Button label</span><input value={websiteForm.submitLabel} onChange={(e) => setWebsiteForm({ ...websiteForm, submitLabel: e.target.value })} /></label>
                  <label><span>Service field label</span><input value={websiteForm.serviceLabel} onChange={(e) => setWebsiteForm({ ...websiteForm, serviceLabel: e.target.value })} /></label>
                  <label><span>Accent color</span><input type="color" value={websiteForm.accentColor} onChange={(e) => setWebsiteForm({ ...websiteForm, accentColor: e.target.value })} /></label>
                </div>
                <label><span>Description</span><textarea rows={2} value={websiteForm.description} onChange={(e) => setWebsiteForm({ ...websiteForm, description: e.target.value })} /></label>
                <label><span>Success message</span><textarea rows={2} value={websiteForm.successMessage} onChange={(e) => setWebsiteForm({ ...websiteForm, successMessage: e.target.value })} /></label>
                <label><input type="checkbox" checked={websiteForm.askService} onChange={(e) => setWebsiteForm({ ...websiteForm, askService: e.target.checked })} /> Ask which service the customer needs</label>
                <div className="inventory-control-note">
                  Embed code: <code>{`<iframe src="${typeof window !== "undefined" ? window.location.origin : "https://your-b2brain-domain"}/forms/${connectors.find((item) => item.id === selected)?.webhookKey ?? "FORM_KEY"}" width="100%" height="720" style="border:0" loading="lazy"></iframe>`}</code>
                </div>
                <footer><button onClick={() => setOpen(null)}>Cancel</button><button onClick={() => void saveWebsiteForm()}>Save form</button></footer>
              </>
            ) : open === "credentials" ? (
              <>
                <label>
                  <span>WhatsApp connector</span>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {connectors
                      .filter((c) => c.type === "WHATSAPP")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="agent-form-grid">
                  <label>
                    <span>Phone number ID</span>
                    <input
                      value={credentials.phoneNumberId}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          phoneNumberId: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Business account ID</span>
                    <input
                      value={credentials.businessAccountId}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          businessAccountId: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Permanent access token</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={credentials.accessToken}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          accessToken: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Meta App Secret</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={credentials.appSecret}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          appSecret: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="inventory-control-note">
                  Credentials are encrypted before database storage and never
                  returned to the browser. Use the connector&apos;s one-time secret
                  as Meta&apos;s verify token.
                </div>
                <footer>
                  <button onClick={() => setOpen(null)}>Cancel</button>
                  <button
                    disabled={
                      !selected ||
                      !credentials.phoneNumberId ||
                      !credentials.businessAccountId ||
                      credentials.accessToken.length < 20 ||
                      credentials.appSecret.length < 10
                    }
                    onClick={() => void saveCredentials()}
                  >
                    Encrypt & save
                  </button>
                </footer>
              </>
            ) : open === "connector" ? (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={connector.name}
                      onChange={(e) =>
                        setConnector({ ...connector, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={connector.type}
                      onChange={(e) =>
                        setConnector({ ...connector, type: e.target.value })
                      }
                    >
                      {[
                        "WHATSAPP",
                        "WEBSITE",
                        "COMMERCE",
                        "PAYMENT",
                        "EMAIL",
                        "SOCIAL",
                        "CUSTOM",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Provider</span>
                    <input
                      value={connector.provider}
                      onChange={(e) =>
                        setConnector({ ...connector, provider: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={connector.status}
                      onChange={(e) =>
                        setConnector({ ...connector, status: e.target.value })
                      }
                    >
                      <option>DRAFT</option>
                      <option>ACTIVE</option>
                      <option>PAUSED</option>
                    </select>
                  </label>
                  <label>
                    <span>Automation mode</span>
                    <select
                      value={connector.mode}
                      onChange={(e) =>
                        setConnector({ ...connector, mode: e.target.value })
                      }
                    >
                      <option>MANUAL_APPROVAL</option>
                      <option>ASSISTED</option>
                      <option>POLICY_LIMITED</option>
                    </select>
                  </label>
                </div>
                <div className="inventory-control-note">
                  Creating this record does not connect a provider. Real webhook
                  activation requires official provider credentials and
                  signature verification.
                </div>
                <footer>
                  <button onClick={() => setOpen(null)}>Cancel</button>
                  <button
                    disabled={!connector.name || !connector.provider}
                    onClick={() => void createConnector()}
                  >
                    Create
                  </button>
                </footer>
              </>
            ) : (
              <>
                <label>
                  <span>Connector</span>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {connectors
                      .filter((c) => c.status === "ACTIVE")
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="agent-form-grid">
                  <label>
                    <span>External event ID</span>
                    <input
                      value={event.externalEventId}
                      onChange={(e) =>
                        setEvent({ ...event, externalEventId: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      value={event.kind}
                      onChange={(e) =>
                        setEvent({ ...event, kind: e.target.value })
                      }
                    >
                      {[
                        "INQUIRY",
                        "SUPPORT_REQUEST",
                        "COMPLAINT",
                        "SALES_OPPORTUNITY",
                        "ORDER_REQUEST",
                        "ORDER",
                        "PAYMENT",
                        "REFUND",
                        "WEBSITE_CHANGE",
                        "UNKNOWN",
                        "SPAM",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Contact name</span>
                    <input
                      value={event.contactName}
                      onChange={(e) =>
                        setEvent({ ...event, contactName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      value={event.email}
                      onChange={(e) =>
                        setEvent({ ...event, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input
                      value={event.phone}
                      onChange={(e) =>
                        setEvent({ ...event, phone: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Subject</span>
                    <input
                      value={event.subject}
                      onChange={(e) =>
                        setEvent({ ...event, subject: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>Message</span>
                  <textarea
                    value={event.message}
                    onChange={(e) =>
                      setEvent({ ...event, message: e.target.value })
                    }
                  />
                </label>
                <footer>
                  <button onClick={() => setOpen(null)}>Cancel</button>
                  <button
                    disabled={!selected || !event.externalEventId}
                    onClick={() => void submitEvent()}
                  >
                    Receive event
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
