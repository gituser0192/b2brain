"use client";

import { useState } from "react";
import Link from "next/link";
import type { BridgeConnector, BridgeDraft, BridgeEvent } from "./bridge-types";

function connectorStatus(connector: BridgeConnector) {
  if (connector.status === "PAUSED") return "Paused";
  if (connector.status === "ERROR") return "Needs attention";
  if (connector.status === "ACTIVE" && ["B2BRAIN_SIMULATOR", "META_LEAD_ADS", "META_WHATSAPP_CLOUD"].includes(connector.provider)) return "Test ready";
  if (connector.status === "ACTIVE" && ["WEBSITE", "EMAIL"].includes(connector.type)) return "Setup in progress";
  if (connector.status === "ACTIVE") return "Connected";
  if (connector.credentialsConfiguredAt) return "Setup in progress";
  return "Not configured";
}

type ConnectionChannel = "whatsapp" | "meta" | "website" | "email";
const channelCopy: Record<ConnectionChannel, { name: string; purpose: string; note: string }> = {
  whatsapp: { name: "WhatsApp Business", purpose: "Receive customer messages through Test Mode or the CRM simulator.", note: "Test Mode and Simulator are not live WhatsApp connections. Outbound messaging remains disabled." },
  meta: { name: "Meta Lead Ads", purpose: "Prepare lead capture with the guided synthetic setup.", note: "Test Mode uses fake authorization. Real Meta activation remains disabled." },
  website: { name: "Website", purpose: "Receive website enquiries and create draft orders.", note: "Signed server-to-server intake; orders remain Draft, Unpaid and Unfulfilled." },
  email: { name: "Email", purpose: "Control approved email delivery and sending policy.", note: "A connector or sent history does not prove SMTP is currently available." },
};

function belongsTo(connector: BridgeConnector, channel: ConnectionChannel) {
  if (channel === "whatsapp") return connector.type === "WHATSAPP";
  if (channel === "meta") return connector.type === "SOCIAL" && connector.provider === "META_LEAD_ADS";
  return connector.type === channel.toUpperCase();
}

function channelStatus(connectors: BridgeConnector[], channel: ConnectionChannel) {
  const matches = connectors.filter((connector) => belongsTo(connector, channel));
  if (!matches.length) return "Not configured";
  if (matches.some((connector) => connector.status === "ERROR")) return "Needs attention";
  if (matches.some((connector) => connector.status === "PAUSED")) return "Paused";
  if (matches.some((connector) => connector.status === "ACTIVE" && ["B2BRAIN_SIMULATOR", "META_LEAD_ADS", "META_WHATSAPP_CLOUD"].includes(connector.provider))) return "Test ready";
  if (["website", "email"].includes(channel) && matches.some((connector) => connector.status === "ACTIVE")) return "Setup in progress";
  if (matches.some((connector) => connector.status === "ACTIVE")) return "Connected";
  return "Setup in progress";
}

