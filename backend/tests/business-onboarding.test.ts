import { describe, expect, it, vi } from "vitest";
import { completeOnboardingSchema } from "../src/modules/organizations/organization.validation.js";
import { OrganizationService } from "../src/modules/organizations/organization.service.js";

const valid = {
  businessName: "Acme Retail",
  ownerName: "Asha Sharma",
  industry: "Retail",
  phone: "+91 98765 43210",
  businessSize: "2_TO_10" as const,
  monthlyRevenueRange: "1_TO_5_LAKH" as const,
  primaryBusinessGoal: "GROW_SALES" as const,
  timezone: "Asia/Kolkata" as const,
  currency: "INR" as const,
};

const organization = { id: "org-1", name: "Acme Retail", slug: "acme", status: "ACTIVE", timezone: "Asia/Kolkata", currency: "INR", isServiceProvider: false, industry: "Retail", phone: "+91 98765 43210", businessSize: "2_TO_10", monthlyRevenueRange: "1_TO_5_LAKH", primaryBusinessGoal: "GROW_SALES", onboardingCompletedAt: new Date(), deletedAt: null };

describe("business owner onboarding", () => {
  it("accepts the supported profile and supplies India defaults", () => {
    expect(completeOnboardingSchema.parse({ ...valid, timezone: undefined, currency: undefined })).toMatchObject({ timezone: "Asia/Kolkata", currency: "INR" });
  });

  it("rejects ownership identifiers supplied by a client", () => {
    expect(() => completeOnboardingSchema.parse({ ...valid, organizationId: "org-other", userId: "user-other", membershipId: "membership-other" })).toThrow();
  });

  it("returns an already completed profile without writing again", async () => {
    const repository = { findCurrent: vi.fn().mockResolvedValue(organization), completeOnboarding: vi.fn() };
    const service = new OrganizationService(repository as never);
    await expect(service.completeOnboarding("org-1", "user-1", valid)).resolves.toMatchObject({ onboardingCompleted: true });
    expect(repository.completeOnboarding).not.toHaveBeenCalled();
  });

  it("can resume an incomplete profile and completes it for authenticated IDs", async () => {
    const repository = { findCurrent: vi.fn().mockResolvedValue({ ...organization, onboardingCompletedAt: null }), completeOnboarding: vi.fn().mockResolvedValue(organization) };
    const service = new OrganizationService(repository as never);
    await service.completeOnboarding("org-auth", "user-auth", valid);
    expect(repository.completeOnboarding).toHaveBeenCalledWith("org-auth", "user-auth", valid);
  });

  it("does not complete onboarding when the active organization cannot be claimed", async () => {
    const repository = { findCurrent: vi.fn().mockResolvedValueOnce({ ...organization, onboardingCompletedAt: null }).mockResolvedValueOnce(null), completeOnboarding: vi.fn().mockResolvedValue(null) };
    const service = new OrganizationService(repository as never);
    await expect(service.completeOnboarding("suspended-org", "user-1", valid)).rejects.toMatchObject({ code: "ONBOARDING_CONFLICT" });
  });
});
