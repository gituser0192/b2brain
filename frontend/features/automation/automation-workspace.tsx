"use client";
import { AgentManager } from "./agent-manager";
import { BridgeManager } from "./bridge-manager";
import { FollowUpAutomationManager } from "./follow-up-automation-manager";

const foundations = [
  {
    code: "notifications",
    eyebrow: "Workspace layer",
    title: "Notifications",
    description: "A central place for due follow-ups, agent escalations, failures, and approval requests.",
    capabilities: ["In-app inbox", "Due and overdue reminders", "Read and dismissed states"],
  },
  {
    code: "agents",
    eyebrow: "Intelligence layer",
    title: "AI agents",
    description: "Organization-owned agents with an approved purpose, permissions, instructions, and human oversight.",
    capabilities: ["Agent identity and scope", "Human approval controls", "Run history and audit trail"],
  },
  {
    code: "automations",
    eyebrow: "Workflow layer",
    title: "Automations",
    description: "Event-based workflows that connect business records to reminders, agents, and approved actions.",
    capabilities: ["Trigger and action rules", "Schedules and limits", "Pause and failure controls"],
  },
  {
    code: "integrations",
    eyebrow: "Connection layer",
    title: "Integrations",
    description: "Secure provider connections for calling, email, WhatsApp, calendars, transcription, and AI models.",
    capabilities: ["Encrypted credentials", "Connection health", "Provider-independent adapters"],
  },
] as const;

export function AutomationWorkspace() {
  return (
    <section className="automation-workspace">
      <header className="automation-header">
        <div>
          <p>Automation foundation</p>
          <h2>Build intelligence on a controlled frame.</h2>
          <span>The structure is ready for future providers. No agent can contact a customer yet.</span>
        </div>
        <span className="automation-stage">Foundation stage</span>
      </header>

      <div className="automation-guardrails">
        <span>✓ Organization isolated</span>
        <span>✓ Permission controlled</span>
        <span>✓ Human approval ready</span>
        <span>✓ No provider connected</span>
      </div>

      <div className="automation-foundations">
        {foundations.map((foundation, index) => (
          <article key={foundation.code}>
            <div className="foundation-number">0{index + 1}</div>
            <p>{foundation.eyebrow}</p>
            <h3>{foundation.title}</h3>
            <span>{foundation.description}</span>
            <ul>{foundation.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
            <button type="button" disabled>Not configured</button>
          </article>
        ))}
      </div>

      <AgentManager />
      <FollowUpAutomationManager />
      <BridgeManager />

      <div className="automation-empty-state">
        <div><span>◇</span></div>
        <section>
          <p>Clean automation workspace</p>
          <h3>No workflows or provider connections have been created.</h3>
          <span>These records will only appear after an authorized administrator creates them. Nothing is seeded or simulated.</span>
        </section>
      </div>
    </section>
  );
}
