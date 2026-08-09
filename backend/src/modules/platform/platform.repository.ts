import { prisma } from "../../database/prisma.js";

export class PlatformRepository {
  listOrganizations() {
    return prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        memberships: {
          where: { role: { code: "ORGANIZATION_OWNER" }, status: { not: "REMOVED" } },
          select: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, isPlatformAdmin: true } } },
          take: 1,
        },
        organizationServices: {
          where: { status: "ENABLED", deletedAt: null },
          select: { serviceId: true, enabledAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listServices() {
    return prisma.service.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { organizationServices: { where: { status: "ENABLED", deletedAt: null } } } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  listInvitations() {
    return prisma.platformInvitation.findMany({
      where: { status: "PENDING" },
      include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findAccountByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { role: { code: "ORGANIZATION_OWNER" }, status: { not: "REMOVED" } },
          include: { organization: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async createInvitation(email: string, organizationName: string, invitedById: string, tokenHash: string, expiresAt: Date, type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION", organizationId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.platformInvitation.updateMany({ where: { email, status: "PENDING" }, data: { status: "REVOKED" } });
      return tx.platformInvitation.create({ data: { email, organizationName, invitedById, tokenHash, expiresAt, type, ...(organizationId ? { organizationId } : {}) } });
    });
  }

  revokeInvitation(id: string) {
    return prisma.platformInvitation.updateMany({ where: { id, status: "PENDING" }, data: { status: "REVOKED" } });
  }

  findOrganization(id: string) {
    return prisma.organization.findFirst({ where: { id, deletedAt: null } });
  }

  organizationHasPlatformAdmin(organizationId: string) {
    return prisma.organizationMembership.findFirst({
      where: { organizationId, status: { not: "REMOVED" }, user: { isPlatformAdmin: true, deletedAt: null } },
      select: { id: true },
    });
  }

  findService(id: string) {
    return prisma.service.findFirst({ where: { id, archivedAt: null } });
  }

  setOrganizationAccess(organizationId: string, status: "ACTIVE" | "SUSPENDED") {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({ where: { id: organizationId, deletedAt: null }, data: { status } });
      if (status === "SUSPENDED") {
        const memberships = await tx.organizationMembership.findMany({ where: { organizationId }, select: { id: true } });
        await tx.refreshSession.updateMany({ where: { membershipId: { in: memberships.map((item) => item.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return organization;
    });
  }

  removeOrganization(organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const memberships = await tx.organizationMembership.findMany({ where: { organizationId }, select: { id: true } });
      await tx.refreshSession.updateMany({ where: { membershipId: { in: memberships.map((item) => item.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.organizationService.updateMany({ where: { organizationId, deletedAt: null }, data: { status: "DISABLED", disabledAt: new Date(), deletedAt: new Date() } });
      return tx.organization.update({ where: { id: organizationId, deletedAt: null }, data: { status: "DISABLED", deletedAt: new Date() } });
    });
  }

  async setOrganizationService(organizationId: string, serviceId: string, enabled: boolean, actorUserId: string) {
    const existing = await prisma.organizationService.findUnique({ where: { organizationId_serviceId: { organizationId, serviceId } } });
    if (existing) {
      return prisma.organizationService.update({
        where: { organizationId_serviceId: { organizationId, serviceId } },
        data: enabled
          ? { status: "ENABLED", enabledAt: new Date(), disabledAt: null, deletedAt: null, updatedById: actorUserId }
          : { status: "DISABLED", disabledAt: new Date(), updatedById: actorUserId },
      });
    }
    if (!enabled) return null;
    return prisma.organizationService.create({
      data: { organizationId, serviceId, createdById: actorUserId, updatedById: actorUserId },
    });
  }
}
