import type { AgentSection } from "./workspace-agent-types";

export function WorkspaceAgentHeader({ section, onSection }: { section: AgentSection; onSection: (section: AgentSection) => void }) {
  return <><header><div><p>B² Brain Agent</p><h2>Ask B² Brain</h2><span>Your organization-scoped Business Operating Agent.</span></div><div className="agent-trust"><span>✓ Permission aware</span><span>✓ Organization isolated</span><span>✓ Real business data</span></div></header>
    <nav className="workspace-agent-sections" aria-label="Ask B² Brain sections">
      <button className={section === "brief" ? "active" : ""} onClick={() => onSection("brief")}>Today&apos;s Brief</button>
      <button className={section === "goals" ? "active" : ""} onClick={() => onSection("goals")}>Goals</button>
      <button className={section === "conversation" ? "active" : ""} onClick={() => onSection("conversation")}>Conversation</button>
    </nav></>;
}
