import { prisma } from "../../database/prisma.js";

export class SettingsRepository {
  overview(userId: string, membershipId: string, organizationId: string) {
    return prisma.organizationMembership.findFirst({ where: { id: membershipId, userId, organizationId, status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null }, organization: { status: "ACTIVE", deletedAt: null } }, include: { user: true, organization: true, role: { include: { permissions: { include: { permission: true } } } }, serviceAccess: { include: { service: { select: { code: true, name: true } } } } } });
  }
  updateProfile(userId: string, data: { firstName: string; lastName: string | null }) { return prisma.user.updateMany({ where: { id: userId, status: "ACTIVE", deletedAt: null }, data }); }
  updateBusiness(organizationId: string, data: Parameters<typeof prisma.organization.update>[0]["data"]) { return prisma.organization.update({ where: { id: organizationId }, data }); }
  userForPassword(userId: string) { return prisma.user.findFirst({ where: { id: userId, status: "ACTIVE", deletedAt: null }, select: { id: true, passwordHash: true } }); }
  changePasswordAndRevoke(userId: string, passwordHash: string) { return prisma.$transaction(async tx => { await tx.user.update({ where: { id: userId }, data: { passwordHash } }); return tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }); }
  revokeAll(userId: string) { return prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
}
