"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

interface Actor { id: string; firstName: string; lastName: string | null; }
interface Activity { id: string; type: "CALL" | "EMAIL" | "MEETING" | "NOTE" | "WHATSAPP"; summary: string; details: string | null; occurredAt: string; createdBy: Actor; }
interface FollowUp { id: string; title: string; description: string | null; dueAt: string; status: "PENDING" | "COMPLETED" | "CANCELED"; completedAt: string | null; assignedTo: Actor; }
interface TimelineResponse { success: true; data: { activities: Activity[]; followUps: FollowUp[] }; }

export function CustomerEngagement({ customerId }: Readonly<{ customerId: string }>) {
  const { session, authorizedRequest } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activity, setActivity] = useState({ type: "CALL", summary: "", details: "" });
  const [followUp, setFollowUp] = useState({ title: "", description: "", dueAt: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canView = session?.membership.permissions.includes("CRM_ACTIVITY_VIEW") ?? false;
  const canManageActivities = session?.membership.permissions.includes("CRM_ACTIVITY_MANAGE") ?? false;
  const canManageFollowUps = session?.membership.permissions.includes("CRM_FOLLOWUP_MANAGE") ?? false;

  const load = useCallback(async () => {
    if (!canView) return;
    try { const response = await authorizedRequest<TimelineResponse>(`/customers/${customerId}/engagement`); setActivities(response.data.activities); setFollowUps(response.data.followUps); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load customer activity."); }
  }, [authorizedRequest, customerId, canView]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  async function logActivity() {
    if (!activity.summary.trim()) return;
    setSaving(true); setError("");
    try { await authorizedRequest(`/customers/${customerId}/engagement/activities`, { method: "POST", body: JSON.stringify({ ...activity, occurredAt: new Date().toISOString() }) }); setActivity({ ...activity, summary: "", details: "" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to log activity."); }
    finally { setSaving(false); }
  }
  async function scheduleFollowUp() {
    if (!followUp.title.trim() || !followUp.dueAt) return;
    setSaving(true); setError("");
    try { await authorizedRequest(`/customers/${customerId}/engagement/follow-ups`, { method: "POST", body: JSON.stringify({ ...followUp, dueAt: new Date(followUp.dueAt).toISOString() }) }); setFollowUp({ title: "", description: "", dueAt: "" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to schedule follow-up."); }
    finally { setSaving(false); }
  }
  async function setStatus(id: string, status: FollowUp["status"]) {
    setError("");
    try { await authorizedRequest(`/customers/${customerId}/engagement/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update follow-up."); }
  }

  if (!canView) return null;
  return <section className="customer-engagement">
    <div className="engagement-heading"><div><p>Relationship history</p><h3>Activities & follow-ups</h3></div><span>{activities.length} activities</span></div>
    {error && <div className="form-alert">{error}</div>}
    {(canManageActivities || canManageFollowUps) && <div className="engagement-composer">
      {canManageActivities && <div><strong>Log activity</strong><div className="engagement-fields"><select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })}><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="MEETING">Meeting</option><option value="NOTE">Note</option><option value="WHATSAPP">WhatsApp</option></select><input value={activity.summary} onChange={(event) => setActivity({ ...activity, summary: event.target.value })} placeholder="Short outcome or summary" /><textarea value={activity.details} onChange={(event) => setActivity({ ...activity, details: event.target.value })} placeholder="Optional details" rows={2} /><button type="button" disabled={saving || !activity.summary.trim()} onClick={() => void logActivity()}>Log activity</button></div></div>}
      {canManageFollowUps && <div><strong>Schedule follow-up</strong><div className="engagement-fields"><input value={followUp.title} onChange={(event) => setFollowUp({ ...followUp, title: event.target.value })} placeholder="What needs to happen?" /><input type="datetime-local" value={followUp.dueAt} onChange={(event) => setFollowUp({ ...followUp, dueAt: event.target.value })} /><textarea value={followUp.description} onChange={(event) => setFollowUp({ ...followUp, description: event.target.value })} placeholder="Optional instructions" rows={2} /><button type="button" disabled={saving || !followUp.title.trim() || !followUp.dueAt} onClick={() => void scheduleFollowUp()}>Schedule</button></div></div>}
    </div>}
    <div className="engagement-columns"><div><div className="engagement-subtitle"><strong>Timeline</strong><span>{activities.length}</span></div>{activities.length === 0 ? <p className="engagement-empty">No activity logged yet.</p> : <div className="activity-timeline">{activities.map((item) => <article key={item.id}><span>{item.type[0]}</span><div><strong>{item.summary}</strong><p>{item.details}</p><small>{item.type} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt))} · {item.createdBy.firstName}</small></div></article>)}</div>}</div><div><div className="engagement-subtitle"><strong>Follow-ups</strong><span>{followUps.filter((item) => item.status === "PENDING").length} open</span></div>{followUps.length === 0 ? <p className="engagement-empty">No follow-ups scheduled.</p> : <div className="follow-up-list">{followUps.map((item) => { const overdue = item.status === "PENDING" && new Date(item.dueAt) < new Date(); return <article key={item.id} className={`${item.status.toLowerCase()} ${overdue ? "overdue" : ""}`}><div><strong>{item.title}</strong><p>{item.description}</p><small>{overdue ? "Overdue · " : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.dueAt))}</small></div>{canManageFollowUps && item.status === "PENDING" && <div><button type="button" onClick={() => void setStatus(item.id, "COMPLETED")}>Complete</button><button type="button" onClick={() => void setStatus(item.id, "CANCELED")}>Cancel</button></div>}</article>; })}</div>}</div></div>
  </section>;
}
