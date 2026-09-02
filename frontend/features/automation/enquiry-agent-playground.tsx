"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { queryKeys } from "@/services/query-keys";
import { EnquiryPlaygroundHeader } from "./enquiry-playground-header";
import { ResponseReviewDialog } from "./response-review-dialog";
import { ChatComposer, ConversationList, ConversationPanelHeader } from "./enquiry-conversation-controls";
import { EnquiryConversationThread } from "./enquiry-conversation-thread";
import type { AgentStatus, Conversation, ConversationStatus, History, HistoryMessage, Result } from "./enquiry-agent-types";

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
      <EnquiryPlaygroundHeader status={status} conversations={conversations} filter={filter} onFilter={setFilter} onNew={newConversation} />
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
      <div className="enquiry-inbox-grid">
        <ConversationList conversations={visibleConversations} selectedId={conversationId} loading={loading && conversations.length === 0} onSelect={setConversationId} />
        <main className="conversation-panel">
          <ConversationPanelHeader conversation={selected} takeover={history.humanTakeover} sending={sending} onNavigate={onNavigate} onTakeover={() => void toggleTakeover()} />
          <EnquiryConversationThread messages={history.messages} loading={loading} conversationId={conversationId} takeover={history.humanTakeover} sending={sending} onSample={setMessage} onReview={(item) => { setReview(item); setReviewBody(item.response ?? ""); }} onDecide={(item, decision, body) => void decide(item, decision, body)} onTakeover={() => void toggleTakeover()} />
          <ChatComposer name={name} phone={phone} message={message} sending={sending} takeover={history.humanTakeover} canRetry={Boolean(error && lastRequest)} onName={setName} onPhone={setPhone} onMessage={setMessage} onSend={() => void send()} onRetry={() => void send(true)} />
        </main>
      </div>
      {review && <ResponseReviewDialog body={reviewBody} saving={sending} onBody={setReviewBody} onClose={() => setReview(null)} onDecide={(decision) => void decide(review, decision)} />}
    </section>
  );
}
