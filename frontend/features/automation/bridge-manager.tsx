"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Connector = {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  mode: string;
  webhookKey: string;
  lastReceivedAt: string | null;
  credentialsConfiguredAt: string | null;
  whatsappPhoneNumberId: string | null;
  _count: { events: number; messageDrafts: number };
};
type Event = {
  id: string;
  externalEventId: string;
  eventName: string;
  kind: string;
  status: string;
  traceId: string;
  failureMessage: string | null;
  resultType: string | null;
  createdAt: string;
  connector: { name: string };
  attempts: { id: string; status: string; errorMessage: string | null }[];
  payload: { phone?: string | null };
};
type Draft = {
  id: string;
  connectorId: string;
  eventId: string | null;
  recipient: string;
  body: string;
  status: string;
  failureMessage: string | null;
  createdAt: string;
  connector: { name: string };
};
type Payload = {
  success: true;
  data: {
    connectors: Connector[];
    events: Event[];
    metrics: Record<string, number>;
  };
};
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
  const { authorizedRequest } = useAuth(),
    [connectors, setConnectors] = useState<Connector[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [connector, setConnector] = useState(connectorBlank),
    [event, setEvent] = useState(eventBlank),
    [selected, setSelected] = useState(""),
    [open, setOpen] = useState<"connector" | "event" | "credentials" | null>(
      null,
    ),
    [error, setError] = useState(""),
    [secret, setSecret] = useState(""),
    [credentials, setCredentials] = useState({
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      appSecret: "",
    });
  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      authorizedRequest<Payload>("/automation-bridge"),
      authorizedRequest<{ success: true; data: Draft[] }>(
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
  async function createReply(item: Event) {
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
      <section className="bridge-metrics">
        {Object.entries(metrics).map(([k, v]) => (
          <article key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </article>
        ))}
      </section>
      <div className="bridge-columns">
        <section>
          <header>
            <strong>Connectors</strong>
            <span>{connectors.length}</span>
          </header>
          {connectors.length === 0 ? (
            <p className="bridge-empty">No connectors configured.</p>
          ) : (
            connectors.map((c) => (
              <article className="connector-card" key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <i>{c.status}</i>
                </div>
                <p>
                  {c.type} · {c.provider}
                </p>
                <small>
                  {c.mode.replaceAll("_", " ")} · {c._count.events} events
                </small>
                {c.type === "WHATSAPP" && (
                  <>
                    <small>
                      {c.credentialsConfiguredAt
                        ? "Credentials encrypted"
                        : "Credentials required"}
                    </small>
                    <code>/api/v1/webhooks/whatsapp/{c.webhookKey}</code>
                  </>
                )}
                {c.type !== "WHATSAPP" && (
                  <>
                    <small>POST signed events to</small>
                    <code>/api/v1/webhooks/intake/{c.webhookKey}</code>
                  </>
                )}
              </article>
            ))
          )}
        </section>
        <section>
          <header>
            <strong>Integration event inbox</strong>
            <span>{events.length}</span>
          </header>
          {events.length === 0 ? (
            <p className="bridge-empty">No external events received.</p>
          ) : (
            events.map((e) => (
              <article className="bridge-event" key={e.id}>
                <div>
                  <span>
                    {e.connector.name} · {e.kind}
                  </span>
                  <i className={e.status.toLowerCase()}>{e.status}</i>
                </div>
                <strong>{e.eventName}</strong>
                <p>Trace {e.traceId}</p>
                {e.failureMessage && <small>{e.failureMessage}</small>}
                {e.status === "AWAITING_APPROVAL" && (
                  <footer>
                    <button onClick={() => void decide(e.id, "APPROVE")}>
                      Approve & route
                    </button>
                    <button onClick={() => void decide(e.id, "IGNORE")}>
                      Ignore
                    </button>
                    <button onClick={() => void decide(e.id, "QUARANTINE")}>
                      Quarantine
                    </button>
                  </footer>
                )}
                {e.payload.phone && (
                  <footer>
                    <button onClick={() => void createReply(e)}>
                      Draft WhatsApp reply
                    </button>
                  </footer>
                )}
              </article>
            ))
          )}
        </section>
      </div>
      <section className="bridge-drafts">
        <header>
          <strong>WhatsApp reply approvals</strong>
          <span>{drafts.length}</span>
        </header>
        {drafts.length === 0 ? (
          <p className="bridge-empty">No reply drafts.</p>
        ) : (
          drafts.map((d) => (
            <article key={d.id}>
              <div>
                <strong>
                  {d.connector.name} → {d.recipient}
                </strong>
                <i>{d.status}</i>
              </div>
              <p>{d.body}</p>
              {d.failureMessage && <small>{d.failureMessage}</small>}
              {d.status === "PENDING_APPROVAL" && (
                <button onClick={() => void sendDraft(d.id)}>
                  Approve & send
                </button>
              )}
            </article>
          ))
        )}
      </section>
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog bridge-dialog">
            <header>
              <h3>
                {open === "credentials"
                  ? "Configure WhatsApp"
                  : open === "connector"
                    ? "Create connector"
                    : "Receive controlled test event"}
              </h3>
              <button onClick={() => setOpen(null)}>×</button>
            </header>
            {open === "credentials" ? (
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
