import type { BridgeConnector, BridgeDraft, BridgeEvent } from "./bridge-types";

export function BridgeOverview({
  connectors,
  events,
  drafts,
  metrics,
  onWebsiteForm,
  onDecision,
  onReply,
  onSendDraft,
}: {
  connectors: BridgeConnector[];
  events: BridgeEvent[];
  drafts: BridgeDraft[];
  metrics: Record<string, number>;
  onWebsiteForm: (id: string) => void;
  onDecision: (
    id: string,
    decision: "APPROVE" | "IGNORE" | "QUARANTINE",
  ) => void;
  onReply: (event: BridgeEvent) => void;
  onSendDraft: (id: string) => void;
}) {
  return (
    <>
      <section className="bridge-metrics">
        {Object.entries(metrics).map(([key, value]) => (
          <article key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <div className="bridge-columns">
        <section>
          <header>
            <strong>Connectors</strong>
            <span>{connectors.length}</span>
          </header>
          {!connectors.length ? (
            <p className="bridge-empty">No connectors configured.</p>
          ) : (
            connectors.map((connector) => (
              <article className="connector-card" key={connector.id}>
                <div>
                  <strong>{connector.name}</strong>
                  <i>{connector.status}</i>
                </div>
                <p>
                  {connector.type} · {connector.provider}
                </p>
                <small>
                  {connector.mode.replaceAll("_", " ")} ·{" "}
                  {connector._count.events} events
                </small>
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
                {connector.type === "WEBSITE" && (
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
        </section>
        <section>
          <header>
            <strong>Integration event inbox</strong>
            <span>{events.length}</span>
          </header>
          {!events.length ? (
            <p className="bridge-empty">No external events received.</p>
          ) : (
            events.map((event) => (
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
                {event.status === "AWAITING_APPROVAL" && (
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
                {event.payload.phone && (
                  <footer>
                    <button onClick={() => onReply(event)}>
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
        {!drafts.length ? (
          <p className="bridge-empty">No reply drafts.</p>
        ) : (
          drafts.map((draft) => (
            <article key={draft.id}>
              <div>
                <strong>
                  {draft.connector.name} → {draft.recipient}
                </strong>
                <i>{draft.status}</i>
              </div>
              <p>{draft.body}</p>
              {draft.failureMessage && <small>{draft.failureMessage}</small>}
              {draft.status === "PENDING_APPROVAL" &&
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
      </section>
    </>
  );
}
