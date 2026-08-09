import { prisma } from "../../database/prisma.js";

export class NotificationRepository {
  async list(organizationId: string, recipientId: string) {
    const now = new Date();
    const where = { organizationId, recipientId, deletedAt: null, availableAt: { lte: now } } as const;
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { availableAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { notifications, unread };
  }
  markRead(organizationId: string, recipientId: string, id: string, actorUserId: string) { return prisma.notification.updateMany({ where: { id, organizationId, recipientId, deletedAt: null, availableAt: { lte: new Date() } }, data: { readAt: new Date(), updatedById: actorUserId } }); }
  markAllRead(organizationId: string, recipientId: string, actorUserId: string) { return prisma.notification.updateMany({ where: { organizationId, recipientId, readAt: null, deletedAt: null, availableAt: { lte: new Date() } }, data: { readAt: new Date(), updatedById: actorUserId } }); }
}
