"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { InvitePanel, MemberDirectory, PendingInvitations } from "./team-panels";
import type { RoleOption, ServiceOption, TeamInvitation, TeamMember } from "./team-types";

interface ListResponse { success: true; data: { members: TeamMember[]; invitations: TeamInvitation[] }; }
interface InviteResponse { success: true; message: string; data: { invitation: TeamInvitation; acceptPath: string; emailDelivered: boolean }; }
interface RolesResponse { success: true; data: { roles: RoleOption[] }; }
interface ServicesResponse { success: true; data: ServiceOption[]; }

export function TeamWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
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
      setNotice(response.data.emailDelivered ? "Invitation created and emailed to the invited person." : "Invitation created. Email is not configured, so copy and send the secure link.");
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

  async function toggleMemberService(member: TeamMember, serviceId: string, enabled: boolean) {
    const services = enabled ? [...member.serviceAccess, { serviceId, accessMode: "READ_ONLY" as const }] : member.serviceAccess.filter((item) => item.serviceId !== serviceId);
    setError("");
    try {
      await authorizedRequest(`/memberships/${member.id}/services`, { method: "PUT", body: JSON.stringify({ services }) });
      setNotice("Member service access updated.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update service access."); }
  }

  async function changeServiceMode(member: TeamMember, serviceId: string, accessMode: "READ_ONLY" | "READ_WRITE") {
    const services = member.serviceAccess.map((item) => item.serviceId === serviceId ? { ...item, accessMode } : item);
    setError("");
    try {
      await authorizedRequest(`/memberships/${member.id}/services`, { method: "PUT", body: JSON.stringify({ services }) });
      setNotice("Service access mode updated.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update access mode."); }
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

      {canManage && <InvitePanel email={email} roleCode={roleCode} roles={roleOptions} inviting={inviting} inviteUrl={inviteUrl} onEmail={setEmail} onRole={setRoleCode} onSubmit={invite} onCopy={() => void navigator.clipboard.writeText(inviteUrl).then(() => setNotice("Invitation link copied."))} />}
      <MemberDirectory members={members} roles={roleOptions} services={serviceOptions} loading={loading} canManage={canManage} onUpdate={(id, update) => void updateMember(id, update)} onRemove={(id) => void removeMember(id)} onToggleService={(member, serviceId, enabled) => void toggleMemberService(member, serviceId, enabled)} onMode={(member, serviceId, mode) => void changeServiceMode(member, serviceId, mode)} />
      <PendingInvitations invitations={invitations} canManage={canManage} onRevoke={(id) => void revokeInvitation(id)} />
    </div>
  );
}
