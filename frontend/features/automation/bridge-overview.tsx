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
  canViewFinance,
  canViewInquiry,
  canViewTechnical,
  connectors,
  events,
  drafts,
  channel,
  onWebsiteForm,
  onDecision,
  onReply,
  onSendDraft,
}: {
  view: "connections" | "approvals" | "activity";
  canManage: boolean;
  canViewFinance: boolean;
  canViewInquiry: boolean;
  canViewTechnical: boolean;
  connectors: BridgeConnector[];
  events: BridgeEvent[];
  drafts: BridgeDraft[];
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
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const permittedEvents = events.filter((event) => event.kind !== "ORDER" || canViewFinance).filter((event) => event.kind !== "INQUIRY" || canViewInquiry);
  const visibleEvents = permittedEvents.filter((event) => {
    if (view === "approvals") return approvalFilter === "all" || (approvalFilter === "messages" && Boolean(event.payload.phone)) || (approvalFilter === "finance" && event.kind === "ORDER") || (approvalFilter === "leads" && event.kind === "INQUIRY");
    if (activityFilter === "completed") return event.status === "COMPLETED";
    if (activityFilter === "attention") return ["AWAITING_APPROVAL", "QUARANTINED"].includes(event.status);
    if (activityFilter === "failed") return event.status === "FAILED";
    if (activityFilter === "test") return event.connector.name.toLowerCase().includes("simulator") || event.eventName.toLowerCase().includes("test");
    return true;
  });
  const eventTitle = (event: BridgeEvent) => event.status === "FAILED" ? "Connection test failed" : event.status === "AWAITING_APPROVAL" ? "Item requires attention" : event.kind === "INQUIRY" ? "Lead enquiry received" : event.kind === "ORDER" ? "Order activity received" : event.status === "COMPLETED" ? "Automation completed" : "Automation activity received";
  const eventArea = (event: BridgeEvent) => event.kind === "ORDER" ? "Finance" : event.kind === "INQUIRY" ? "Leads" : event.payload.phone ? "Messages" : "Automation";

  return (
    <>
      {view === "activity" && <section className="bridge-metrics" aria-label="Activity summary">
        {[['Recent activity', permittedEvents.length], ['Completed', permittedEvents.filter(item => item.status === 'COMPLETED').length], ['Needs attention', permittedEvents.filter(item => ['AWAITING_APPROVAL', 'QUARANTINED'].includes(item.status)).length], ['Failed', permittedEvents.filter(item => item.status === 'FAILED').length]].map(([key, value]) => <article key={key}><span>{key}</span><strong>{value}</strong></article>)}
      </section>}
      {view === "approvals" && <section className="approval-summary" aria-label="Approval summary"><article><span>Waiting for your decision</span><strong>{permittedEvents.length + drafts.length}</strong><small>Only pending items are counted.</small></article><p>Opening this queue or a technical disclosure does not send a message or change business data.</p></section>}
      {(view === "approvals" || view === "activity") && <div className="bridge-filter-row" role="group" aria-label={`${view === 'approvals' ? 'Approval' : 'Activity'} filters`}>
        {(view === "approvals" ? [["all", "All pending"], ["messages", "Messages"], ...(canViewFinance ? [["finance", "Finance"]] : []), ...(canViewInquiry ? [["leads", "Leads"]] : [])] : [["all", "All"], ["completed", "Completed"], ["attention", "Needs attention"], ["failed", "Failed"], ["test", "Test / Simulator"]]).map(([value, label]) => <button type="button" key={value} aria-pressed={(view === 'approvals' ? approvalFilter : activityFilter) === value} onClick={() => view === 'approvals' ? setApprovalFilter(value) : setActivityFilter(value)}>{label}</button>)}
      </div>}
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
            <strong>{view === "approvals" ? "Items needing a decision" : "Recent automation activity"}</strong>
            <span>{visibleEvents.length}</span>
          </header>
          {!visibleEvents.length ? (
            <p className="bridge-empty">{view === "approvals" ? "No pending integration approvals." : "No activity matches this filter."}</p>
          ) : (
            visibleEvents.slice(0, expanded.events ? undefined : 3).map((event) => (
              <article className="bridge-event" key={event.id}>
                <div>
                  <span>{eventArea(event)} · {event.connector.name}</span>
                  <i className={event.status.toLowerCase()}>{event.status.toLowerCase().replaceAll("_", " ")}</i>
                </div>
                <strong>{eventTitle(event)}</strong>
                <p>{event.payload.contactName ?? event.payload.subject ?? (view === "approvals" ? "Review the verified details before deciding." : "The event was recorded by Automation.")}</p>
                <small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</small>
                {event.failureMessage && <small>{event.failureMessage}</small>}
                <div className="bridge-safety"><span>External delivery: <strong>No delivery recorded</strong></span><span>Business data: <strong>{event.status === "COMPLETED" ? "Processing completed" : "No change claimed"}</strong></span></div>
                {canViewTechnical && <details className="bridge-technical"><summary>Technical details</summary><dl><div><dt>Reference</dt><dd>{event.traceId}</dd></div><div><dt>Event type</dt><dd>{event.eventName}</dd></div><div><dt>Processing state</dt><dd>{event.status}</dd></div></dl></details>}
                {event.status === "AWAITING_APPROVAL" && canManage && view === "approvals" && (
                  <footer>
                    <button onClick={() => onDecision(event.id, "APPROVE")}>
                      Approve draft
                    </button>
                    <button onClick={() => onDecision(event.id, "IGNORE")}>
                      Reject
                    </button>
                    <button onClick={() => onDecision(event.id, "QUARANTINE")}>
                      Set aside for review
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
          {visibleEvents.length > 3 && (
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
              {expanded.events ? "Show less" : `See ${visibleEvents.length - 3} more`}
            </button>
          )}
        </section>
      </div>}
      {view === "approvals" && <section className="bridge-drafts">
        <header>
          <strong>Message drafts</strong>
          <span>{drafts.length}</span>
        </header>
        {!drafts.length ? (
          <p className="bridge-empty">No message drafts are waiting for approval.</p>
        ) : (
          drafts.slice(0, expanded.drafts ? undefined : 3).map((draft) => (
            <article key={draft.id}>
              <div>
                <strong>
                  {draft.connector.name}
                </strong>
                <i>{draft.status}</i>
              </div>
              <p>{draft.body}</p>
              {draft.failureMessage && <small>{draft.failureMessage}</small>}
              {draft.status === "PENDING_APPROVAL" &&
                (draft.connector.provider.toUpperCase() === "B2BRAIN_SIMULATOR" ? (
                  <small>
                    Test draft only — Simulator preview; external sending is disabled.
                  </small>
                ) : canManage ? (
                  <button onClick={() => onSendDraft(draft.id)}>
                    Approve & send
                  </button>
                ) : <small>External delivery requires an authorized decision.</small>)}
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
