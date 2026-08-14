"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

interface Inquiry { id: string; contactName: string; phone: string | null; subject: string; status: string; assignedEmployee: { firstName: string; lastName: string | null } | null }
interface Message { id: string; direction: "INBOUND" | "OUTBOUND"; body: string; status: string; occurredAt: string }
interface Conversation { recipient: string; inquiry: Inquiry | null; messages: Message[]; lastMessageAt: string | null }
interface Payload { success: true; data: { connectors: { id: string; name: string; status: string; credentialsConfiguredAt: string | null }[]; inquiries: Inquiry[]; conversations: Conversation[] } }

const templates = ["WELCOME", "FOLLOW_UP", "QUOTATION", "PAYMENT_REMINDER", "HUMAN_HANDOFF"] as const;

export function WhatsappFollowUpWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const canManage = session?.membership.permissions.includes("AUTOMATION_MANAGE") ?? false;
  const [data, setData] = useState<Payload["data"]>({ connectors: [], inquiries: [], conversations: [] });
  const [selected, setSelected] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [template, setTemplate] = useState<typeof templates[number]>("WELCOME");
  const [customMessage, setCustomMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Payload>("/automation-bridge/whatsapp-workspace");
      setData(response.data);
      setConnectorId(current => current || response.data.connectors.find(item => item.status === "ACTIVE")?.id || "");
      setSelected(current => current || response.data.conversations[0]?.recipient || response.data.inquiries[0]?.phone?.replace(/^\+/, "") || "");
      setError("");
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load WhatsApp workspace."); }
  }, [authorizedRequest]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const conversation = data.conversations.find(item => item.recipient === selected) ?? null;
  const inquiry = conversation?.inquiry ?? data.inquiries.find(item => item.phone?.replace(/^\+/, "") === selected) ?? null;
  const contacts = useMemo(() => {
    const values = new Map<string, { recipient: string; inquiry: Inquiry | null; lastMessageAt: string | null }>();
    for (const item of data.inquiries) if (item.phone) values.set(item.phone.replace(/^\+/, ""), { recipient: item.phone.replace(/^\+/, ""), inquiry: item, lastMessageAt: null });
    for (const item of data.conversations) values.set(item.recipient, { recipient: item.recipient, inquiry: item.inquiry, lastMessageAt: item.lastMessageAt });
    return [...values.values()].sort((a,b) => (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0) - (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0));
  }, [data]);
  async function createDraft() {
    if (!inquiry || !connectorId) return;
    try {
      await authorizedRequest("/automation-bridge/whatsapp-template-drafts", { method: "POST", body: JSON.stringify({ connectorId, inquiryId: inquiry.id, template, customMessage: customMessage || null }) });
      setCustomMessage(""); setNotice("Draft created. Review and approve it before sending."); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to create draft."); }
  }
  async function approve(id: string) {
    if (!confirm("Approve and send this WhatsApp message now?")) return;
    try { await authorizedRequest(`/automation-bridge/message-drafts/${id}/approve-send`, { method: "POST" }); setNotice("WhatsApp message sent."); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "WhatsApp send failed."); }
  }
  async function escalate() {
    if (!inquiry) return;
    const reason = prompt("Why does this conversation need a human?")?.trim(); if (!reason) return;
    try { await authorizedRequest("/automation-bridge/whatsapp-escalations", { method: "POST", body: JSON.stringify({ inquiryId: inquiry.id, reason }) }); setNotice("The assigned employee or owner has been notified."); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Unable to escalate conversation."); }
  }
  return <section className="whatsapp-workspace">
    <header><div><p>Approval-first messaging</p><h3>WhatsApp follow-up workspace</h3><span>Prepare replies from real inquiry context, review every message, and hand difficult conversations to a person.</span></div><b>{data.connectors.filter(item => item.credentialsConfiguredAt).length} connected</b></header>
    {error && <div className="form-alert">{error}</div>}{notice && <div className="dashboard-notice success">{notice}</div>}
    {data.connectors.length === 0 ? <div className="whatsapp-empty"><strong>No WhatsApp connector</strong><span>Create and configure an official WhatsApp connector before using this workspace.</span></div> : contacts.length === 0 ? <div className="whatsapp-empty"><strong>No WhatsApp contacts yet</strong><span>Contacts appear after an inquiry with a phone number or a verified inbound WhatsApp message.</span></div> : <div className="whatsapp-layout">
      <aside>{contacts.map(item => <button key={item.recipient} className={selected === item.recipient ? "active" : ""} onClick={() => setSelected(item.recipient)}><strong>{item.inquiry?.contactName ?? item.recipient}</strong><span>{item.inquiry?.subject ?? "WhatsApp conversation"}</span><small>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : item.recipient}</small></button>)}</aside>
      <div className="whatsapp-thread">
        <header><div><strong>{inquiry?.contactName ?? selected}</strong><span>{inquiry?.subject ?? selected}</span></div>{canManage && inquiry && <button onClick={() => void escalate()}>Escalate to human</button>}</header>
        <div className="whatsapp-messages">{conversation?.messages.length ? conversation.messages.map(message => <article key={`${message.direction}:${message.id}`} className={message.direction.toLowerCase()}><p>{message.body}</p><small>{message.direction} · {message.status.replaceAll("_", " ")} · {new Date(message.occurredAt).toLocaleString()}</small>{canManage && message.direction === "OUTBOUND" && message.status === "PENDING_APPROVAL" && <button onClick={() => void approve(message.id)}>Approve & send</button>}</article>) : <div className="whatsapp-empty"><span>No messages recorded for this contact.</span></div>}</div>
        {canManage && inquiry && <div className="whatsapp-composer"><div><select value={connectorId} onChange={event => setConnectorId(event.target.value)}>{data.connectors.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={template} onChange={event => setTemplate(event.target.value as typeof template)}>{templates.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></div><textarea rows={3} placeholder="Optional: replace the standard template with your own approved message" value={customMessage} onChange={event => setCustomMessage(event.target.value)} /><button disabled={!connectorId} onClick={() => void createDraft()}>Create approval draft</button></div>}
      </div>
    </div>}
  </section>;
}
