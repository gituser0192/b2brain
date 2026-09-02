import type { Conversation } from "./enquiry-agent-types";

const friendlyStatus = {
  NEW: "New", WAITING_APPROVAL: "Waiting for approval",
  HUMAN_TAKEOVER: "Human takeover", RESOLVED: "Resolved", FAILED: "Failed",
} as const;
const friendlyIntent = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function ConversationList({ conversations, selectedId, loading, onSelect }: {
  conversations: Conversation[]; selectedId: string | null; loading: boolean;
  onSelect: (id: string) => void;
}) {
  return <aside className="conversation-list" aria-label="Customer conversations">
    {loading && !conversations.length ? <div className="conversation-state"><span className="spinner dark" />Loading conversations…</div> : !conversations.length ? <div className="conversation-state"><strong>No conversations here</strong><span>Start a test conversation or choose another filter.</span></div> : conversations.map((item) =>
      <button key={item.conversationId} className={item.conversationId === selectedId ? "active" : ""} onClick={() => onSelect(item.conversationId)}>
        <div><strong>{item.customerName}</strong><time>{new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
        <p>{item.lastMessage}</p><footer><span>{friendlyIntent(item.intent)}</span><i className={`conversation-status ${item.status.toLowerCase()}`}>{friendlyStatus[item.status]}</i>{item.unreadCount > 0 && <b aria-label={`${item.unreadCount} unread messages`}>{item.unreadCount}</b>}</footer>
      </button>)}</aside>;
}

type Navigate = (target: { view: "crm" | "inquiries"; id: string; followUpId?: string }) => void;
export function ConversationPanelHeader({ conversation, takeover, sending, onNavigate, onTakeover }: {
  conversation: Conversation | null; takeover: boolean; sending: boolean;
  onNavigate?: Navigate; onTakeover: () => void;
}) {
  return <><header><div><strong>{conversation?.customerName ?? "New test conversation"}</strong><span>{conversation?.phone ?? "Internal playground · no external delivery"}</span></div>{conversation && <div>
    {conversation.customerId && <button onClick={() => onNavigate?.({ view: "crm", id: conversation.customerId! })}>Open customer</button>}
    {conversation.inquiryId && <button onClick={() => onNavigate?.({ view: "inquiries", id: conversation.inquiryId! })}>Open enquiry</button>}
    {conversation.followUpId && conversation.customerId && <button onClick={() => onNavigate?.({ view: "crm", id: conversation.customerId!, followUpId: conversation.followUpId! })}>Open follow-up</button>}
    <button className={takeover ? "takeover active" : "takeover"} onClick={onTakeover} disabled={sending}>{takeover ? "Resume agent" : "Take over"}</button>
  </div>}</header>{takeover && <div className="takeover-banner"><strong>Human takeover active</strong><span>Automatic replies are stopped until an authorized employee resumes the agent.</span></div>}</>;
}

export function ChatComposer({ name, phone, message, sending, takeover, canRetry, onName, onPhone, onMessage, onSend, onRetry }: {
  name: string; phone: string; message: string; sending: boolean; takeover: boolean; canRetry: boolean;
  onName: (value: string) => void; onPhone: (value: string) => void; onMessage: (value: string) => void;
  onSend: () => void; onRetry: () => void;
}) {
  return <footer className="chat-composer"><div className="test-contact"><input aria-label="Test customer name" value={name} onChange={(event) => onName(event.target.value)} placeholder="Customer name (optional)" /><input aria-label="Test customer phone" value={phone} onChange={(event) => onPhone(event.target.value)} placeholder="Phone, e.g. 919876543210" /></div>
    <textarea rows={2} value={message} onChange={(event) => onMessage(event.target.value)} maxLength={4096} placeholder={takeover ? "Automatic replies are paused during human takeover." : "Type a customer message…"} disabled={takeover} />
    <div><small>No message leaves B² Brain.</small>{canRetry && <button onClick={onRetry} disabled={sending || takeover}>Retry safely</button>}<button className="send" onClick={onSend} disabled={sending || !message.trim() || takeover}>{sending ? "Processing…" : "Send test message"}</button></div>
  </footer>;
}
