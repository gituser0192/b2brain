"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";

type Workflow = "leads" | "collections" | "follow-ups";
type Agent = { id: string; name: string; status: "DRAFT" | "ACTIVE" | "PAUSED"; supportedService: "CRM" | "LEADS" | "FINANCE"; requiresApproval: boolean; _count: { runs: number } };
type FollowUpData = { sequences: { id: string; isActive: boolean; _count: { enrollments: number } }[]; metrics: { activeSequences: number; activeEnrollments: number; due: number; awaitingApproval: number } };
type Run = { id: string; status: string; createdAt: string; agent: { name: string } };
type Data = { agents: Agent[]; followUps: FollowUpData; runs: Run[] };

const empty: Data = { agents: [], followUps: { sequences: [], metrics: { activeSequences: 0, activeEnrollments: 0, due: 0, awaitingApproval: 0 } }, runs: [] };
const copy = {
  leads: { title: "Lead handling", description: "Review and qualify new inquiries with controlled agent assistance.", service: "Leads & inquiries" },
  collections: { title: "Invoice collection", description: "Inspect overdue invoices and prepare approval-controlled reminders.", service: "Finance" },
  "follow-ups": { title: "Customer follow-ups", description: "Keep inquiry and customer follow-up sequences moving on schedule.", service: "CRM" },
} as const;

function agentState(agents: Agent[]) {
  if (!agents.length) return "Not configured";
  if (agents.some((agent) => agent.status === "ACTIVE")) return "Configured";
  if (agents.some((agent) => agent.status === "PAUSED")) return "Paused";
  return "Draft";
}

export function AutomationOutcomes({ workflow, advanced, collections, followUps }: Readonly<{ workflow: Workflow | null; advanced: { agents: ReactNode; knowledge: ReactNode; policies: ReactNode }; collections: ReactNode; followUps: ReactNode }>) {
  const { authorizedRequest, session } = useAuth();
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const canManage = session?.membership.permissions.includes("AUTOMATION_MANAGE") ?? false;
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      authorizedRequest<{ success: true; data: Agent[] }>("/agents"),
      authorizedRequest<{ success: true; data: FollowUpData }>("/follow-up-automation"),
      authorizedRequest<{ success: true; data: { items: Run[] } }>("/agents/runs/centre"),
    ]);
    setData({
      agents: results[0].status === "fulfilled" ? results[0].value.data : [],
      followUps: results[1].status === "fulfilled" ? results[1].value.data : empty.followUps,
      runs: results[2].status === "fulfilled" ? results[2].value.data.items : [],
    });
    if (results.every((result) => result.status === "rejected")) setError("Automation information is unavailable right now.");
    else if (results.some((result) => result.status === "rejected")) setError("Some automation information is temporarily unavailable.");
    else setError("");
    setLoading(false);
  }, [authorizedRequest]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const leadAgents = data.agents.filter((agent) => agent.supportedService === "LEADS");
  const collectionAgents = data.agents.filter((agent) => agent.supportedService === "FINANCE");
  const states: Record<Workflow, string> = {
    leads: agentState(leadAgents),
    collections: agentState(collectionAgents),
    "follow-ups": data.followUps.metrics.activeSequences > 0 ? "Active" : data.followUps.sequences.length ? "Paused" : "Not configured",
  };
  const lastRun = data.runs[0];

  if (loading) return <div className="automation-outcomes-state" role="status"><span className="spinner dark" />Loading automations…</div>;
  if (workflow) {
    const relevantAgents = workflow === "leads" ? leadAgents : workflow === "collections" ? collectionAgents : [];
    return <div className="automation-workflow-detail">
      <Link className="automation-back-link" href="/automation?section=automations">← All automations</Link>
      <header><div><p>{copy[workflow].service}</p><h3>{copy[workflow].title}</h3><span>{copy[workflow].description}</span></div><i data-state={states[workflow].toLowerCase().replaceAll(" ", "-")}>{states[workflow]}</i></header>
      {error && <div className="dashboard-notice error" role="alert">{error}</div>}
      <section className="automation-workflow-facts" aria-label={`${copy[workflow].title} status`}>
        <article><span>Configuration</span><strong>{states[workflow]}</strong></article>
        <article><span>Trigger</span><strong>{workflow === "leads" ? "New inbound inquiry" : workflow === "collections" ? "Configured daily schedule" : "Enrolled customer or inquiry"}</strong></article>
        <article><span>Stops when</span><strong>{workflow === "leads" ? "Human review is required" : workflow === "collections" ? "No eligible overdue invoice remains" : "The sequence stop rules are met"}</strong></article>
        <article><span>Approval</span><strong>{workflow === "follow-ups" ? `${data.followUps.metrics.awaitingApproval} waiting` : relevantAgents.some((agent) => agent.requiresApproval) ? "Required" : relevantAgents.length ? "Not required" : "Not configured"}</strong></article>
        <article><span>Last verified result</span><strong>{lastRun ? lastRun.status.replaceAll("_", " ") : "No runs recorded"}</strong></article>
      </section>
      {workflow === "leads" && <section className="automation-workflow-primary"><h4>Lead handling setup</h4><p>{leadAgents.length ? `${leadAgents.length} lead agent definition${leadAgents.length === 1 ? " is" : "s are"} configured. A definition does not mean work is currently running.` : "No lead-handling agent is configured yet."}</p>{canManage && <button type="button" onClick={() => setAdvancedOpen(true)}>Configure lead handling</button>}</section>}
      {workflow === "collections" && (canManage ? collections : <p className="automation-read-only">You can review this workflow, but managing its collection schedule requires Automation management permission.</p>)}
      {workflow === "follow-ups" && (canManage ? followUps : <p className="automation-read-only">You can review this workflow, but managing sequences requires Automation management permission.</p>)}
      {canManage && workflow !== "follow-ups" && <details className="automation-advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}><summary>Advanced controls</summary>{advancedOpen && advanced.agents}</details>}
    </div>;
  }

  const cards: Workflow[] = ["leads", "collections", "follow-ups"];
  return <div className="automation-outcomes">
    <header><div><p>Business workflows</p><h3>Automations</h3><span>Choose an outcome to review its verified setup, controls, and recent result.</span></div></header>
    {error && <div className="dashboard-notice error" role="alert">{error}</div>}
    <div className="automation-outcome-grid">{cards.map((item) => <article key={item}><div><span>{copy[item].service}</span><i data-state={states[item].toLowerCase().replaceAll(" ", "-")}>{states[item]}</i></div><h4>{copy[item].title}</h4><p>{copy[item].description}</p><dl><div><dt>Approval</dt><dd>{item === "follow-ups" ? `${data.followUps.metrics.awaitingApproval} waiting` : "Controlled by configuration"}</dd></div><div><dt>Last result</dt><dd>{lastRun ? lastRun.status.replaceAll("_", " ") : "No runs recorded"}</dd></div></dl><Link href={`/automation?section=automations&workflow=${item}`}>Open workflow</Link></article>)}</div>
    {canManage && <details className="automation-advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}><summary>Advanced automation controls</summary>{advancedOpen && <div className="automation-advanced-content">{advanced.policies}{advanced.agents}<p className="automation-knowledge-note"><strong>Business Knowledge supports Business Agent responses.</strong> It is reference information, not an automation.</p>{advanced.knowledge}</div>}</details>}
    {!canManage && <p className="automation-read-only">You can review automation status. Management controls require Automation Manage permission.</p>}
  </div>;
}
