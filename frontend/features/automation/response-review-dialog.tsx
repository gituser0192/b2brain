export function ResponseReviewDialog({ body, saving, onBody, onClose, onDecide }: {
  body: string; saving: boolean; onBody: (body: string) => void;
  onClose: () => void; onDecide: (decision: "APPROVE" | "REJECT") => void;
}) {
  return <div className="agent-modal"><div className="agent-dialog response-review">
    <header><div><p>Human review</p><h3>Review customer response</h3></div><button onClick={onClose} aria-label="Close">×</button></header>
    <p>Edit the response before approval. Approval does not send an external message.</p>
    <textarea rows={8} value={body} onChange={(event) => onBody(event.target.value)} maxLength={4096} />
    <footer><button onClick={onClose}>Cancel</button><button className="reject" onClick={() => onDecide("REJECT")} disabled={saving}>Reject</button><button className="approve" onClick={() => onDecide("APPROVE")} disabled={saving || !body.trim()}>{saving ? "Saving…" : "Approve response"}</button></footer>
  </div></div>;
}
