import type { HistoryMessage } from "./enquiry-agent-types";

const samples = [
  "Hello, what services do you provide?",
  "Mujhe apne business ke liye CRM chahiye, demo batao",
  "आपकी सेवा की कीमत क्या है?",
  "My dashboard is not working, please help",
  "I want a refund and payment reversal",
];
const friendly = (value?: string) => value
  ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
  : "Unclassified";

function ResponseMessage({ item, takeover, sending, onReview, onDecide, onTakeover }: {
  item: HistoryMessage; takeover: boolean; sending: boolean;
  onReview: (item: HistoryMessage) => void;
  onDecide: (item: HistoryMessage, decision: "APPROVE" | "REJECT", body?: string) => void;
  onTakeover: () => void;
}) {
  if (!item.response) return null;
  const source = item.provider?.source;
  const waiting = item.draftStatus === "PENDING_APPROVAL";
  const failed = item.draftStatus === "FAILED" || Boolean(item.failureMessage);
  return <div className={`message-row ${item.approvedBy ? "human" : source === "REAL_AI" ? "ai" : "fallback"}`}>
    <div className="message-avatar">{item.approvedBy ? "H" : source === "REAL_AI" ? "AI" : "F"}</div>
    <div className="message-bubble"><header><strong>{item.approvedBy ? `Human employee response · ${item.approvedBy}` : source === "REAL_AI" ? "AI response" : "Fallback response"}</strong><span className={`message-status ${failed ? "failed" : takeover ? "takeover" : waiting ? "waiting" : "ready"}`}>{failed ? "Failed — retry available" : takeover ? "Human takeover active" : waiting ? "Waiting for approval" : source === "REAL_AI" ? "AI response" : "Fallback response"}</span></header>
      <p>{item.response}</p>
      {item.knowledgeSources?.length ? <details className="knowledge-sources"><summary>Approved knowledge sources ({item.knowledgeSources.length})</summary>{item.knowledgeSources.map((sourceItem) => <article key={sourceItem.id}><strong>{sourceItem.title}</strong><span>{friendly(sourceItem.category)}{sourceItem.updatedAt ? ` · Updated ${new Date(sourceItem.updatedAt).toLocaleDateString()}` : ""}</span></article>)}</details> : null}
      {waiting && item.draftId && !takeover && <div className="approval-actions"><button onClick={() => onReview(item)}>Review</button><button onClick={() => onReview(item)}>Edit response</button><button className="approve" onClick={() => onDecide(item, "APPROVE", item.response ?? "")} disabled={sending}>Approve</button><button className="reject" onClick={() => onDecide(item, "REJECT")} disabled={sending}>Reject</button><button onClick={onTakeover} disabled={sending}>Take over</button></div>}
      <details className="processing-details"><summary>Processing details</summary><dl>
        <div><dt>Intent</dt><dd>{friendly(item.analysis?.intent)}</dd></div>
        <div><dt>Confidence</dt><dd>{Math.round((item.analysis?.confidence ?? 0) * 100)}%</dd></div>
        <div><dt>Language</dt><dd>{item.analysis?.language ?? "Unknown"}</dd></div>
        <div><dt>Response engine</dt><dd>{source === "REAL_AI" ? "Configured AI provider" : "Deterministic safety fallback"}</dd></div>
        {item.provider?.usage && <div><dt>Usage</dt><dd>{item.provider.usage.totalTokens} tokens</dd></div>}
        {item.analysis?.promptInjectionDetected && <div><dt>Safety</dt><dd>Instruction-manipulation attempt blocked</dd></div>}
        {item.failureMessage && <div><dt>Failure</dt><dd>{item.failureMessage}</dd></div>}
      </dl></details>
    </div>
  </div>;
}

export function EnquiryConversationThread({ messages, loading, conversationId, takeover, sending, onSample, onReview, onDecide, onTakeover }: {
  messages: HistoryMessage[]; loading: boolean; conversationId: string | null;
  takeover: boolean; sending: boolean; onSample: (sample: string) => void;
  onReview: (item: HistoryMessage) => void;
  onDecide: (item: HistoryMessage, decision: "APPROVE" | "REJECT", body?: string) => void;
  onTakeover: () => void;
}) {
  return <div className="conversation-thread" aria-live="polite">
    {loading && conversationId ? <div className="conversation-state"><span className="spinner dark" />Loading messages…</div> : !messages.length ? <div className="conversation-empty"><span>✦</span><h3>{conversationId ? "No saved messages" : "Start a safe test conversation"}</h3><p>Use a sample below or write a customer message. CRM records and conversation history persist after refresh.</p><div>{samples.map((sample) => <button key={sample} onClick={() => onSample(sample)}>{sample}</button>)}</div></div> : messages.map((item) => {
      const waiting = item.draftStatus === "PENDING_APPROVAL";
      return <article className="conversation-exchange" key={item.eventId}>
        <div className="message-row customer"><div className="message-avatar">C</div><div className="message-bubble"><header><strong>Customer message</strong><time>{new Date(item.createdAt).toLocaleString()}</time></header><p>{item.customerMessage}</p></div></div>
        <ResponseMessage item={item} takeover={takeover} sending={sending} onReview={onReview} onDecide={onDecide} onTakeover={onTakeover} />
        <div className="system-message">CRM activity saved · {waiting ? "Human review required" : takeover ? "Automation paused" : "No external message sent"}</div>
      </article>;
    })}
  </div>;
}
