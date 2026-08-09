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
}
interface PlatformService { id: string; code: string; name: string; description: string | null; status: string; enabledOrganizationCount: number; }
interface PlatformInvitation { id: string; email: string; organizationName: string; status: string; expiresAt: string; createdAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION"; }
interface OverviewResponse { success: true; data: { organizations: PlatformOrganization[]; services: PlatformService[]; invitations: PlatformInvitation[] }; }
interface InviteResponse { success: true; data: { invitation: PlatformInvitation; signupPath: string }; }

export function SuperAdminConsole() {
  const router = useRouter();
  const { session, isLoading, authorizedRequest, logout } = useAuth();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [services, setServices] = useState<PlatformService[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", organizationName: "" });
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<OverviewResponse>("/platform/overview");
      setOrganizations(response.data.organizations);
      setServices(response.data.services);
      setInvitations(response.data.invitations);
      setSelectedId((current) => current || response.data.organizations[0]?.id || "");
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load the platform console."); }
    finally { setLoading(false); }
  }, [authorizedRequest]);

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
      <section className="platform-grid">
        <div className="organization-directory"><div className="panel-title"><div><p>Tenants</p><h3>Organizations</h3></div></div>{organizations.length === 0 ? <div className="platform-empty">No organizations registered.</div> : organizations.map((organization) => <button key={organization.id} className={selectedId === organization.id ? "active" : ""} onClick={() => setSelectedId(organization.id)}><span>{organization.name.slice(0, 2).toUpperCase()}</span><div><strong>{organization.name}</strong><small>{organization.owner?.email ?? "Owner unavailable"}</small></div><em className={`account-status ${organization.status.toLowerCase()}`}>{organization.status.replaceAll("_", " ")}</em></button>)}</div>
        <div className="service-assignment"><div className="panel-title"><div><p>Account & entitlements</p><h3>{selected ? selected.name : "Select an organization"}</h3></div>{selected && <span>{selected.enabledServiceIds.length} services</span>}</div>
          {selected && <div className="organization-access-bar"><div><span>Owner</span><strong>{selected.owner ? `${selected.owner.firstName} ${selected.owner.lastName ?? ""}` : "Unavailable"}</strong><small>{selected.owner?.email}</small></div><div><span>Login status</span><strong>{selected.status.replaceAll("_", " ")}</strong>{selected.owner?.isPlatformAdmin && <small>Protected Super Admin organization</small>}</div><div className="access-actions">{selected.status !== "ACTIVE" && <button className="approve" onClick={() => void setAccess("ACTIVE")}>{selected.status === "PENDING_APPROVAL" ? "Approve login" : "Restore access"}</button>}{selected.status === "ACTIVE" && !selected.owner?.isPlatformAdmin && <button onClick={() => void setAccess("SUSPENDED")}>Suspend</button>}{!selected.owner?.isPlatformAdmin && <button className="remove" onClick={() => void removeAccount()}>Remove account</button>}</div></div>}
          {!selected ? <div className="platform-empty">Choose an organization to manage access.</div> : services.length === 0 ? <div className="service-empty"><div className="service-empty-icon"><span /><span /><span /></div><h3>No platform services registered</h3><p>Build a real module first. It can then be registered and assigned here—never through customer signup.</p></div> : <div className="assignment-list">{services.map((service) => { const enabled = selected.enabledServiceIds.includes(service.id); return <article key={service.id}><div><span>{service.code}</span><h3>{service.name}</h3><p>{service.description || "No description provided."}</p></div><label className="access-switch"><input type="checkbox" checked={enabled} disabled={updatingId === service.id || service.status !== "ACTIVE" || selected.status !== "ACTIVE"} onChange={(event) => void toggle(service.id, event.target.checked)} /><span /><small>{selected.status !== "ACTIVE" ? "Approve first" : service.status === "ACTIVE" ? enabled ? "Enabled" : "Disabled" : service.status}</small></label></article>; })}</div>}
        </div>
      </section>
    </main>
  </div>;
}
