import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";
import type { UpdateOrganizationInput } from "./organization.validation.js";
import type { CompleteOnboardingInput } from "./organization.validation.js";

export class OrganizationRepository {
  findCurrent(organizationId: string) {
    return prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
  }

  updateCurrent(organizationId: string, input: UpdateOrganizationInput) {
    const data: Prisma.OrganizationUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    };
    return prisma.organization.update({ where: { id: organizationId, deletedAt: null }, data });
  }

  completeOnboarding(organizationId: string, userId: string, input: CompleteOnboardingInput) {
    const names = input.ownerName.split(/\s+/);
    const firstName = names.shift()!;
    const lastName = names.join(" ") || null;
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.organization.updateMany({
        where: { id: organizationId, status: "ACTIVE", deletedAt: null, onboardingCompletedAt: null },
        data: {
          name: input.businessName,
          industry: input.industry,
          phone: input.phone,
          businessSize: input.businessSize,
          monthlyRevenueRange: input.monthlyRevenueRange,
          primaryBusinessGoal: input.primaryBusinessGoal,
          timezone: input.timezone,
          currency: input.currency,
          onboardingCompletedAt: new Date(),
        },
      });
      if (claimed.count !== 1) return null;
      await tx.user.update({ where: { id: userId, status: "ACTIVE", deletedAt: null }, data: { firstName, lastName } });
      return tx.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    });
  }
}
