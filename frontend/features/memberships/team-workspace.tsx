"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

interface Member {
  id: string;
  status: "ACTIVE" | "SUSPENDED";
  joinedAt: string;
  user: { id: string; firstName: string; lastName: string | null; email: string; status: string };
  role: { code: string; name: string };
  serviceIds: string[];
}
interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  role: { code: string; name: string };
  invitedBy: { firstName: string; lastName: string | null };
}
interface ListResponse { success: true; data: { members: Member[]; invitations: Invitation[] }; }
interface InviteResponse { success: true; message: string; data: { invitation: Invitation; acceptPath: string }; }
interface RoleOption { code: string; name: string; isSystem: boolean; }
interface RolesResponse { success: true; data: { roles: RoleOption[] }; }
interface ServiceOption { id: string; code: string; name: string; }
interface ServicesResponse { success: true; data: ServiceOption[]; }

export function TeamWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState("ORGANIZATION_MEMBER");
  const [inviteUrl, setInviteUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canManage = session?.membership.permissions.includes("MEMBERSHIP_MANAGE") ?? false;

  const load = useCallback(async () => {
    try {
      const [response, roleResponse, serviceResponse] = await Promise.all([authorizedRequest<ListResponse>("/memberships"), authorizedRequest<RolesResponse>("/roles"), authorizedRequest<ServicesResponse>("/services/enabled")]);
      setMembers(response.data.members);
      setInvitations(response.data.invitations);
      setRoleOptions(roleResponse.data.roles.filter((role) => role.code !== "ORGANIZATION_OWNER"));
      setServiceOptions(serviceResponse.data);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load your team.");
    } finally { setLoading(false); }
  }, [authorizedRequest]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedRequest<InviteResponse>("/memberships/invitations", { method: "POST", body: JSON.stringify({ email, roleCode }) });
      setInviteUrl(`${window.location.origin}${response.data.acceptPath}`);
      setEmail("");
      setNotice("Invitation created. Copy the secure link and send it to the invited person.");
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to create the invitation.");
    } finally { setInviting(false); }
  }

  async function updateMember(id: string, update: { roleCode?: string; status?: string }) {
    setError("");
    try {
      await authorizedRequest(`/memberships/${id}`, { method: "PATCH", body: JSON.stringify(update) });
      setNotice("Member access updated.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update this member."); }
  }

  async function removeMember(id: string) {
    if (!window.confirm("Remove this person from the organization? Their active sessions will be revoked.")) return;
    try {
      await authorizedRequest(`/memberships/${id}`, { method: "DELETE" });
      setNotice("Member removed.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to remove this member."); }
  }

  async function toggleMemberService(member: Member, serviceId: string, enabled: boolean) {
    const serviceIds = enabled ? [...new Set([...member.serviceIds, serviceId])] : member.serviceIds.filter((id) => id !== serviceId);
    setError("");
    try {
      await authorizedRequest(`/memberships/${member.id}/services`, { method: "PUT", body: JSON.stringify({ serviceIds }) });
      setNotice("Member service access updated.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update service access."); }
  }

  async function revokeInvitation(id: string) {
    try {
      await authorizedRequest(`/memberships/invitations/${id}`, { method: "DELETE" });
      setNotice("Invitation revoked.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to revoke this invitation."); }
  }

  return (
    <div className="team-workspace">
      <div className="team-heading"><div><p>People & access</p><h2>Your organization team</h2><span>Manage real members, roles, and pending invitations.</span></div><div className="team-count"><strong>{members.length}</strong><small>{members.length === 1 ? "member" : "members"}</small></div></div>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}

      {canManage && (
        <section className="invite-panel">
          <div><p>Invite someone</p><h3>Add a trusted teammate</h3><span>An invitation creates no account until the recipient accepts it.</span></div>
          <form onSubmit={invite}>
            <label><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required /></label>
            <label><span>Starting role</span><select value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>{roleOptions.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}</select></label>
            <button disabled={inviting}>{inviting ? "Creating…" : "Create invitation"}</button>
          </form>
          {inviteUrl && <div className="invite-link"><div><span>Secure invitation link</span><code>{inviteUrl}</code></div><button onClick={() => void navigator.clipboard.writeText(inviteUrl).then(() => setNotice("Invitation link copied."))}>Copy link</button></div>}
        </section>
      )}

      <section className="members-panel">
        <div className="panel-title"><div><p>Active directory</p><h3>Members</h3></div><span>{loading ? "Loading…" : `${members.length} total`}</span></div>
        {!loading && members.length === 0 ? <div className="team-empty"><span>◇</span><h3>No members yet</h3><p>Invited people will appear after accepting their secure invitation.</p></div> : (
          <div className="member-list">
            {members.map((member) => {
              const protectedOwner = member.role.code === "ORGANIZATION_OWNER";
              const initials = `${member.user.firstName[0] ?? ""}${member.user.lastName?.[0] ?? ""}`.toUpperCase();
              return <article className="member-row" key={member.id}>
                <div className="avatar">{initials}</div>
                <div className="member-identity"><strong>{member.user.firstName} {member.user.lastName}</strong><span>{member.user.email}</span></div>
                <span className={`member-status ${member.status.toLowerCase()}`}><i />{member.status === "ACTIVE" ? "Active" : "Suspended"}</span>
                {canManage && !protectedOwner ? <select value={member.role.code} onChange={(event) => void updateMember(member.id, { roleCode: event.target.value })}>{roleOptions.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}</select> : <span className="role-label">{member.role.name}</span>}
                {canManage && !protectedOwner ? <div className="member-actions"><button onClick={() => void updateMember(member.id, { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>{member.status === "ACTIVE" ? "Suspend" : "Restore"}</button><button className="danger" onClick={() => void removeMember(member.id)}>Remove</button></div> : <span className="owner-lock">Protected owner</span>}
                {!protectedOwner && <div className="member-service-access"><strong>Assigned services</strong>{serviceOptions.length === 0 ? <span>No organization services enabled.</span> : <div>{serviceOptions.map((service) => <label key={service.id}><input type="checkbox" checked={member.serviceIds.includes(service.id)} disabled={!canManage || member.status !== "ACTIVE"} onChange={(event) => void toggleMemberService(member, service.id, event.target.checked)} /><span>{service.name}</span></label>)}</div>}</div>}
              </article>;
            })}
          </div>
        )}
      </section>

      {invitations.length > 0 && <section className="members-panel pending-panel"><div className="panel-title"><div><p>Awaiting response</p><h3>Pending invitations</h3></div><span>{invitations.length}</span></div><div className="member-list">{invitations.map((invitation) => <article className="member-row invitation-row" key={invitation.id}><div className="avatar invited">@</div><div className="member-identity"><strong>{invitation.email}</strong><span>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</span></div><span className="role-label">{invitation.role.name}</span>{canManage && <button className="revoke-button" onClick={() => void revokeInvitation(invitation.id)}>Revoke</button>}</article>)}</div></section>}
    </div>
  );
}
