"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  activeMemberCount: number;
  enabledServiceIds: string[];
  owner: { id: string; firstName: string; lastName: string | null; email: string; status: string; isPlatformAdmin: boolean } | null;
  plan: { id: string; planId: string; status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELED"; startsAt: string; trialEndsAt: string | null; expiresAt: string | null; plan: { id: string; code: string; name: string }; overrides: { serviceId: string; type: "ADD" | "REMOVE" }[] } | null;
}
interface PlatformService { id: string; code: string; name: string; description: string | null; status: string; enabledOrganizationCount: number; }
interface ServicePlan { id: string; code: string; name: string; description: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; serviceIds: string[]; organizationCount: number; }
interface PlatformInvitation { id: string; email: string; organizationName: string; status: string; expiresAt: string; createdAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION"; }
interface OverviewResponse { success: true; data: { organizations: PlatformOrganization[]; services: PlatformService[]; invitations: PlatformInvitation[]; plans: ServicePlan[] }; }
interface InviteResponse { success: true; data: { invitation: PlatformInvitation; signupPath: string }; }

export function SuperAdminConsole() {
  const router = useRouter();
  const { session, isLoading, authorizedRequest, logout } = useAuth();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [services, setServices] = useState<PlatformService[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", organizationName: "" });
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planForm, setPlanForm] = useState({ code: "", name: "", description: "", status: "DRAFT" as "DRAFT" | "ACTIVE" | "ARCHIVED", serviceIds: [] as string[] });
  const [assignment, setAssignment] = useState({ planId: "", status: "ACTIVE" as "TRIAL" | "ACTIVE" | "CANCELED", startsAt: new Date().toISOString().slice(0, 16), trialEndsAt: "", expiresAt: "" });

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<OverviewResponse>("/platform/overview");
      setOrganizations(response.data.organizations);
      setServices(response.data.services);
      setInvitations(response.data.invitations);
      setPlans(response.data.plans);
      const nextSelectedId = selectedId || response.data.organizations[0]?.id || "";
      const nextSelected = response.data.organizations.find((item) => item.id === nextSelectedId);
      setSelectedId(nextSelectedId);
      if (nextSelected?.plan) setAssignment({ planId: nextSelected.plan.planId, status: nextSelected.plan.status === "EXPIRED" ? "CANCELED" : nextSelected.plan.status, startsAt: nextSelected.plan.startsAt.slice(0, 16), trialEndsAt: nextSelected.plan.trialEndsAt?.slice(0, 16) ?? "", expiresAt: nextSelected.plan.expiresAt?.slice(0, 16) ?? "" });
      else setAssignment({ planId: response.data.plans.find((plan) => plan.status === "ACTIVE")?.id ?? "", status: "ACTIVE", startsAt: new Date().toISOString().slice(0, 16), trialEndsAt: "", expiresAt: "" });
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load the platform console."); }
    finally { setLoading(false); }
  }, [authorizedRequest, selectedId]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (!isLoading && session && !session.user.isPlatformAdmin) router.replace("/dashboard");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session?.user.isPlatformAdmin) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [session, load]);

  const selected = useMemo(() => organizations.find((item) => item.id === selectedId), [organizations, selectedId]);
  async function toggle(serviceId: string, enabled: boolean) {
    if (!selected) return;
    setUpdatingId(serviceId); setError("");
    try {
      await authorizedRequest(`/platform/organizations/${selected.id}/services/${serviceId}`, { method: "PUT", body: JSON.stringify({ enabled }) });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update service access."); }
    finally { setUpdatingId(""); }
  }
  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setInviting(true); setError(""); setInviteLink("");
    try {
      const response = await authorizedRequest<InviteResponse>("/platform/invitations", { method: "POST", body: JSON.stringify(inviteForm) });
      setInviteLink(`${window.location.origin}${response.data.signupPath}`);
      setInviteForm({ email: "", organizationName: "" });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to create invitation."); }
    finally { setInviting(false); }
  }
  async function revokeInvitation(id: string) {
    setError("");
    try { await authorizedRequest(`/platform/invitations/${id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to revoke invitation."); }
  }
  async function setAccess(status: "ACTIVE" | "SUSPENDED") {
    if (!selected) return;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}/access`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update account access."); }
  }
  async function removeAccount() {
    if (!selected || !window.confirm(`Remove ${selected.name}? Login sessions and service access will be disabled.`)) return;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}`, { method: "DELETE" }); setSelectedId(""); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to remove organization account."); }
  }
  function editPlan(plan?: ServicePlan) {
    setEditingPlanId(plan?.id ?? "");
    setPlanForm(plan ? { code: plan.code, name: plan.name, description: plan.description ?? "", status: plan.status, serviceIds: plan.serviceIds } : { code: "", name: "", description: "", status: "DRAFT", serviceIds: [] });
    setShowPlanEditor(true);
  }
  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      await authorizedRequest(editingPlanId ? `/platform/plans/${editingPlanId}` : "/platform/plans", { method: editingPlanId ? "PUT" : "POST", body: JSON.stringify({ ...planForm, description: planForm.description || null }) });
      setShowPlanEditor(false); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save service plan."); }
  }
  async function assignPlan() {
    if (!selected || !assignment.planId) return;
    setError("");
    try {
      await authorizedRequest(`/platform/organizations/${selected.id}/plan`, { method: "PUT", body: JSON.stringify({ planId: assignment.planId, status: assignment.status, startsAt: new Date(assignment.startsAt).toISOString(), trialEndsAt: assignment.trialEndsAt ? new Date(assignment.trialEndsAt).toISOString() : null, expiresAt: assignment.expiresAt ? new Date(assignment.expiresAt).toISOString() : null, additionalServiceIds: selected.plan?.overrides.filter((item) => item.type === "ADD").map((item) => item.serviceId) ?? [], removedServiceIds: selected.plan?.overrides.filter((item) => item.type === "REMOVE").map((item) => item.serviceId) ?? [] }) });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to assign service plan."); }
  }

  if (isLoading || loading || !session?.user.isPlatformAdmin) return <main className="screen-loader"><span className="spinner dark" /><p>Opening secure platform console…</p></main>;

  return <div className="platform-shell">
    <aside className="platform-sidebar">
      <div className="dashboard-logo"><Image src="/brand/b2brain-logo.png" alt="" width={38} height={38} /><span><strong>B² Brain</strong><small>Super Admin</small></span></div>
      <div className="platform-identity"><span>Platform control</span><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.user.email}</small></div>
      <nav><button className="active"><span>O</span>Organizations</button><button disabled><span>A</span>AI Agents <small>Soon</small></button><button disabled><span>H</span>Audit log <small>Soon</small></button></nav>
      <div className="platform-sidebar-actions"><button onClick={() => router.push("/dashboard")}>Organization workspace</button><button onClick={() => void logout().then(() => router.replace("/login"))}>Sign out</button></div>
    </aside>
    <main className="platform-main">
      <header><div><p>Restricted platform administration</p><h1>Organization access</h1><span>Assign only completed, active modules to customer organizations.</span></div><div className="platform-stats"><span><strong>{organizations.length}</strong> organizations</span><span><strong>{services.length}</strong> services</span></div></header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <section className="platform-invitations">
        <form onSubmit={createInvitation}><div><p>Controlled onboarding</p><h2>Invite an organization owner</h2><span>Only this approved email can use the one-time registration link.</span></div><label><span>Organization</span><input value={inviteForm.organizationName} onChange={(event) => setInviteForm({ ...inviteForm, organizationName: event.target.value })} placeholder="Company name" required maxLength={120} /></label><label><span>Owner email</span><input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="owner@company.com" required /></label><button disabled={inviting}>{inviting ? "Creating…" : "Create invitation"}</button></form>
        {inviteLink && <div className="invite-link-result"><div><strong>Private signup or reactivation link created</strong><span>{inviteLink}</span></div><button onClick={() => void navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}
        {invitations.length > 0 && <div className="pending-platform-invites"><div className="panel-title"><div><p>Pending approval</p><h3>Open invitations</h3></div><span>{invitations.length}</span></div>{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.organizationName}</strong><span>{invitation.email} · {invitation.type === "REACTIVATE_ORGANIZATION" ? "Reactivation" : "New account"}</span></div><small>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small><button onClick={() => void revokeInvitation(invitation.id)}>Revoke</button></article>)}</div>}
      </section>
      <section className="platform-plans">
        <div className="panel-title"><div><p>Commercial packaging</p><h3>Service plans</h3></div><button onClick={() => editPlan()}>+ New plan</button></div>
        {plans.length === 0 ? <div className="platform-empty">No service plans created.</div> : <div className="plan-grid">{plans.map((plan) => <article key={plan.id}><header><span>{plan.code}</span><i className={`account-status ${plan.status.toLowerCase()}`}>{plan.status}</i></header><h3>{plan.name}</h3><p>{plan.description ?? "No description provided."}</p><footer><span>{plan.serviceIds.length} services · {plan.organizationCount} organizations</span><button onClick={() => editPlan(plan)}>Edit</button></footer></article>)}</div>}
        {showPlanEditor && <form className="plan-editor" onSubmit={savePlan}><header><div><p>Plan definition</p><h3>{editingPlanId ? "Edit service plan" : "Create service plan"}</h3></div><button type="button" onClick={() => setShowPlanEditor(false)}>×</button></header><div className="plan-fields"><label><span>Code</span><input value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} required /></label><label><span>Name</span><input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required /></label><label><span>Status</span><select value={planForm.status} onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as typeof planForm.status })}><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label></div><label><span>Description</span><textarea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} rows={2} /></label><div className="plan-service-picker">{services.filter((service) => service.status === "ACTIVE").map((service) => <label key={service.id}><input type="checkbox" checked={planForm.serviceIds.includes(service.id)} onChange={(event) => setPlanForm({ ...planForm, serviceIds: event.target.checked ? [...planForm.serviceIds, service.id] : planForm.serviceIds.filter((id) => id !== service.id) })} /><span><strong>{service.name}</strong><small>{service.code}</small></span></label>)}</div><footer><button type="button" onClick={() => setShowPlanEditor(false)}>Cancel</button><button>Save plan</button></footer></form>}
      </section>
      <section className="platform-grid">
        <div className="organization-directory"><div className="panel-title"><div><p>Tenants</p><h3>Organizations</h3></div></div>{organizations.length === 0 ? <div className="platform-empty">No organizations registered.</div> : organizations.map((organization) => <button key={organization.id} className={selectedId === organization.id ? "active" : ""} onClick={() => setSelectedId(organization.id)}><span>{organization.name.slice(0, 2).toUpperCase()}</span><div><strong>{organization.name}</strong><small>{organization.owner?.email ?? "Owner unavailable"}</small></div><em className={`account-status ${organization.status.toLowerCase()}`}>{organization.status.replaceAll("_", " ")}</em></button>)}</div>
        <div className="service-assignment"><div className="panel-title"><div><p>Account & entitlements</p><h3>{selected ? selected.name : "Select an organization"}</h3></div>{selected && <span>{selected.enabledServiceIds.length} services</span>}</div>
          {selected && <div className="organization-access-bar"><div><span>Owner</span><strong>{selected.owner ? `${selected.owner.firstName} ${selected.owner.lastName ?? ""}` : "Unavailable"}</strong><small>{selected.owner?.email}</small></div><div><span>Login status</span><strong>{selected.status.replaceAll("_", " ")}</strong>{selected.owner?.isPlatformAdmin && <small>Protected Super Admin organization</small>}</div><div className="access-actions">{selected.status !== "ACTIVE" && <button className="approve" onClick={() => void setAccess("ACTIVE")}>{selected.status === "PENDING_APPROVAL" ? "Approve login" : "Restore access"}</button>}{selected.status === "ACTIVE" && !selected.owner?.isPlatformAdmin && <button onClick={() => void setAccess("SUSPENDED")}>Suspend</button>}{!selected.owner?.isPlatformAdmin && <button className="remove" onClick={() => void removeAccount()}>Remove account</button>}</div></div>}
          {selected && <section className="organization-plan-assignment"><header><div><span>Assigned plan</span><strong>{selected.plan?.plan.name ?? "Manual services"}</strong></div>{selected.plan && <i className={`account-status ${selected.plan.status.toLowerCase()}`}>{selected.plan.status}</i>}</header><div><label><span>Plan</span><select value={assignment.planId} onChange={(event) => setAssignment({ ...assignment, planId: event.target.value })}><option value="">Select a plan</option>{plans.filter((plan) => plan.status === "ACTIVE").map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label><span>Access type</span><select value={assignment.status} onChange={(event) => setAssignment({ ...assignment, status: event.target.value as typeof assignment.status })}><option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="CANCELED">Canceled</option></select></label><label><span>Starts</span><input type="datetime-local" value={assignment.startsAt} onChange={(event) => setAssignment({ ...assignment, startsAt: event.target.value })} /></label><label><span>Trial ends</span><input type="datetime-local" value={assignment.trialEndsAt} onChange={(event) => setAssignment({ ...assignment, trialEndsAt: event.target.value })} /></label><label><span>Expires</span><input type="datetime-local" value={assignment.expiresAt} onChange={(event) => setAssignment({ ...assignment, expiresAt: event.target.value })} /></label><button disabled={!assignment.planId || selected.status !== "ACTIVE"} onClick={() => void assignPlan()}>Apply plan</button></div><p>After applying a plan, the service switches below act as organization-specific add or remove overrides. Disabled services retain all business data.</p></section>}
          {!selected ? <div className="platform-empty">Choose an organization to manage access.</div> : services.length === 0 ? <div className="service-empty"><div className="service-empty-icon"><span /><span /><span /></div><h3>No platform services registered</h3><p>Build a real module first. It can then be registered and assigned here—never through customer signup.</p></div> : <div className="assignment-list">{services.map((service) => { const enabled = selected.enabledServiceIds.includes(service.id); return <article key={service.id}><div><span>{service.code}</span><h3>{service.name}</h3><p>{service.description || "No description provided."}</p></div><label className="access-switch"><input type="checkbox" checked={enabled} disabled={updatingId === service.id || service.status !== "ACTIVE" || selected.status !== "ACTIVE"} onChange={(event) => void toggle(service.id, event.target.checked)} /><span /><small>{selected.status !== "ACTIVE" ? "Approve first" : service.status === "ACTIVE" ? enabled ? "Enabled" : "Disabled" : service.status}</small></label></article>; })}</div>}
        </div>
      </section>
    </main>
  </div>;
}
