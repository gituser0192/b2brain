import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export const authContextInclude = {
  organization: true,
  role: { include: { permissions: { include: { permission: true } } } },
  user: true,
} satisfies Prisma.OrganizationMembershipInclude;

export type DbClient = PrismaClient | Prisma.TransactionClient;
export type MembershipContext = Prisma.OrganizationMembershipGetPayload<{ include: typeof authContextInclude }>;

export class AuthRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(work);
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findPlatformInvitation(tokenHash: string) {
    return this.db.platformInvitation.findUnique({ where: { tokenHash } });
  }

  findActiveContextForUser(userId: string) {
    return this.db.organizationMembership.findFirst({
      where: {
        userId, status: "ACTIVE",
        user: { status: "ACTIVE", deletedAt: null },
        organization: { status: "ACTIVE", deletedAt: null },
      },
      include: authContextInclude,
      orderBy: { joinedAt: "asc" },
    });
  }

  findActiveContextByMembership(id: string) {
    return this.db.organizationMembership.findFirst({
      where: {
        id, status: "ACTIVE",
        user: { status: "ACTIVE", deletedAt: null },
        organization: { status: "ACTIVE", deletedAt: null },
      },
      include: authContextInclude,
    });
  }

  findSession(tokenHash: string) {
    return this.db.refreshSession.findUnique({ where: { tokenHash } });
  }

  createSession(client: DbClient | undefined, data: Prisma.RefreshSessionUncheckedCreateInput) {
    return (client ?? this.db).refreshSession.create({ data });
  }

  rotateSession(oldId: string, replacementId: string) {
    return this.db.refreshSession.update({
      where: { id: oldId, revokedAt: null },
      data: { revokedAt: new Date(), replacedBySessionId: replacementId, lastUsedAt: new Date() },
    });
  }

  revokeSession(tokenHash: string) {
    return this.db.refreshSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      return tx.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
    });
  }

  findPasswordReset(tokenHash: string) { return this.db.passwordResetToken.findUnique({ where: { tokenHash } }); }

  resetPassword(userId: string, resetId: string, passwordHash: string) {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: resetId, userId, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
  }
}
