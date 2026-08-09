import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

const roleInclude = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

export class RoleRepository {
  list(organizationId: string) {
    return prisma.role.findMany({
      where: { OR: [{ organizationId: null, isSystem: true }, { organizationId }] },
      include: {
        ...roleInclude,
        _count: { select: { memberships: { where: { organizationId, status: { not: "REMOVED" } } } } },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }
  permissions() { return prisma.permission.findMany({ orderBy: { code: "asc" } }); }
  find(organizationId: string, id: string) {
    return prisma.role.findFirst({
      where: { id, OR: [{ organizationId }, { organizationId: null, isSystem: true }] },
      include: {
        ...roleInclude,
        _count: { select: { memberships: { where: { organizationId, status: { not: "REMOVED" } } } } },
      },
    });
  }
  findPermissions(codes: string[]) { return prisma.permission.findMany({ where: { code: { in: codes } } }); }
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) { return prisma.$transaction(work); }
  memberCount(organizationId: string, roleId: string) { return prisma.organizationMembership.count({ where: { organizationId, roleId, status: { not: "REMOVED" } } }); }
  delete(id: string) { return prisma.role.delete({ where: { id } }); }
}
