import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AuthRepository, type MembershipContext } from "./auth.repository.js";
import { hashRefreshToken, issueAccessToken, newRefreshToken, refreshExpiry } from "./auth.tokens.js";
import { hashPlatformInvitationToken } from "../platform/platform.tokens.js";
import type { AuthContext, LoginInput, RegisterInput, SessionMetadata } from "./auth.types.js";
import type { ForgotPasswordInput, ResetPasswordInput } from "./auth.validation.js";
import { hashPasswordResetToken, newPasswordResetToken, passwordResetExpiry } from "./password-reset.tokens.js";
import { EmailService } from "../../shared/email/email.service.js";

const OWNER_CODE = "ORGANIZATION_OWNER";

function slugBase(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "organization";
}

function toContext(membership: MembershipContext): AuthContext {
  return {
    userId: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    roleCode: membership.role.code,
    permissions: membership.role.permissions.map((item) => item.permission.code),
    isPlatformAdmin: membership.user.isPlatformAdmin,
  };
}

function safeData(membership: MembershipContext) {
  return {
    user: { id: membership.user.id, firstName: membership.user.firstName, lastName: membership.user.lastName, email: membership.user.email, status: membership.user.status, isPlatformAdmin: membership.user.isPlatformAdmin },
    organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug, status: membership.organization.status, timezone: membership.organization.timezone, currency: membership.organization.currency },
    membership: { id: membership.id, role: { code: membership.role.code, name: membership.role.name }, permissions: membership.role.permissions.map((item) => item.permission.code) },
  };
}

export class AuthService {
  constructor(private readonly repository = new AuthRepository(), private readonly email = new EmailService()) {}

