import { AppError } from "../../shared/errors/app-error.js";
import { OrganizationRepository } from "./organization.repository.js";
import type { UpdateOrganizationInput } from "./organization.validation.js";
import type { CompleteOnboardingInput } from "./organization.validation.js";

function safeOrganization(organization: Awaited<ReturnType<OrganizationRepository["findCurrent"]>>) {
  if (!organization) throw new AppError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
  return { id: organization.id, name: organization.name, slug: organization.slug, status: organization.status, timezone: organization.timezone, currency: organization.currency, isServiceProvider: organization.isServiceProvider, industry: organization.industry, phone: organization.phone, businessSize: organization.businessSize, monthlyRevenueRange: organization.monthlyRevenueRange, primaryBusinessGoal: organization.primaryBusinessGoal, onboardingCompleted: Boolean(organization.onboardingCompletedAt) };
}

export class OrganizationService {
  constructor(private readonly repository = new OrganizationRepository()) {}
  async current(organizationId: string) { return safeOrganization(await this.repository.findCurrent(organizationId)); }
  async update(organizationId: string, input: UpdateOrganizationInput) {
    await this.current(organizationId);
    return safeOrganization(await this.repository.updateCurrent(organizationId, input));
  }
  async completeOnboarding(organizationId: string, userId: string, input: CompleteOnboardingInput) {
    const current = await this.repository.findCurrent(organizationId);
    if (!current) throw new AppError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
    if (current.onboardingCompletedAt) return safeOrganization(current);
    const completed = await this.repository.completeOnboarding(organizationId, userId, input);
    if (!completed) {
      const latest = await this.repository.findCurrent(organizationId);
      if (latest?.onboardingCompletedAt) return safeOrganization(latest);
      throw new AppError(409, "Onboarding could not be completed. Sign in again and retry.", "ONBOARDING_CONFLICT");
    }
    return safeOrganization(completed);
  }
}
