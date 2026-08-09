import { prisma } from "../../database/prisma.js";
import type { CreateActivityInput, CreateFollowUpInput, ListFollowUpsQuery, UpdateFollowUpStatusInput } from "./engagement.validation.js";

const actorSelect = { id: true, firstName: true, lastName: true } as const;
export class EngagementRepository {
  async followUpCenter(organizationId: string, actorUserId: string, query: ListFollowUpsQuery) {
    const where = {
      organizationId,
      deletedAt: null,
      customer: { deletedAt: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedToMe ? { assignedToId: actorUserId } : {}),
    };
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const [items, pending, overdue, dueToday, completed] = await Promise.all([
      prisma.customerFollowUp.findMany({ where, include: { customer: { select: { id: true, displayName: true, email: true, phone: true } }, assignedTo: { select: actorSelect } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: query.limit }),
      prisma.customerFollowUp.count({ where: { ...where, status: "PENDING" } }),
      prisma.customerFollowUp.count({ where: { ...where, status: "PENDING", dueAt: { lt: todayStart } } }),
      prisma.customerFollowUp.count({ where: { ...where, status: "PENDING", dueAt: { gte: todayStart, lt: tomorrowStart } } }),
      prisma.customerFollowUp.count({ where: { ...where, status: "COMPLETED" } }),
    ]);
    return { items, metrics: { pending, overdue, dueToday, completed } };
  }
  customer(organizationId: string, customerId: string) { return prisma.customer.findFirst({ where: { id: customerId, organizationId, deletedAt: null }, select: { id: true } }); }
  async timeline(organizationId: string, customerId: string) {
    const [activities, followUps] = await Promise.all([
      prisma.customerActivity.findMany({ where: { organizationId, customerId, deletedAt: null }, include: { createdBy: { select: actorSelect } }, orderBy: { occurredAt: "desc" }, take: 100 }),
      prisma.customerFollowUp.findMany({ where: { organizationId, customerId, deletedAt: null }, include: { assignedTo: { select: actorSelect }, createdBy: { select: actorSelect } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 100 }),
    ]);
    return { activities, followUps };
  }
  createActivity(organizationId: string, customerId: string, actorUserId: string, input: CreateActivityInput) {
    return prisma.customerActivity.create({ data: { organizationId, customerId, createdById: actorUserId, updatedById: actorUserId, ...input }, include: { createdBy: { select: actorSelect } } });
  }
  archiveActivity(organizationId: string, customerId: string, id: string, actorUserId: string) { return prisma.customerActivity.updateMany({ where: { id, organizationId, customerId, deletedAt: null }, data: { deletedAt: new Date(), updatedById: actorUserId } }); }
  createFollowUp(organizationId: string, customerId: string, actorUserId: string, input: CreateFollowUpInput) {
    return prisma.$transaction(async (transaction) => {
      const followUp = await transaction.customerFollowUp.create({ data: { organizationId, customerId, assignedToId: actorUserId, createdById: actorUserId, updatedById: actorUserId, ...input }, include: { assignedTo: { select: actorSelect }, createdBy: { select: actorSelect } } });
      await transaction.notification.create({ data: { organizationId, recipientId: actorUserId, type: "FOLLOW_UP_DUE", title: input.title, message: input.description ?? "A CRM follow-up is due.", sourceType: "CUSTOMER_FOLLOW_UP", sourceId: followUp.id, actionPath: "/dashboard", availableAt: input.dueAt, createdById: actorUserId, updatedById: actorUserId } });
      return followUp;
    });
  }
  updateFollowUpStatus(organizationId: string, customerId: string, id: string, actorUserId: string, input: UpdateFollowUpStatusInput) {
    return prisma.$transaction(async (transaction) => {
      const result = await transaction.customerFollowUp.updateMany({ where: { id, organizationId, customerId, deletedAt: null }, data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : null, updatedById: actorUserId } });
      if (input.status === "PENDING") await transaction.notification.updateMany({ where: { organizationId, sourceType: "CUSTOMER_FOLLOW_UP", sourceId: id }, data: { deletedAt: null, readAt: null, updatedById: actorUserId } });
      else await transaction.notification.updateMany({ where: { organizationId, sourceType: "CUSTOMER_FOLLOW_UP", sourceId: id }, data: { deletedAt: new Date(), updatedById: actorUserId } });
      return result;
    });
  }
  archiveFollowUp(organizationId: string, customerId: string, id: string, actorUserId: string) { return prisma.$transaction(async (transaction) => { const result = await transaction.customerFollowUp.updateMany({ where: { id, organizationId, customerId, deletedAt: null }, data: { deletedAt: new Date(), updatedById: actorUserId } }); await transaction.notification.updateMany({ where: { organizationId, sourceType: "CUSTOMER_FOLLOW_UP", sourceId: id }, data: { deletedAt: new Date(), updatedById: actorUserId } }); return result; }); }
}
