import type { FormEvent } from "react";
import type { RoleOption, ServiceOption, TeamInvitation, TeamMember } from "./team-types";

export function InvitePanel({ email, roleCode, roles, inviting, inviteUrl, onEmail, onRole, onSubmit, onCopy }: {
  email: string; roleCode: string; roles: RoleOption[]; inviting: boolean; inviteUrl: string;
  onEmail: (value: string) => void; onRole: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCopy: () => void;
}) {
  return <section className="invite-panel"><div><p>Invite someone</p><h3>Add a trusted teammate</h3><span>An invitation creates no account until the recipient accepts it.</span></div>
    <form onSubmit={onSubmit}><label><span>Work email</span><input type="email" value={email} onChange={(event) => onEmail(event.target.value)} placeholder="name@company.com" required /></label><label><span>Starting role</span><select value={roleCode} onChange={(event) => onRole(event.target.value)}>{roles.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}</select></label><button disabled={inviting}>{inviting ? "Creating…" : "Create invitation"}</button></form>
    {inviteUrl && <div className="invite-link"><div><span>Secure invitation link</span><code>{inviteUrl}</code></div><button onClick={onCopy}>Copy link</button></div>}
  </section>;
}

export function MemberDirectory({ members, roles, services, loading, canManage, onUpdate, onRemove, onToggleService, onMode }: {
  members: TeamMember[]; roles: RoleOption[]; services: ServiceOption[]; loading: boolean; canManage: boolean;
  onUpdate: (id: string, update: { roleCode?: string; status?: string }) => void;
  onRemove: (id: string) => void; onToggleService: (member: TeamMember, serviceId: string, enabled: boolean) => void;
  onMode: (member: TeamMember, serviceId: string, mode: "READ_ONLY" | "READ_WRITE") => void;
}) {
  return <section className="members-panel"><div className="panel-title"><div><p>Active directory</p><h3>Members</h3></div><span>{loading ? "Loading…" : `${members.length} total`}</span></div>
    {!loading && !members.length ? <div className="team-empty"><span>◇</span><h3>No members yet</h3><p>Invited people will appear after accepting their secure invitation.</p></div> : <div className="member-list">{members.map((member) => {
      const owner = member.role.code === "ORGANIZATION_OWNER";
      const initials = `${member.user.firstName[0] ?? ""}${member.user.lastName?.[0] ?? ""}`.toUpperCase();
      return <article className="member-row" key={member.id}><div className="avatar">{initials}</div><div className="member-identity"><strong>{member.user.firstName} {member.user.lastName}</strong><span>{member.user.email}</span></div><span className={`member-status ${member.status.toLowerCase()}`}><i />{member.status === "ACTIVE" ? "Active" : "Suspended"}</span>
        {canManage && !owner ? <select value={member.role.code} onChange={(event) => onUpdate(member.id, { roleCode: event.target.value })}>{roles.map((role) => <option value={role.code} key={role.code}>{role.name}</option>)}</select> : <span className="role-label">{member.role.name}</span>}
        {canManage && !owner ? <div className="member-actions"><button onClick={() => onUpdate(member.id, { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>{member.status === "ACTIVE" ? "Suspend" : "Restore"}</button><button className="danger" onClick={() => onRemove(member.id)}>Remove</button></div> : <span className="owner-lock">Protected owner</span>}
        {!owner && <div className="member-service-access"><strong>Assigned services</strong>{!services.length ? <span>No organization services enabled.</span> : <div>{services.map((service) => { const access = member.serviceAccess.find((item) => item.serviceId === service.id); return <div className={access ? "service-access-item assigned" : "service-access-item"} key={service.id}><label><input type="checkbox" checked={Boolean(access)} disabled={!canManage || member.status !== "ACTIVE"} onChange={(event) => onToggleService(member, service.id, event.target.checked)} /><span>{service.name}</span></label>{access && <select value={access.accessMode} disabled={!canManage || member.status !== "ACTIVE"} onChange={(event) => onMode(member, service.id, event.target.value as "READ_ONLY" | "READ_WRITE")}><option value="READ_ONLY">Read only</option><option value="READ_WRITE">Read & write</option></select>}</div>; })}</div>}</div>}
      </article>;
    })}</div>}
  </section>;
}

export function PendingInvitations({ invitations, canManage, onRevoke }: { invitations: TeamInvitation[]; canManage: boolean; onRevoke: (id: string) => void }) {
  if (!invitations.length) return null;
  return <section className="members-panel pending-panel"><div className="panel-title"><div><p>Awaiting response</p><h3>Pending invitations</h3></div><span>{invitations.length}</span></div><div className="member-list">{invitations.map((invitation) => <article className="member-row invitation-row" key={invitation.id}><div className="avatar invited">@</div><div className="member-identity"><strong>{invitation.email}</strong><span>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</span></div><span className="role-label">{invitation.role.name}</span>{canManage && <button className="revoke-button" onClick={() => onRevoke(invitation.id)}>Revoke</button>}</article>)}</div></section>;
}
