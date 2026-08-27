import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/modules/settings/settings.service.js";

const owner = { userId: "00000000-0000-4000-8000-000000000001", membershipId: "00000000-0000-4000-8000-000000000002", organizationId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: ["ORGANIZATION_UPDATE"], isPlatformAdmin: false };
const member = { ...owner, userId: "00000000-0000-4000-8000-000000000004", membershipId: "00000000-0000-4000-8000-000000000005", roleCode: "MEMBER", permissions: [] };
const business = { name: "Local Business", industry: "Retail", phone: "+91 9000000000", businessSize: "2_TO_10" as const, monthlyRevenueRange: "1_TO_5_LAKH" as const, primaryBusinessGoal: "GROW_SALES" as const, timezone: "Asia/Kolkata" as const, currency: "INR" as const };

describe("settings authorization and identity scope", () => {
  const repository = { overview: vi.fn(), updateProfile: vi.fn(), updateBusiness: vi.fn(), userForPassword: vi.fn(), changePasswordAndRevoke: vi.fn(), revokeAll: vi.fn() };
  beforeEach(() => { vi.clearAllMocks(); repository.updateProfile.mockResolvedValue({ count: 1 }); repository.revokeAll.mockResolvedValue({ count: 3 }); });
  it("takes profile and session identity only from authenticated context", async () => {
    const service = new SettingsService(repository as never);
    repository.overview.mockResolvedValue({ user: { id: owner.userId, firstName: "Harsh", lastName: null, email: "owner@example.com" }, organization: { id: owner.organizationId, name: "Org", industry: null, phone: null, businessSize: null, monthlyRevenueRange: null, primaryBusinessGoal: null, timezone: "Asia/Kolkata", currency: "INR" }, status: "ACTIVE", id: owner.membershipId, role: { code: "ORGANIZATION_OWNER", name: "Owner", permissions: [] }, serviceAccess: [] });
    await service.updateProfile(owner, { firstName: "Updated", lastName: null });
    await service.signOutAll(owner);
    expect(repository.updateProfile).toHaveBeenCalledWith(owner.userId, { firstName: "Updated", lastName: null });
    expect(repository.revokeAll).toHaveBeenCalledWith(owner.userId);
  });
  it("blocks a normal member from changing organization settings", async () => {
    const service = new SettingsService(repository as never);
    await expect(service.updateBusiness(member, business)).rejects.toMatchObject({ statusCode: 403, code: "ORGANIZATION_OWNER_REQUIRED" });
    expect(repository.updateBusiness).not.toHaveBeenCalled();
  });
  it("rejects an incorrect current password and revokes sessions after a valid change", async () => {
    const service = new SettingsService(repository as never), passwordHash = await argon2.hash("Current123");
    repository.userForPassword.mockResolvedValue({ id: owner.userId, passwordHash }); repository.changePasswordAndRevoke.mockResolvedValue({ count: 2 });
    await expect(service.changePassword(owner, { currentPassword: "Wrong123", newPassword: "Newpass456" })).rejects.toMatchObject({ statusCode: 401, code: "CURRENT_PASSWORD_INCORRECT" });
    const result = await service.changePassword(owner, { currentPassword: "Current123", newPassword: "Newpass456" });
    expect(result).toEqual({ sessionsRevoked: 2, signInRequired: true });
    expect(repository.changePasswordAndRevoke).toHaveBeenCalledWith(owner.userId, expect.any(String));
  });
});