export function BridgeOverview({
  view,
  canManage,
  connectors,
  events,
  drafts,
  metrics,
  channel,
  onWebsiteForm,
  onDecision,
  onReply,
  onSendDraft,
}: {
  view: "connections" | "approvals" | "activity";
  canManage: boolean;
  connectors: BridgeConnector[];
  events: BridgeEvent[];
  drafts: BridgeDraft[];
  metrics: Record<string, number>;
  channel?: ConnectionChannel | null;
  onWebsiteForm: (id: string) => void;
  onDecision: (
    id: string,
    decision: "APPROVE" | "IGNORE" | "QUARANTINE",
  ) => void;
  onReply: (event: BridgeEvent) => void;
  onSendDraft: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState({
    connectors: false,
    events: false,
    drafts: false,
  });

  return (
    <>
      {view === "activity" && <section className="bridge-metrics">
        {Object.entries(metrics).map(([key, value]) => (
          <article key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>}
      {view === "connections" && !channel && <><section className="connection-summary" aria-label="Connection summary">
        {["Connected", "Test ready", "Setup needed", "Needs attention"].map((label) => {
          const statuses = (Object.keys(channelCopy) as ConnectionChannel[]).map((item) => channelStatus(connectors, item));
          const count = label === "Setup needed" ? statuses.filter((status) => ["Not configured", "Setup in progress"].includes(status)).length : statuses.filter((status) => status === label).length;
          return <article key={label}><span>{label}</span><strong>{count}</strong></article>;
        })}
      </section><section className="connection-cards" aria-label="Business channels">
        {(Object.keys(channelCopy) as ConnectionChannel[]).map((item) => {
          const status = channelStatus(connectors, item);
          const configured = connectors.some((connector) => belongsTo(connector, item));
          return <article key={item}><header><div><span>{channelCopy[item].name}</span><i>{status}</i></div><p>{channelCopy[item].purpose}</p></header><div className="connection-card-note">{channelCopy[item].note}</div><Link href={`/automation?section=connections&channel=${item}`}>{configured ? status === "Needs attention" ? "Review issue" : "Manage" : "Start setup"}</Link></article>;
        })}
      </section></>}
      {view === "connections" && channel === "website" && <section className="connection-detail"><header><p>Website channel</p><h3>Website enquiries and draft orders</h3><span>These integrations accept signed server-to-server events when external channels are enabled. Browser-reported payment success is never trusted.</span></header><div className="connection-detail-notice">Orders remain Draft, Unpaid and Unfulfilled until verified business workflows update them. Setup may require a website administrator.</div></section>}
      {view === "connections" && channel && channel !== "email" && <div className="bridge-columns bridge-columns-single">
        <section>
          <header>
            <strong>{channelCopy[channel].name} connections</strong>
            <span>{connectors.filter((connector) => belongsTo(connector, channel)).length}</span>
          </header>
          {!connectors.some((connector) => belongsTo(connector, channel)) ? (
            <p className="bridge-empty">No {channelCopy[channel].name} connection is configured.</p>
          ) : (
            connectors.filter((connector) => belongsTo(connector, channel)).slice(0, expanded.connectors ? undefined : 3).map((connector) => (
              <article className="connector-card" key={connector.id}>
                <div>
                  <strong>{connector.name}</strong>
                  <i>{connectorStatus(connector)}</i>
                </div>
                <p>{connector.provider === "B2BRAIN_SIMULATOR" ? "Simulator" : connectorStatus(connector)}</p>
                <small>
                  {connector.mode.replaceAll("_", " ")} ·{" "}
                  {connector._count.events} events
                </small>
                {canManage && <details className="connector-advanced">
                  <summary>Advanced details</summary>
                {connector.type === "WHATSAPP" && (
                  <>
                    <small>
                      {connector.credentialsConfiguredAt
                        ? "Credentials encrypted"
                        : "Credentials required"}
                    </small>
                    <code>
                      /api/v1/webhooks/whatsapp/{connector.webhookKey}
                    </code>
                  </>
                )}
                {connector.type !== "WHATSAPP" && (
                  <>
                    <small>POST signed events to</small>
                    <code>/api/v1/webhooks/intake/{connector.webhookKey}</code>
                  </>
                )}
                </details>}
                {connector.type === "WEBSITE" && canManage && (
                  <footer>
                    <button onClick={() => onWebsiteForm(connector.id)}>
                      Configure lead form
                    </button>
                    <button
                      onClick={() =>
                        window.open(`/forms/${connector.webhookKey}`, "_blank")
                      }
                    >
                      Preview
                    </button>
                  </footer>
                )}
              </article>
            ))
          )}
          {connectors.filter((connector) => belongsTo(connector, channel)).length > 3 && (
            <button
              className="bridge-see-more"
              aria-expanded={expanded.connectors}
              onClick={() =>
                setExpanded((current) => ({
                  ...current,
                  connectors: !current.connectors,
                }))
              }
            >
              {expanded.connectors ? "Show less" : `See ${connectors.filter((connector) => belongsTo(connector, channel)).length - 3} more`}
            </button>
          )}
        </section>
      </div>}
      {(view === "activity" || view === "approvals") && <div className="bridge-columns bridge-columns-single">
        <section>
          <header>
            <strong>Integration event inbox</strong>
            <span>{events.length}</span>
          </header>
          {!events.length ? (
            <p className="bridge-empty">No external events received.</p>
          ) : (
            events.slice(0, expanded.events ? undefined : 3).map((event) => (
              <article className="bridge-event" key={event.id}>
                <div>
                  <span>
                    {event.connector.name} · {event.kind}
                  </span>
                  <i className={event.status.toLowerCase()}>{event.status}</i>
                </div>
                <strong>{event.eventName}</strong>
                <p>Trace {event.traceId}</p>
                {event.failureMessage && <small>{event.failureMessage}</small>}
                {event.status === "AWAITING_APPROVAL" && canManage && view === "approvals" && (
                  <footer>
                    <button onClick={() => onDecision(event.id, "APPROVE")}>
                      Approve & route
                    </button>
                    <button onClick={() => onDecision(event.id, "IGNORE")}>
                      Ignore
                    </button>
                    <button onClick={() => onDecision(event.id, "QUARANTINE")}>
                      Quarantine
                    </button>
                  </footer>
                )}
                {event.payload.phone && canManage && view === "approvals" && (
                  <footer>
                    <button onClick={() => onReply(event)}>
                      Draft WhatsApp reply
                    </button>
                  </footer>
                )}
              </article>
            ))
          )}
          {events.length > 3 && (
            <button
              className="bridge-see-more"
              aria-expanded={expanded.events}
              onClick={() =>
                setExpanded((current) => ({
                  ...current,
                  events: !current.events,
                }))
              }
            >
              {expanded.events ? "Show less" : `See ${events.length - 3} more`}
            </button>
          )}
        </section>
      </div>}
      {view === "approvals" && <section className="bridge-drafts">
        <header>
          <strong>WhatsApp reply approvals</strong>
          <span>{drafts.length}</span>
        </header>
        {!drafts.length ? (
          <p className="bridge-empty">No reply drafts.</p>
        ) : (
          drafts.slice(0, expanded.drafts ? undefined : 3).map((draft) => (
            <article key={draft.id}>
              <div>
                <strong>
                  {draft.connector.name} → {draft.recipient}
                </strong>
                <i>{draft.status}</i>
              </div>
              <p>{draft.body}</p>
              {draft.failureMessage && <small>{draft.failureMessage}</small>}
              {canManage && draft.status === "PENDING_APPROVAL" &&
                (draft.connector.provider.toUpperCase() ===
                "B2BRAIN_SIMULATOR" ? (
                  <small>
                    Simulator preview only — external sending is disabled.
                  </small>
                ) : (
                  <button onClick={() => onSendDraft(draft.id)}>
                    Approve & send
                  </button>
                ))}
            </article>
          ))
        )}
        {drafts.length > 3 && (
          <button
            className="bridge-see-more"
            aria-expanded={expanded.drafts}
            onClick={() =>
              setExpanded((current) => ({
                ...current,
                drafts: !current.drafts,
              }))
            }
          >
            {expanded.drafts ? "Show less" : `See ${drafts.length - 3} more`}
          </button>
        )}
      </section>}
    </>
  );
}
