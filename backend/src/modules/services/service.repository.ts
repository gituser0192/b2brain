import { prisma } from "../../database/prisma.js";

export class ServiceRepository {
  catalog() {
    return prisma.service.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      include: { featureFlags: { orderBy: { code: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  enabledForOrganization(organizationId: string) {
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
