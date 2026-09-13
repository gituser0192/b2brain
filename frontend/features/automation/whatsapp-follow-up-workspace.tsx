"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Summary = { conversationId: string; displayName: string; maskedContact: string; channel: "WHATSAPP"; classification: string; status: string; latestMessagePreview: string; lastActivityAt: string; pendingApprovalCount: number; needsAttention: boolean };
type Detail = { conversation: Summary & { subject: string; customerId: string | null; humanReviewRequested: boolean }; messages: { id: string; direction: "INBOUND" | "OUTBOUND"; body: string; status: string; occurredAt: string; failureMessage?: string | null }[]; connectors: { id: string; name: string; provider: string }[]; pagination: { hasMore: boolean } };
const templates = ["WELCOME", "FOLLOW_UP", "QUOTATION", "PAYMENT_REMINDER", "HUMAN_HANDOFF"] as const;
const friendly = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase());

export function WhatsappFollowUpWorkspace({ conversationId }: { conversationId: string | null }) {
  const { session, authorizedRequest } = useAuth(), router = useRouter();
  const canManage = session?.membership.permissions.includes("AUTOMATION_MANAGE") ?? false;
  const canViewCrm = session?.membership.permissions.includes("CRM_VIEW") ?? false;
  const [items, setItems] = useState<Summary[]>([]), [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [sending, setSending] = useState(false);
  const [error, setError] = useState(""), [detailError, setDetailError] = useState(""), [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [template, setTemplate] = useState<typeof templates[number]>("FOLLOW_UP"), [message, setMessage] = useState("");
  const cache = useRef(new Map<string, Detail>()), heading = useRef<HTMLHeadingElement>(null);
  const listRequested = useRef(false), detailRequested = useRef<string | null>(null);
  const itemButtons = useRef(new Map<string, HTMLButtonElement>()), returnFocus = useRef(false);
  const loadList = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await authorizedRequest<{ success: true; data: { conversations: Summary[] } }>("/automation-bridge/whatsapp-conversations?limit=25&page=1"); setItems(response.data.conversations); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Unable to load customer conversations."); }
    finally { setLoading(false); }
  }, [authorizedRequest]);
  useEffect(() => {
    if (listRequested.current) return;
    listRequested.current = true;
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (!conversationId) {
      if (returnFocus.current) { returnFocus.current = false; window.setTimeout(() => itemButtons.current.get(detail?.conversation.conversationId ?? "")?.focus(), 0); }
      return;
    }
    const cached = cache.current.get(conversationId); if (cached) { setDetail(cached); return; }
    if (detailRequested.current === conversationId) return;
    detailRequested.current = conversationId;
    setDetailLoading(true); setDetailError("");
    void authorizedRequest<{ success: true; data: Detail }>(`/automation-bridge/whatsapp-conversations/${conversationId}`)
      .then(response => { cache.current.set(conversationId, response.data); setDetail(response.data); window.setTimeout(() => heading.current?.focus(), 0); })
      .catch(cause => { setDetail(null); setDetailError(cause instanceof ApiError && cause.status === 404 ? "This conversation is unavailable." : "Unable to load this conversation."); })
      .finally(() => setDetailLoading(false));
  }, [authorizedRequest, conversationId, detail?.conversation.conversationId]);
  const visible = useMemo(() => items.filter(item => {
    if (search.trim() && !`${item.displayName} ${item.maskedContact} ${item.latestMessagePreview}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === "approval") return item.pendingApprovalCount > 0;
    if (filter === "attention") return item.needsAttention;
    if (filter === "sales") return ["SALES", "SALES_OPPORTUNITY", "PURCHASE_INTENT"].includes(item.classification);
    if (filter === "support") return ["SUPPORT", "SUPPORT_REQUEST", "COMPLAINT"].includes(item.classification);
    return filter !== "unclassified" || item.classification === "UNCLASSIFIED";
  }), [filter, items, search]);
  const back = () => { returnFocus.current = true; router.push("/automation?section=approvals&view=conversations"); };
  async function createDraft() {
    if (!detail || !message.trim() || !detail.connectors[0] || sending) return;
    setSending(true); setError(""); setNotice("");
    try { await authorizedRequest("/automation-bridge/whatsapp-template-drafts", { method: "POST", body: JSON.stringify({ connectorId: detail.connectors[0].id, inquiryId: detail.conversation.conversationId, template, customMessage: message.trim() }) }); setMessage(""); setNotice("Test approval draft created. External delivery remains disabled."); cache.current.delete(detail.conversation.conversationId); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Unable to create the approval draft."); }
    finally { setSending(false); }
  }
  async function escalate() {
    if (!detail || sending) return; const reason = window.prompt("Why does this conversation need a person?")?.trim(); if (!reason) return;
    setSending(true); setError("");
    try { await authorizedRequest("/automation-bridge/whatsapp-escalations", { method: "POST", body: JSON.stringify({ inquiryId: detail.conversation.conversationId, reason }) }); setNotice("A person responsible for this inquiry has been notified."); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Unable to request human review."); }
    finally { setSending(false); }
  }
  return <section className={`whatsapp-inbox ${conversationId ? "show-detail" : "show-list"}`}>
    <header><div><p>Approval-first messaging</p><h3>Customer conversations</h3><span>Review WhatsApp Simulator and Test Mode conversations without enabling external delivery.</span></div><b>External delivery disabled</b></header>
    {error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="dashboard-notice success" role="status">{notice}</div>}
    {!canManage && <div className="dashboard-notice" role="status">Read-only access. You can inspect conversations but cannot create drafts, approve, send, or escalate.</div>}
    <div className="whatsapp-inbox-layout">
      <aside className="whatsapp-conversation-list" aria-label="Customer conversations">
        <label><span>Search conversations</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or message" /></label>
        <div className="whatsapp-inbox-filters" role="group" aria-label="Conversation filters">{[["all","All"],["approval","Needs approval"],["attention","Needs attention"],["sales","Sales"],["support","Support"],["unclassified","Unclassified"]].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        {loading ? <div className="whatsapp-inbox-state" role="status">Loading conversations…</div> : error ? null : visible.length === 0 ? <div className="whatsapp-inbox-state"><strong>{items.length ? "No matching conversations" : "No conversations yet"}</strong><span>{items.length ? "Try another filter or search." : "WhatsApp conversations appear after a verified inquiry is received."}</span></div> : visible.map(item => <button ref={node => { if (node) itemButtons.current.set(item.conversationId, node); else itemButtons.current.delete(item.conversationId); }} key={item.conversationId} className={item.conversationId === conversationId ? "active" : ""} aria-current={item.conversationId === conversationId ? "true" : undefined} onClick={() => router.push(`/automation?section=approvals&view=conversations&conversation=${encodeURIComponent(item.conversationId)}`)}><div><strong>{item.displayName}</strong><time>{new Date(item.lastActivityAt).toLocaleString()}</time></div><p>{item.latestMessagePreview}</p><footer><span>{item.maskedContact} · {friendly(item.classification)}</span>{item.pendingApprovalCount > 0 && <b>Reply awaiting approval</b>}{item.needsAttention && <i>Needs attention</i>}</footer></button>)}
      </aside>
      <main className="whatsapp-conversation-detail">
        {conversationId && <button className="whatsapp-back" onClick={back}>← Back to conversations</button>}
        {conversationId && detailLoading ? <div className="whatsapp-inbox-state" role="status">Loading conversation…</div> : conversationId && detailError ? <div className="whatsapp-inbox-state" role="alert"><strong>Conversation unavailable</strong><span>{detailError}</span><button onClick={back}>Back to conversations</button></div> : !conversationId || !detail ? <div className="whatsapp-inbox-state"><strong>Select a conversation</strong><span>Choose a customer conversation to inspect its verified message history.</span></div> : <>
          <header><div><h4 tabIndex={-1} ref={heading}>{detail.conversation.displayName}</h4><span>{detail.conversation.maskedContact} · WhatsApp Test Mode / Simulator</span><small>{detail.conversation.subject} · {friendly(detail.conversation.status)}</small></div><div>{canViewCrm && detail.conversation.customerId && <Link href={`/crm/customers/${detail.conversation.customerId}`}>Open customer</Link>}<Link href={`/dashboard?view=inquiries&id=${detail.conversation.conversationId}`}>Open inquiry</Link>{canManage && <button onClick={() => void escalate()} disabled={sending}>Escalate to person</button>}</div></header>
          {detail.conversation.humanReviewRequested && <div className="dashboard-notice">Human review requested.</div>}
          <div className="whatsapp-inbox-messages" aria-label="Conversation messages">{detail.messages.map(item => <article key={`${item.direction}-${item.id}`} className={item.direction.toLowerCase()}><strong>{item.direction === "INBOUND" ? "Customer" : "Draft response"}</strong><p>{item.body}</p><small>{friendly(item.status)} · {new Date(item.occurredAt).toLocaleString()}</small>{item.failureMessage && <span>{item.failureMessage}</span>}</article>)}</div>
          {detail.pagination.hasMore && <p className="whatsapp-history-limit">Showing the latest bounded conversation history.</p>}
          {canManage && <div className="whatsapp-inbox-composer"><strong>Create test approval draft</strong><p>This creates a review draft only. It does not send a real WhatsApp message.</p><select aria-label="Reply template" value={template} onChange={event => setTemplate(event.target.value as typeof template)}>{templates.map(item => <option key={item} value={item}>{friendly(item)}</option>)}</select><textarea aria-label="Draft reply" rows={3} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a reply for human approval" /><button disabled={sending || !message.trim() || detail.connectors.length === 0} onClick={() => void createDraft()}>{sending ? "Creating…" : "Create test approval draft"}</button>{detail.connectors.length === 0 && <small>No active WhatsApp Test Mode or Simulator connector is available.</small>}</div>}
        </>}
      </main>
    </div>
  </section>;
}
