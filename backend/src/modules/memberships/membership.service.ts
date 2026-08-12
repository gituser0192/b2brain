import argon2 from "argon2";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { MembershipRepository, type MemberRecord } from "./membership.repository.js";
import { hashInvitationToken, invitationExpiry, newInvitationToken } from "./membership.tokens.js";
import type { AcceptInvitationInput, InviteMemberInput, UpdateMembershipInput, UpdateMemberServicesInput } from "./membership.validation.js";

function safeMember(member: NonNullable<MemberRecord>) {
  return {
    id: member.id,
    status: member.status,
    joinedAt: member.joinedAt,
    user: member.user,
    role: member.role,
    serviceIds: member.serviceAccess.map((access) => access.serviceId),
  };
}

export class MembershipService {
  constructor(private readonly repository = new MembershipRepository()) {}

  async list(organizationId: string) {
    const [members, invitations] = await Promise.all([this.repository.list(organizationId), this.repository.listInvitations(organizationId)]);
    return {
      members: members.map(safeMember),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      })),
    };
  }

  async invite(organizationId: string, invitedById: string, input: InviteMemberInput) {
    const existingUser = await this.repository.findUser(input.email);
    if (existingUser && await this.repository.findMembership(organizationId, existingUser.id)) throw new AppError(409, "This person already belongs to your organization.", "MEMBERSHIP_ALREADY_EXISTS", { email: "This person is already a member." });
    if (input.roleCode === "ORGANIZATION_OWNER") throw new AppError(400, "The owner role cannot be assigned through invitations.", "INVALID_ROLE");
    const role = await this.repository.findRole(organizationId, input.roleCode);
    if (!role) throw new AppError(400, "Select a valid organization role.", "INVALID_ROLE");
    const token = newInvitationToken();
    const invitation = await this.repository.createInvitation({
      organizationId,
      invitedById,
      email: input.email,
      roleId: role.id,
      tokenHash: hashInvitationToken(token),
      expiresAt: invitationExpiry(),
    });
    return {
      invitation: { id: invitation.id, email: invitation.email, status: invitation.status, expiresAt: invitation.expiresAt, role: invitation.role },
      acceptPath: `/accept-invitation?token=${encodeURIComponent(token)}`,
    };
  }

  async accept(token: string, input: AcceptInvitationInput) {
    const invitation = await this.repository.findInvitation(hashInvitationToken(token));
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new AppError(410, "This invitation is invalid or has expired.", "INVITATION_INVALID");
    const existingUser = await this.repository.findUser(invitation.email);
    if (existingUser && !(await argon2.verify(existingUser.passwordHash, input.password))) throw new AppError(401, "Use the password for the invited email account.", "INVALID_CREDENTIALS");
    const result = await this.repository.transaction(async (tx) => {
      const user = existingUser ?? await tx.user.create({
        data: {
          firstName: input.firstName,
          ...(input.lastName ? { lastName: input.lastName } : {}),
          email: invitation.email,
          passwordHash: await argon2.hash(input.password, { type: argon2.argon2id, timeCost: Math.max(2, Math.min(5, env.PASSWORD_HASH_COST - 9)), memoryCost: 65_536, parallelism: 1 }),
        },
      });
      const existingMembership = await tx.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } } });
      if (existingMembership?.status === "ACTIVE") throw new AppError(409, "This account already belongs to the organization.", "MEMBERSHIP_ALREADY_EXISTS");
      const membership = existingMembership
        ? await tx.organizationMembership.update({ where: { id: existingMembership.id }, data: { roleId: invitation.roleId, status: "ACTIVE", joinedAt: new Date() } })
        : await tx.organizationMembership.create({ data: { organizationId: invitation.organizationId, userId: user.id, roleId: invitation.roleId } });
      await tx.membershipInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      return { user, membership };
    });
    return { organization: { id: invitation.organization.id, name: invitation.organization.name }, email: result.user.email };
  }

  async update(organizationId: string, actorMembershipId: string, id: string, input: UpdateMembershipInput) {
    const member = await this.repository.findMemberById(organizationId, id);
    if (!member) throw new AppError(404, "Membership not found.", "MEMBERSHIP_NOT_FOUND");
    if (member.role.code === "ORGANIZATION_OWNER" || id === actorMembershipId) throw new AppError(409, "The organization owner cannot be changed or suspended here.", "OWNER_PROTECTED");
    if (input.roleCode === "ORGANIZATION_OWNER") throw new AppError(400, "The owner role cannot be assigned here.", "INVALID_ROLE");
    const role = input.roleCode ? await this.repository.findRole(organizationId, input.roleCode) : undefined;
    if (input.roleCode && !role) throw new AppError(400, "Select a valid organization role.", "INVALID_ROLE");
    return safeMember(await this.repository.updateMember(organizationId, id, {
      ...(role ? { role: { connect: { id: role.id } } } : {}),
      ...(input.status ? { status: input.status } : {}),
    }));
  }

  async remove(organizationId: string, actorMembershipId: string, id: string) {
    const member = await this.repository.findMemberById(organizationId, id);
    if (!member) throw new AppError(404, "Membership not found.", "MEMBERSHIP_NOT_FOUND");
    if (member.role.code === "ORGANIZATION_OWNER" || id === actorMembershipId) throw new AppError(409, "The organization owner cannot be removed.", "OWNER_PROTECTED");
    await this.repository.removeMember(organizationId, id);
  }

  async revokeInvitation(organizationId: string, id: string) {
    const result = await this.repository.revokeInvitation(organizationId, id);
    if (result.count !== 1) throw new AppError(404, "Pending invitation not found.", "INVITATION_NOT_FOUND");
  }

  async updateServices(organizationId: string, actorUserId: string, id: string, input: UpdateMemberServicesInput) {
    const member = await this.repository.findMemberById(organizationId, id);
    if (!member) throw new AppError(404, "Membership not found.", "MEMBERSHIP_NOT_FOUND");
    if (member.role.code === "ORGANIZATION_OWNER") throw new AppError(409, "The organization owner always has access to enabled services.", "OWNER_SERVICE_ACCESS_PROTECTED");
    const enabledIds = new Set((await this.repository.enabledOrganizationServices(organizationId)).map((item) => item.serviceId));
    if (input.serviceIds.some((serviceId) => !enabledIds.has(serviceId))) throw new AppError(400, "Only services enabled for this organization can be assigned.", "INVALID_SERVICE_ASSIGNMENT");
    await this.repository.replaceServiceAccess(organizationId, id, actorUserId, [...new Set(input.serviceIds)]);
    return { membershipId: id, serviceIds: [...new Set(input.serviceIds)] };
  }
}
