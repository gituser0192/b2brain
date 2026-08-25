"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type RunStatus = "QUEUED" | "RUNNING" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELED";
interface RunItem {
  id: string;
  status: RunStatus;
  triggerType: string;
  summary: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  agent: { id: string; name: string; supportedService: string; status: string };
  initiatedBy: { id: string; firstName: string; lastName: string | null };
  approval: { id: string; status: string; decisionNote: string | null; decidedAt: string | null } | null;
  safety: { externalDeliveryPerformed: boolean; paymentStatusChanged: boolean; deliveryState: string | null };
  nextStep: string;
}
interface CentreResponse { success: true; data: { items: RunItem[]; metrics: { total: number; awaitingApproval: number; completed: number; failed: number; safeRuns: number } } }

export function AgentRunCentre() {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState<RunItem[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, awaitingApproval: 0, completed: 0, failed: 0, safeRuns: 0 });
  const [filter, setFilter] = useState<"ALL" | RunStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await authorizedRequest<CentreResponse>("/agents/runs/centre"); setItems(response.data.items); setMetrics(response.data.metrics); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load agent runs."); } finally { setLoading(false); } }, [authorizedRequest]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const visible = filter === "ALL" ? items : items.filter((item) => item.status === filter);
  return <section className="agent-run-centre">
    <header><div><p>Execution visibility</p><h3>Agent Run Centre</h3><span>See what each organization agent examined, prepared, and left for human control.</span></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh runs"}</button></header>
    {error && <div className="form-alert">{error}</div>}
    <div className="agent-run-metrics"><article><small>Total runs</small><strong>{metrics.total}</strong></article><article><small>Awaiting approval</small><strong>{metrics.awaitingApproval}</strong></article><article><small>Completed</small><strong>{metrics.completed}</strong></article><article><small>Failed</small><strong>{metrics.failed}</strong></article><article><small>Safe runs</small><strong>{metrics.safeRuns}/{metrics.total}</strong></article></div>
    <div className="agent-run-toolbar"><select value={filter} onChange={(event) => setFilter(event.target.value as "ALL" | RunStatus)}><option value="ALL">All runs</option><option value="AWAITING_APPROVAL">Awaiting approval</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option><option value="CANCELED">Canceled</option></select><span>{visible.length} shown</span></div>
    {loading ? <div className="agent-run-empty">Loading verified agent history…</div> : visible.length === 0 ? <div className="agent-run-empty"><strong>No agent runs found</strong><span>Runs will appear only after an authorized user starts an agent.</span></div> : <div className="agent-run-list">{visible.map((run) => <article key={run.id}><header><div><b>{run.agent.name}</b><span>{run.agent.supportedService} · {run.triggerType.replaceAll("_", " ")}</span></div><i className={`agent-run-status ${run.status.toLowerCase()}`}>{run.status.replaceAll("_", " ")}</i></header><p>{run.summary ?? run.errorMessage ?? "The run did not record a summary."}</p><div className="agent-run-safety"><span>External delivery: <strong>{run.safety.externalDeliveryPerformed ? "Yes" : "No"}</strong></span><span>Payment changed: <strong>{run.safety.paymentStatusChanged ? "Yes" : "No"}</strong></span>{run.safety.deliveryState && <span>Delivery state: <strong>{run.safety.deliveryState.replaceAll("_", " ")}</strong></span>}</div>{run.approval && <div className="agent-run-approval"><span>Approval</span><strong>{run.approval.status}</strong>{run.approval.decisionNote && <small>{run.approval.decisionNote}</small>}</div>}<footer><span>{run.nextStep}</span><small>{run.initiatedBy.firstName} {run.initiatedBy.lastName ?? ""} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.createdAt))}</small></footer></article>)}</div>}
  </section>;
}
