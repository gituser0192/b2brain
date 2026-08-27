import argon2 from "argon2";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthContext } from "../auth/auth.types.js";
import { SettingsRepository } from "./settings.repository.js";
import type { BusinessProfileInput, ChangePasswordInput, PersonalProfileInput } from "./settings.validation.js";

export class SettingsService {
  constructor(private repository = new SettingsRepository()) {}
  async overview(context: AuthContext) {
    const membership = await this.repository.overview(context.userId, context.membershipId, context.organizationId);
    if (!membership) throw new AppError(404, "Settings were not found.", "SETTINGS_NOT_FOUND");
    return { user: { id: membership.user.id, firstName: membership.user.firstName, lastName: membership.user.lastName, email: membership.user.email }, organization: { id: membership.organization.id, name: membership.organization.name, industry: membership.organization.industry, phone: membership.organization.phone, businessSize: membership.organization.businessSize, monthlyRevenueRange: membership.organization.monthlyRevenueRange, primaryBusinessGoal: membership.organization.primaryBusinessGoal, timezone: membership.organization.timezone, currency: membership.organization.currency }, membership: { id: membership.id, status: membership.status, role: { code: membership.role.code, name: membership.role.name }, permissions: membership.role.permissions.map(item => item.permission.code), services: membership.serviceAccess.map(item => ({ code: item.service.code, name: item.service.name, accessMode: item.accessMode })) }, canManageBusiness: context.roleCode === "ORGANIZATION_OWNER" && context.permissions.includes("ORGANIZATION_UPDATE") };
  }
  async updateProfile(context: AuthContext, input: PersonalProfileInput) {
    if ((await this.repository.updateProfile(context.userId, input)).count !== 1) throw new AppError(404, "Profile was not found.", "PROFILE_NOT_FOUND");
    return this.overview(context);
  }
  async updateBusiness(context: AuthContext, input: BusinessProfileInput) {
    if (context.roleCode !== "ORGANIZATION_OWNER" || !context.permissions.includes("ORGANIZATION_UPDATE")) throw new AppError(403, "Organization owner access is required.", "ORGANIZATION_OWNER_REQUIRED");
    await this.overview(context);
    await this.repository.updateBusiness(context.organizationId, { name: input.name, industry: input.industry, phone: input.phone, timezone: input.timezone, currency: input.currency, ...(input.businessSize !== undefined ? { businessSize: input.businessSize } : {}), ...(input.monthlyRevenueRange !== undefined ? { monthlyRevenueRange: input.monthlyRevenueRange } : {}), ...(input.primaryBusinessGoal !== undefined ? { primaryBusinessGoal: input.primaryBusinessGoal } : {}) });
    return this.overview(context);
  }
  async changePassword(context: AuthContext, input: ChangePasswordInput) {
    const user = await this.repository.userForPassword(context.userId);
    if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword))) throw new AppError(401, "Current password is incorrect.", "CURRENT_PASSWORD_INCORRECT");
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id, timeCost: Math.max(2, Math.min(5, env.PASSWORD_HASH_COST - 9)), memoryCost: 65_536, parallelism: 1 });
    const revoked = await this.repository.changePasswordAndRevoke(context.userId, passwordHash);
    return { sessionsRevoked: revoked.count, signInRequired: true };
  }
  async signOutAll(context: AuthContext) { const revoked = await this.repository.revokeAll(context.userId); return { sessionsRevoked: revoked.count, signInRequired: true }; }
}
