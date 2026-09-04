import type { AgentItem, AgentSection } from "./workspace-agent-types";

const defaultPrompts = ["Check my business health", "Summarize revenue, expenses and profit", "Count all CRM customers", "What should I improve?", "How do I add a customer in CRM?"];
const cash = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

function AgentAnswer({ item, compact, onNavigate, onSection }: {
  item: AgentItem; compact: boolean; onNavigate?: (view: string) => void;
  onSection: (section: AgentSection) => void;
}) {
  const output = item.output;
  return <div className="workspace-agent-answer"><header><span>✦</span><strong>Ask B² Brain</strong></header><p>{output.answer}</p>
    {output.reasoning && <div className="forecast-card"><strong>{output.reasoning.source === "REAL_AI" ? "AI-assisted analysis" : "Verified-data fallback"}</strong><span>Confidence: {output.reasoning.confidence.toLowerCase()}</span>{output.reasoning.conclusions.length > 0 && <ul>{output.reasoning.conclusions.map((value) => <li key={value}>{value}</li>)}</ul>}{output.reasoning.recommendations.length > 0 && <ol>{output.reasoning.recommendations.map((value) => <li key={`${value.action}:${value.reason}`}><strong>{value.action}</strong> — {value.reason} ({value.expectedImpact})</li>)}</ol>}{output.reasoning.missingData.map((value) => <p className="agent-warning" key={value}>{value}</p>)}{(output.reasoning.requiresConfirmation || output.reasoning.proposedToolActions.length > 0) && <p className="agent-warning">Suggested actions require your confirmation; none were executed automatically.</p>}</div>}
    {output.metrics?.length ? <div className="workspace-metric-grid">{output.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div> : null}
    {output.health && <div className="health-card"><header><span>Business health</span><strong>{output.health.overall === null ? "Insufficient data" : `${output.health.overall}/100`}</strong></header>{output.health.components.map((component) => <article key={component.name}><div><strong>{component.name}</strong><span>{component.evidence}</span></div><b>{Math.round(component.score)}/100</b></article>)}{output.health.recommendations.length > 0 && <ol>{output.health.recommendations.map((value) => <li key={value}>{value}</li>)}</ol>}</div>}
    {output.finance && <div className="workspace-metric-grid"><article><span>Revenue</span><strong>{cash(output.finance.current.revenue, output.finance.currency)}</strong></article><article><span>Expenses</span><strong>{cash(output.finance.current.expenses, output.finance.currency)}</strong></article><article><span>Profit</span><strong>{cash(output.finance.current.profit, output.finance.currency)}</strong></article></div>}
    {output.forecast && <div className="forecast-card"><strong>Transparent forecast</strong><span>{output.forecast.method} · {output.forecast.dateRange} · {output.forecast.confidence.replaceAll("_", " ")}</span><p>Assumptions: {output.forecast.assumptions.join("; ")}</p></div>}
    {output.warnings?.map((warning) => <div className="agent-warning" key={warning}>{warning}</div>)}
    {output.records?.map((record) => <button className="agent-record-link" key={`${record.type}:${record.id}`} onClick={() => onNavigate?.("crm")}>Open {record.label} →</button>)}
    {output.escalation && <div className="agent-escalation"><strong>Escalated to B² Brain team</strong><span>{output.escalation.requestNumber} · {output.escalation.status.replaceAll("_", " ")}</span><button onClick={() => onNavigate?.("b2help")}>Track request</button></div>}
    {output.setup && <button className="agent-record-link" onClick={() => onNavigate?.("settings")}>Continue agent setup →</button>}
    {output.managementSection && !compact && <button className="agent-record-link" onClick={() => onSection(output.managementSection!)}>Open {output.managementSection === "brief" ? "Today’s Brief" : "Goals"} →</button>}
    <details><summary>Source and action details</summary><p>Authenticated organization context and assigned permissions were enforced by the backend. No organization ID was accepted from this message.</p>{output.reasoning?.evidence.map((source) => <p key={source.id}><strong>{source.label}:</strong> {source.value ?? "Unavailable"} · {source.period}</p>)}{output.reasoning?.assumptions.length ? <p>Assumptions: {output.reasoning.assumptions.join("; ")}</p> : null}</details>
  </div>;
}

export function WorkspaceAgentConversation({ items, loading, compact, prompts = defaultPrompts, onSend, onNavigate, onSection }: {
  items: AgentItem[]; loading: boolean; compact: boolean; onSend: (message: string) => void;
  prompts?: string[];
  onNavigate?: (view: string) => void; onSection: (section: AgentSection) => void;
}) {
  return <div className="workspace-agent-thread" aria-live="polite">{!items.length && !loading ? <div className="workspace-agent-welcome"><div>✦</div><h3>How can I help your business?</h3><p>I can analyse permitted data, explain B² Brain and perform explicit low-risk actions.</p><div>{prompts.map((prompt) => <button key={prompt} onClick={() => onSend(prompt)}>{prompt}</button>)}</div></div> : items.map((item) => <article key={item.id} className="workspace-agent-exchange"><div className="workspace-user-message"><strong>You</strong><p>{item.message}</p></div><AgentAnswer item={item} compact={compact} onNavigate={onNavigate} onSection={onSection} /></article>)}{loading && <div className="workspace-agent-thinking" role="status"><span className="spinner dark" />Ask B² Brain is checking permitted data…</div>}</div>;
}

export function WorkspaceAgentComposer({ message, loading, compact, onMessage, onSend }: {
  message: string; loading: boolean; compact: boolean; onMessage: (message: string) => void; onSend: () => void;
}) {
  return <footer className="workspace-agent-composer"><label htmlFor={compact ? "agent-drawer-message" : "agent-workspace-message"}>Message Ask B² Brain</label><textarea id={compact ? "agent-drawer-message" : "agent-workspace-message"} rows={compact ? 2 : 3} value={message} onChange={(event) => onMessage(event.target.value)} placeholder="Ask about your business or request a safe action…" maxLength={4096} /><button type="button" disabled={loading || !message.trim()} onClick={onSend}>{loading ? "Working…" : "Send"}</button></footer>;
}
