import type { AgentStatus, Conversation, ConversationStatus } from "./enquiry-agent-types";

const filters: { key: "ALL" | ConversationStatus; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "NEW", label: "New" },
  { key: "WAITING_APPROVAL", label: "Waiting for approval" },
  { key: "HUMAN_TAKEOVER", label: "Human takeover" },
  { key: "RESOLVED", label: "Resolved" }, { key: "FAILED", label: "Failed" },
];

export function EnquiryPlaygroundHeader({ status, conversations, filter, onFilter, onNew }: {
  status: AgentStatus | null; conversations: Conversation[];
  filter: "ALL" | ConversationStatus; onFilter: (filter: "ALL" | ConversationStatus) => void;
  onNew: () => void;
}) {
  return <>
    <header><div><p>Customer enquiry workspace</p><h3>Agent Playground</h3><span>Test customer conversations safely using approved knowledge. Meta inbound and outbound remain disabled.</span></div><div><span className={`agent-mode ${status?.mode === "REAL_AI" ? "ai" : "fallback"}`}>{status?.mode === "REAL_AI" ? "AI available" : "Fallback mode"}</span><button onClick={onNew}>+ New conversation</button></div></header>
    <div className="conversation-filters" aria-label="Conversation filters">{filters.map((item) => <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => onFilter(item.key)}>{item.label}<span>{item.key === "ALL" ? conversations.length : conversations.filter((conversation) => conversation.status === item.key).length}</span></button>)}</div>
  </>;
}
