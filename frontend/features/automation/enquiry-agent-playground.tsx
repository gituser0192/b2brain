"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";

type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };
type KnowledgeSource = {
  id: string;
  title: string;
  category: string;
  updatedAt: string | null;
};
type Provider = {
  name?: string;
  model?: string | null;
  source?: "REAL_AI" | "DETERMINISTIC_FALLBACK";
  usage?: Usage;
  usageLimitReached?: boolean;
};
type Analysis = {
  intent?: string;
  confidence?: number;
  language?: string;
  promptInjectionDetected?: boolean;
  missingInformation?: string[];
  escalationReason?: string | null;
};
type Result = {
  duplicate: boolean;
  customer?: { id: string; displayName: string } | null;
  inquiryId?: string;
  analysis?: Analysis;
  response?: string;
  draftId?: string | null;
};
type AgentStatus = {
  provider: string;
  realAiConfigured: boolean;
  killSwitchActive: boolean;
  mode: "REAL_AI" | "DETERMINISTIC_FALLBACK";
  dailyRequestLimit: number;
};
type ConversationStatus =
  "NEW" | "WAITING_APPROVAL" | "HUMAN_TAKEOVER" | "RESOLVED" | "FAILED";
type Conversation = {
  conversationId: string;
  customerName: string;
  phone: string | null;
  lastMessage: string;
  intent: string;
  status: ConversationStatus;
  unreadCount: number;
  updatedAt: string;
  customerId: string | null;
  inquiryId: string | null;
  followUpId: string | null;
};
type HistoryMessage = {
  eventId: string;
  externalMessageId: string;
  customerMessage: string;
  analysis?: Analysis;
  provider?: Provider;
  knowledgeSources?: KnowledgeSource[];
  response: string | null;
  draftId: string | null;
  draftStatus: string | null;
  failureMessage: string | null;
  approvedBy: string | null;
  createdAt: string;
};
type History = { humanTakeover: boolean; messages: HistoryMessage[] };

const filters: { key: "ALL" | ConversationStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "WAITING_APPROVAL", label: "Waiting for approval" },
  { key: "HUMAN_TAKEOVER", label: "Human takeover" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "FAILED", label: "Failed" },
];
const samples = [
  "Hello, what services do you provide?",
  "Mujhe apne business ke liye CRM chahiye, demo batao",
  "आपकी सेवा की कीमत क्या है?",
  "My dashboard is not working, please help",
  "I want a refund and payment reversal",
];
const friendlyIntent = (value?: string) =>
  value
    ? value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (letter) => letter.toUpperCase())
    : "Unclassified";
const friendlyStatus: Record<ConversationStatus, string> = {
  NEW: "New",
  WAITING_APPROVAL: "Waiting for approval",
  HUMAN_TAKEOVER: "Human takeover",
  RESOLVED: "Resolved",
  FAILED: "Failed",
};

