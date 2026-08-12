import { prisma } from "../../database/prisma.js";

export class ServiceRepository {
  async assignedServiceIds(organizationId: string, membershipId: string) {
    return (await prisma.membershipServiceAccess.findMany({ where: { organizationId, membershipId }, select: { serviceId: true } })).map((item) => item.serviceId);
  }
  catalog() {
    return prisma.service.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      include: { featureFlags: { orderBy: { code: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  async enabledForOrganization(organizationId: string) {
    const plan = await prisma.organizationPlan.findUnique({ where: { organizationId } });
    if (plan) {
      const expired = plan.status === "PAST_DUE" || plan.status === "CANCELED" || plan.status === "EXPIRED" || (plan.status === "TRIAL" && Boolean(plan.trialEndsAt && plan.trialEndsAt <= new Date())) || Boolean(plan.expiresAt && plan.expiresAt <= new Date());
      if (expired) {
        if (!["PAST_DUE", "EXPIRED", "CANCELED"].includes(plan.status)) await prisma.organizationPlan.update({ where: { organizationId }, data: { status: "EXPIRED" } });
        return [];
      }
    }
    return prisma.organizationService.findMany({
      where: {
        organizationId,
        status: "ENABLED",
        deletedAt: null,
        service: { status: "ACTIVE", archivedAt: null },
      },
      include: {
        service: {
          include: {
            featureFlags: {
              include: {
                entitlements: {
                  where: { organizationId, enabled: true, deletedAt: null },
                  select: { key: true, enabled: true, limits: true },
                },
              },
              orderBy: { code: "asc" },
            },
          },
        },
      },
      orderBy: { service: { sortOrder: "asc" } },
    });
  }
}