  async register(input: RegisterInput) {
    const invitation = await this.repository.findPlatformInvitation(hashPlatformInvitationToken(input.invitationToken));
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new AppError(410, "Registration is invitation-only. This invitation is invalid or expired.", "REGISTRATION_INVITATION_INVALID");
    const existingUser = await this.repository.findUserByEmail(invitation.email);
    if (invitation.type === "NEW_ORGANIZATION" && existingUser) throw new AppError(409, "An account with this email already exists.", "EMAIL_ALREADY_EXISTS");
    if (invitation.type === "REACTIVATE_ORGANIZATION" && (!existingUser || !invitation.organizationId)) throw new AppError(409, "The removed account can no longer be restored from this invitation.", "REACTIVATION_ACCOUNT_NOT_FOUND");
    try {
      return await this.repository.transaction(async (tx) => {
        const claimed = await tx.platformInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
        if (claimed.count !== 1) throw new AppError(410, "Registration is invitation-only. This invitation is invalid or expired.", "REGISTRATION_INVITATION_INVALID");
        const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, timeCost: Math.max(2, Math.min(5, env.PASSWORD_HASH_COST - 9)), memoryCost: 65_536, parallelism: 1 });
        let organization;
        let user;
        if (invitation.type === "REACTIVATE_ORGANIZATION" && existingUser && invitation.organizationId) {
          organization = await tx.organization.update({ where: { id: invitation.organizationId }, data: { status: "PENDING_APPROVAL", deletedAt: null } });
          user = await tx.user.update({ where: { id: existingUser.id }, data: { firstName: input.firstName, lastName: input.lastName ?? null, passwordHash, status: "ACTIVE", deletedAt: null } });
          const ownerRole = await tx.role.findFirstOrThrow({ where: { organizationId: null, code: OWNER_CODE, isSystem: true } });
          await tx.organizationMembership.upsert({
            where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
            update: { status: "ACTIVE", roleId: ownerRole.id, joinedAt: new Date() },
            create: { organizationId: organization.id, userId: user.id, roleId: ownerRole.id },
          });
        } else {
          const suffix = crypto.randomUUID().slice(0, 8);
          organization = await tx.organization.create({ data: { name: invitation.organizationName, slug: `${slugBase(invitation.organizationName)}-${suffix}`, status: "PENDING_APPROVAL" } });
          user = await tx.user.create({ data: { firstName: input.firstName, ...(input.lastName ? { lastName: input.lastName } : {}), email: invitation.email, passwordHash } });
          const role = await tx.role.findFirstOrThrow({ where: { organizationId: null, code: OWNER_CODE, isSystem: true } });
          await tx.organizationMembership.create({ data: { organizationId: organization.id, userId: user.id, roleId: role.id } });
        }
        return { user: { id: user.id, email: user.email }, organization: { id: organization.id, name: organization.name, status: organization.status }, pendingApproval: true as const };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "An account with this email already exists.", "EMAIL_ALREADY_EXISTS", { email: "An account with this email already exists." });
      throw error;
    }
  }

  async registrationInvitation(token: string) {
    const invitation = await this.repository.findPlatformInvitation(hashPlatformInvitationToken(token));
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new AppError(410, "Registration is invitation-only. This invitation is invalid or expired.", "REGISTRATION_INVITATION_INVALID");
    return { email: invitation.email, organizationName: invitation.organizationName, expiresAt: invitation.expiresAt, type: invitation.type };
  }

  async login(input: LoginInput, metadata: SessionMetadata) {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user || user.status !== "ACTIVE" || user.deletedAt || !(await argon2.verify(user.passwordHash, input.password))) throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    const membership = await this.repository.findActiveContextForUser(user.id);
    if (!membership) throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    const refreshToken = newRefreshToken();
    await this.repository.transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.repository.createSession(tx, { userId: user.id, membershipId: membership.id, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry(), ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}), ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}) });
    });
    return { ...safeData(membership), accessToken: issueAccessToken(toContext(membership)), refreshToken };
  }

  async refresh(token: string, metadata: SessionMetadata) {
    const session = await this.repository.findSession(hashRefreshToken(token));
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_REFRESH_SESSION");
    const membership = await this.repository.findActiveContextByMembership(session.membershipId);
    if (!membership) throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_REFRESH_SESSION");
    const refreshToken = newRefreshToken();
    await this.repository.transaction(async (tx) => {
      const replacement = await this.repository.createSession(tx, { userId: session.userId, membershipId: session.membershipId, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry(), ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}), ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}) });
      const claimed = await tx.refreshSession.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date(), replacedBySessionId: replacement.id, lastUsedAt: new Date() } });
      if (claimed.count !== 1) throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_REFRESH_SESSION");
    });
    return { accessToken: issueAccessToken(toContext(membership)), refreshToken };
  }

  async logout(token?: string) { if (token) await this.repository.revokeSession(hashRefreshToken(token)); }
  async forgotPassword(input: ForgotPasswordInput) {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user || user.deletedAt || user.status !== "ACTIVE") return {};
    const token = newPasswordResetToken();
    await this.repository.createPasswordReset(user.id, hashPasswordResetToken(token), passwordResetExpiry());
    const resetPath = `/reset-password?token=${encodeURIComponent(token)}`;
    await this.email.passwordReset(user.email, resetPath);
    return env.NODE_ENV === "development" ? { resetPath } : {};
  }
  async resetPassword(input: ResetPasswordInput) {
    const reset = await this.repository.findPasswordReset(hashPasswordResetToken(input.token));
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new AppError(410, "This password reset link is invalid or expired.", "PASSWORD_RESET_INVALID");
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, timeCost: Math.max(2, Math.min(5, env.PASSWORD_HASH_COST - 9)), memoryCost: 65_536, parallelism: 1 });
    if (!(await this.repository.resetPassword(reset.userId, reset.id, passwordHash))) throw new AppError(410, "This password reset link is invalid or expired.", "PASSWORD_RESET_INVALID");
    return {};
  }
  async me(context: AuthContext) {
    const membership = await this.repository.findActiveContextByMembership(context.membershipId);
    if (!membership || membership.organizationId !== context.organizationId || membership.userId !== context.userId) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    return safeData(membership);
  }
}