export function EnquiryAgentPlayground({
  onNavigate,
}: {
  onNavigate?: (target: {
    view: "crm" | "inquiries";
    id: string;
    followUpId?: string;
  }) => void;
}) {
  const { session, authorizedRequest } = useAuth();
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<History>({
    messages: [],
    humanTakeover: false,
  });
  const [filter, setFilter] = useState<"ALL" | ConversationStatus>("ALL");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [lastRequest, setLastRequest] = useState<{
    externalMessageId: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [review, setReview] = useState<HistoryMessage | null>(null);
  const [reviewBody, setReviewBody] = useState("");

  const loadConversations = useCallback(
    async (preferredId?: string) => {
      const response = await authorizedRequest<{
        success: true;
        data: Conversation[];
      }>("/enquiry-agent/conversations");
      setConversations(response.data);
      setConversationId(
        (current) =>
          preferredId ?? current ?? response.data[0]?.conversationId ?? null,
      );
    },
    [authorizedRequest],
  );
  const loadHistory = useCallback(
    async (id: string) => {
      const response = await authorizedRequest<{
        success: true;
        data: History;
      }>(`/enquiry-agent/conversations/${id}`);
      setHistory(response.data);
      await authorizedRequest(`/enquiry-agent/conversations/${id}/read`, {
        method: "PUT",
      });
      setConversations((items) =>
        items.map((item) =>
          item.conversationId === id ? { ...item, unreadCount: 0 } : item,
        ),
      );
    },
    [authorizedRequest],
  );

  useEffect(() => {
    let active = true;
    const task = window.setTimeout(() => {
      void Promise.all([
        authorizedRequest<{ success: true; data: AgentStatus }>(
          "/enquiry-agent/status",
        ),
        loadConversations(),
      ])
        .then(([agent]) => {
          if (active) setStatus(agent.data);
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof ApiError
                ? reason.message
                : "Unable to load conversations.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(task);
    };
  }, [authorizedRequest, loadConversations]);
  useEffect(() => {
    if (!conversationId) return;
    const task = window.setTimeout(() => {
      setLoading(true);
      void loadHistory(conversationId)
        .catch((reason) =>
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Unable to load this conversation.",
          ),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(task);
  }, [conversationId, loadHistory]);

  const selected =
    conversations.find((item) => item.conversationId === conversationId) ??
    null;
  const visibleConversations = useMemo(
    () =>
      filter === "ALL"
        ? conversations
        : conversations.filter((item) => item.status === filter),
    [conversations, filter],
  );
  async function refresh(id = conversationId) {
    await loadConversations(id ?? undefined);
    if (id) await loadHistory(id);
  }

  async function send(retry = false) {
    if ((!message.trim() && !retry) || history.humanTakeover) return;
    const id = conversationId ?? crypto.randomUUID();
    const outbound =
      retry && lastRequest
        ? lastRequest
        : { externalMessageId: crypto.randomUUID(), message: message.trim() };
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedRequest<{ success: true; data: Result }>(
        "/enquiry-agent/messages",
        {
          method: "POST",
          body: JSON.stringify({
            channel: "WEBSITE_PLAYGROUND",
            externalMessageId: outbound.externalMessageId,
            conversationId: id,
            customerName: name.trim() || null,
            phone: phone.trim() || null,
            message: outbound.message,
            receivedAt: new Date().toISOString(),
            metadata: { playground: true },
          }),
        },
      );
      setLastRequest(outbound);
      setMessage("");
      setConversationId(id);
      setNotice(
        response.data.duplicate
          ? "Duplicate message safely ignored. No CRM records were repeated."
          : "Message processed and saved.",
      );
      await refresh(id);
      if (session)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.crm(session.organization.id),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.organization(session.organization.id),
          }),
        ]);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Processing failed safely. Retry is available.",
      );
    } finally {
      setSending(false);
    }
  }
  async function decide(
    item: HistoryMessage,
    decision: "APPROVE" | "REJECT",
    body = reviewBody,
  ) {
    if (!item.draftId) return;
    setSending(true);
    setError("");
    try {
      await authorizedRequest(
        `/enquiry-agent/drafts/${item.draftId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            ...(decision === "APPROVE" ? { editedBody: body.trim() } : {}),
            note:
              decision === "APPROVE"
                ? "Reviewed and approved in Agent Playground"
                : "Rejected in Agent Playground",
          }),
        },
      );
      setReview(null);
      setNotice(
        decision === "APPROVE"
          ? "Response approved. No external message was sent."
          : "Response rejected. No message was sent.",
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to record this decision.",
      );
    } finally {
      setSending(false);
    }
  }
  async function toggleTakeover() {
    if (!conversationId) return;
    const enabled = !history.humanTakeover;
    setSending(true);
    setError("");
    try {
      await authorizedRequest("/enquiry-agent/takeover", {
        method: "PUT",
        body: JSON.stringify({
          conversationId,
          enabled,
          reason: enabled
            ? "Human employee took control in Agent Playground"
            : "Human employee returned control to the agent",
        }),
      });
      setNotice(
        enabled
          ? "Human takeover is active. Automatic replies are blocked."
          : "Agent reply preparation resumed.",
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to change conversation control.",
      );
    } finally {
      setSending(false);
    }
  }
  function newConversation() {
    setConversationId(null);
    setHistory({ messages: [], humanTakeover: false });
    setName("");
    setPhone("");
    setMessage("");
    setLastRequest(null);
    setError("");
    setNotice("");
  }

  return (
    <section
      className="agent-playground enquiry-inbox"
      id="customer-enquiry-agent-playground"
    >
      <header>
        <div>
          <p>Customer enquiry workspace</p>
          <h3>Agent Playground</h3>
          <span>
            Test customer conversations safely using approved knowledge. Meta
            inbound and outbound remain disabled.
          </span>
        </div>
        <div>
          <span
            className={`agent-mode ${status?.mode === "REAL_AI" ? "ai" : "fallback"}`}
          >
            {status?.mode === "REAL_AI" ? "AI available" : "Fallback mode"}
          </span>
          <button onClick={newConversation}>+ New conversation</button>
        </div>
      </header>
      {error && (
        <div className="dashboard-notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="dashboard-notice success" role="status">
          {notice}
        </div>
      )}
      <div className="conversation-filters" aria-label="Conversation filters">
        {filters.map((item) => (
          <button
            key={item.key}
            className={filter === item.key ? "active" : ""}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            <span>
              {item.key === "ALL"
                ? conversations.length
                : conversations.filter(
                    (conversation) => conversation.status === item.key,
                  ).length}
            </span>
          </button>
        ))}
      </div>
      <div className="enquiry-inbox-grid">
        <aside
          className="conversation-list"
          aria-label="Customer conversations"
        >
          {loading && conversations.length === 0 ? (
            <div className="conversation-state">
              <span className="spinner dark" />
              Loading conversations…
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="conversation-state">
              <strong>No conversations here</strong>
              <span>Start a test conversation or choose another filter.</span>
            </div>
          ) : (
            visibleConversations.map((item) => (
              <button
                key={item.conversationId}
                className={
                  item.conversationId === conversationId ? "active" : ""
                }
                onClick={() => setConversationId(item.conversationId)}
              >
                <div>
                  <strong>{item.customerName}</strong>
                  <time>
                    {new Date(item.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{item.lastMessage}</p>
                <footer>
                  <span>{friendlyIntent(item.intent)}</span>
                  <i
                    className={`conversation-status ${item.status.toLowerCase()}`}
                  >
                    {friendlyStatus[item.status]}
                  </i>
                  {item.unreadCount > 0 && (
                    <b aria-label={`${item.unreadCount} unread messages`}>
                      {item.unreadCount}
                    </b>
                  )}
                </footer>
              </button>
            ))
          )}
        </aside>
        <main className="conversation-panel">
          <header>
            <div>
              <strong>
                {selected?.customerName ?? "New test conversation"}
              </strong>
              <span>
                {selected?.phone ??
                  "Internal playground · no external delivery"}
              </span>
            </div>
            {selected && (
              <div>
                {selected.customerId && (
                  <button
                    onClick={() =>
                      onNavigate?.({ view: "crm", id: selected.customerId! })
                    }
                  >
                    Open customer
                  </button>
                )}
                {selected.inquiryId && (
                  <button
                    onClick={() =>
                      onNavigate?.({
                        view: "inquiries",
                        id: selected.inquiryId!,
                      })
                    }
                  >
                    Open enquiry
                  </button>
                )}
                {selected.followUpId && selected.customerId && (
                  <button
                    onClick={() =>
                      onNavigate?.({
                        view: "crm",
                        id: selected.customerId!,
                        followUpId: selected.followUpId!,
                      })
                    }
                  >
                    Open follow-up
                  </button>
                )}
                <button
                  className={
                    history.humanTakeover ? "takeover active" : "takeover"
                  }
                  onClick={() => void toggleTakeover()}
                  disabled={sending}
                >
                  {history.humanTakeover ? "Resume agent" : "Take over"}
                </button>
              </div>
            )}
          </header>
          {history.humanTakeover && (
            <div className="takeover-banner">
              <strong>Human takeover active</strong>
              <span>
                Automatic replies are stopped until an authorized employee
                resumes the agent.
              </span>
            </div>
          )}
          <div className="conversation-thread" aria-live="polite">
            {loading && conversationId ? (
              <div className="conversation-state">
                <span className="spinner dark" />
                Loading messages…
              </div>
            ) : history.messages.length === 0 ? (
              <div className="conversation-empty">
                <span>✦</span>
                <h3>
                  {conversationId
                    ? "No saved messages"
                    : "Start a safe test conversation"}
                </h3>
                <p>
                  Use a sample below or write a customer message. CRM records
                  and conversation history persist after refresh.
                </p>
                <div>
                  {samples.map((sample) => (
                    <button key={sample} onClick={() => setMessage(sample)}>
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.messages.map((item) => {
                const source = item.provider?.source;
                const waiting = item.draftStatus === "PENDING_APPROVAL";
                const failed =
                  item.draftStatus === "FAILED" || Boolean(item.failureMessage);
                return (
                  <article className="conversation-exchange" key={item.eventId}>
                    <div className="message-row customer">
                      <div className="message-avatar">C</div>
                      <div className="message-bubble">
                        <header>
                          <strong>Customer message</strong>
                          <time>
                            {new Date(item.createdAt).toLocaleString()}
                          </time>
                        </header>
                        <p>{item.customerMessage}</p>
                      </div>
                    </div>
                    {item.response && (
                      <div
                        className={`message-row ${item.approvedBy ? "human" : source === "REAL_AI" ? "ai" : "fallback"}`}
                      >
                        <div className="message-avatar">
                          {item.approvedBy
                            ? "H"
                            : source === "REAL_AI"
                              ? "AI"
                              : "F"}
                        </div>
                        <div className="message-bubble">
                          <header>
                            <strong>
                              {item.approvedBy
                                ? `Human employee response · ${item.approvedBy}`
                                : source === "REAL_AI"
                                  ? "AI response"
                                  : "Fallback response"}
                            </strong>
                            <span
                              className={`message-status ${failed ? "failed" : history.humanTakeover ? "takeover" : waiting ? "waiting" : "ready"}`}
                            >
                              {failed
                                ? "Failed — retry available"
                                : history.humanTakeover
                                  ? "Human takeover active"
                                  : waiting
                                    ? "Waiting for approval"
                                    : source === "REAL_AI"
                                      ? "AI response"
                                      : "Fallback response"}
                            </span>
                          </header>
                          <p>{item.response}</p>
                          {item.knowledgeSources?.length ? (
                            <details className="knowledge-sources">
                              <summary>
                                Approved knowledge sources (
                                {item.knowledgeSources.length})
                              </summary>
                              {item.knowledgeSources.map((knowledge) => (
                                <article key={knowledge.id}>
                                  <strong>{knowledge.title}</strong>
                                  <span>
                                    {friendlyIntent(knowledge.category)}
                                    {knowledge.updatedAt
                                      ? ` · Updated ${new Date(knowledge.updatedAt).toLocaleDateString()}`
                                      : ""}
                                  </span>
                                </article>
                              ))}
                            </details>
                          ) : null}
                          {waiting &&
                            item.draftId &&
                            !history.humanTakeover && (
                              <div className="approval-actions">
                                <button
                                  onClick={() => {
                                    setReview(item);
                                    setReviewBody(item.response ?? "");
                                  }}
                                >
                                  Review
                                </button>
                                <button
                                  onClick={() => {
                                    setReview(item);
                                    setReviewBody(item.response ?? "");
                                  }}
                                >
                                  Edit response
                                </button>
                                <button
                                  className="approve"
                                  onClick={() =>
                                    void decide(
                                      item,
                                      "APPROVE",
                                      item.response ?? "",
                                    )
                                  }
                                  disabled={sending}
                                >
                                  Approve
                                </button>
                                <button
                                  className="reject"
                                  onClick={() => void decide(item, "REJECT")}
                                  disabled={sending}
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => void toggleTakeover()}
                                  disabled={sending}
                                >
                                  Take over
                                </button>
                              </div>
                            )}
                          <details className="processing-details">
                            <summary>Processing details</summary>
                            <dl>
                              <div>
                                <dt>Intent</dt>
                                <dd>{friendlyIntent(item.analysis?.intent)}</dd>
                              </div>
                              <div>
                                <dt>Confidence</dt>
                                <dd>
                                  {Math.round(
                                    (item.analysis?.confidence ?? 0) * 100,
                                  )}
                                  %
                                </dd>
                              </div>
                              <div>
                                <dt>Language</dt>
                                <dd>{item.analysis?.language ?? "Unknown"}</dd>
                              </div>
                              <div>
                                <dt>Response engine</dt>
                                <dd>
                                  {source === "REAL_AI"
                                    ? "Configured AI provider"
                                    : "Deterministic safety fallback"}
                                </dd>
                              </div>
                              {item.provider?.usage && (
                                <div>
                                  <dt>Usage</dt>
                                  <dd>
                                    {item.provider.usage.totalTokens} tokens
                                  </dd>
                                </div>
                              )}
                              {item.analysis?.promptInjectionDetected && (
                                <div>
                                  <dt>Safety</dt>
                                  <dd>
                                    Instruction-manipulation attempt blocked
                                  </dd>
                                </div>
                              )}
                              {item.failureMessage && (
                                <div>
                                  <dt>Failure</dt>
                                  <dd>{item.failureMessage}</dd>
                                </div>
                              )}
                            </dl>
                          </details>
                        </div>
                      </div>
                    )}
                    <div className="system-message">
                      CRM activity saved ·{" "}
                      {waiting
                        ? "Human review required"
                        : history.humanTakeover
                          ? "Automation paused"
                          : "No external message sent"}
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <footer className="chat-composer">
            <div className="test-contact">
              <input
                aria-label="Test customer name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Customer name (optional)"
              />
              <input
                aria-label="Test customer phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone, e.g. 919876543210"
              />
            </div>
            <textarea
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4096}
              placeholder={
                history.humanTakeover
                  ? "Automatic replies are paused during human takeover."
                  : "Type a customer message…"
              }
              disabled={history.humanTakeover}
            />
            <div>
              <small>No message leaves B² Brain.</small>
              {error && lastRequest && (
                <button
                  onClick={() => void send(true)}
                  disabled={sending || history.humanTakeover}
                >
                  Retry safely
                </button>
              )}
              <button
                className="send"
                onClick={() => void send()}
                disabled={sending || !message.trim() || history.humanTakeover}
              >
                {sending ? "Processing…" : "Send test message"}
              </button>
            </div>
          </footer>
        </main>
      </div>
      {review && (
        <div className="agent-modal">
          <div className="agent-dialog response-review">
            <header>
              <div>
                <p>Human review</p>
                <h3>Review customer response</h3>
              </div>
              <button onClick={() => setReview(null)} aria-label="Close">
                ×
              </button>
            </header>
            <p>
              Edit the response before approval. Approval does not send an
              external message.
            </p>
            <textarea
              rows={8}
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
              maxLength={4096}
            />
            <footer>
              <button onClick={() => setReview(null)}>Cancel</button>
              <button
                className="reject"
                onClick={() => void decide(review, "REJECT")}
                disabled={sending}
              >
                Reject
              </button>
              <button
                className="approve"
                onClick={() => void decide(review, "APPROVE")}
                disabled={sending || !reviewBody.trim()}
              >
                {sending ? "Saving…" : "Approve response"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
