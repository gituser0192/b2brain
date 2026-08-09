import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import type { ListCustomerQuery } from "./customer.validation.js";

const customerInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.CustomerInclude;

export class CustomerRepository {
  async list(organizationId: string, query: ListCustomerQuery) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: query.archived ? { not: null } : null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: [
        { displayName: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q, mode: "insensitive" } },
        { companyName: { contains: query.q, mode: "insensitive" } },
      ] } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({ where, include: customerInclude, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.customer.count({ where }),
    ]);
    return { items, total };
  }
  find(organizationId: string, id: string, includeArchived = false) {
    return prisma.customer.findFirst({ where: { id, organizationId, ...(includeArchived ? {} : { deletedAt: null }) }, include: customerInclude });
  }
  create(data: Prisma.CustomerUncheckedCreateInput) { return prisma.customer.create({ data, include: customerInclude }); }
  update(organizationId: string, id: string, data: Prisma.CustomerUncheckedUpdateInput) { return prisma.customer.update({ where: { id, organizationId, deletedAt: null }, data, include: customerInclude }); }
  archive(organizationId: string, id: string, updatedById: string) { return prisma.customer.updateMany({ where: { id, organizationId, deletedAt: null }, data: { deletedAt: new Date(), updatedById } }); }
  restore(organizationId: string, id: string, updatedById: string) { return prisma.customer.updateMany({ where: { id, organizationId, deletedAt: { not: null } }, data: { deletedAt: null, updatedById } }); }
  permanentlyDelete(organizationId: string, id: string) { return prisma.customer.deleteMany({ where: { id, organizationId, deletedAt: { not: null } } }); }
}

export type CustomerRecord = Awaited<ReturnType<CustomerRepository["find"]>>;
