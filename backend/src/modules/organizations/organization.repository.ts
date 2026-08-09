import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";
import type { UpdateOrganizationInput } from "./organization.validation.js";

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
}
