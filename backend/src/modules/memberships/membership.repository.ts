import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

const memberInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
  role: { select: { code: true, name: true } },
  serviceAccess: { select: { serviceId: true, accessMode: true } },
} satisfies Prisma.OrganizationMembershipInclude;

export class MembershipRepository {
  list(organizationId: string) {
    return prisma.organizationMembership.findMany({
      where: { organizationId, status: { not: "REMOVED" } },
      include: memberInclude,
      orderBy: [{ joinedAt: "asc" }],
    });
  }
  listInvitations(organizationId: string) {
    return prisma.membershipInvitation.findMany({
      where: { organizationId, status: "PENDING" },
      include: { role: { select: { code: true, name: true } }, invitedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  findUser(email: string) { return prisma.user.findUnique({ where: { email } }); }
  findMembership(organizationId: string, userId: string) {
    return prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } }, include: memberInclude });
  }
  findMemberById(organizationId: string, id: string) {
    return prisma.organizationMembership.findFirst({ where: { id, organizationId }, include: memberInclude });
  }
  findRole(organizationId: string, code: string) {
    return prisma.role.findFirst({ where: { code, OR: [{ organizationId }, { organizationId: null, isSystem: true }] } });
  }
  async createInvitation(data: Prisma.MembershipInvitationUncheckedCreateInput) {
    await prisma.membershipInvitation.updateMany({ where: { organizationId: data.organizationId, email: data.email, status: "PENDING" }, data: { status: "REVOKED" } });
    return prisma.membershipInvitation.create({ data, include: { role: { select: { code: true, name: true } }, organization: { select: { name: true } } } });
  }
  findInvitation(tokenHash: string) {
    return prisma.membershipInvitation.findUnique({ where: { tokenHash }, include: { organization: true, role: true } });
  }
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) { return prisma.$transaction(work); }
  updateMember(organizationId: string, id: string, data: Prisma.OrganizationMembershipUpdateInput) {
    return prisma.organizationMembership.update({ where: { id, organizationId }, data, include: memberInclude });
  }
  async removeMember(organizationId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.membershipServiceAccess.deleteMany({ where: { organizationId, membershipId: id } });
      const membership = await tx.organizationMembership.update({ where: { id, organizationId }, data: { status: "REMOVED" } });
      await tx.refreshSession.updateMany({ where: { membershipId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return membership;
    });
  }
  revokeInvitation(organizationId: string, id: string) {
    return prisma.membershipInvitation.updateMany({ where: { id, organizationId, status: "PENDING" }, data: { status: "REVOKED" } });
  }
  enabledOrganizationServices(organizationId: string) {
    return prisma.organizationService.findMany({ where: { organizationId, status: "ENABLED", deletedAt: null, service: { status: "ACTIVE", archivedAt: null } }, select: { serviceId: true } });
  }
  replaceServiceAccess(organizationId: string, membershipId: string, actorUserId: string, services: { serviceId: string; accessMode: "READ_ONLY" | "READ_WRITE" }[]) {
    return prisma.$transaction(async (tx) => {
      const serviceIds = services.map((item) => item.serviceId);
      await tx.membershipServiceAccess.deleteMany({ where: { organizationId, membershipId, serviceId: { notIn: serviceIds } } });
      for (const item of services) await tx.membershipServiceAccess.upsert({ where: { membershipId_serviceId: { membershipId, serviceId: item.serviceId } }, update: { accessMode: item.accessMode, updatedById: actorUserId }, create: { organizationId, membershipId, serviceId: item.serviceId, accessMode: item.accessMode, createdById: actorUserId, updatedById: actorUserId } });
    });
  }
}

export type MemberRecord = Awaited<ReturnType<MembershipRepository["findMemberById"]>>;
