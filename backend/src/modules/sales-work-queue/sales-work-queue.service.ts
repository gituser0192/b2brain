import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { SalesQueueQuery } from "./sales-work-queue.validation.js";

type QueueItem = {
  id: string;
  sourceId: string;
  type: "INQUIRY" | "CRM_FOLLOW_UP" | "DEAL" | "APPOINTMENT";
  title: string;
  contact: string;
  detail: string | null;
  dueAt: Date | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner: string | null;
  customerId: string | null;
  value: number | null;
  currency: string | null;
  view: "inquiries" | "crm" | "sales" | "calendar";
  canComplete: boolean;
  score: number;
};

const person = (
  value: { firstName: string; lastName: string | null } | null | undefined,
) => (value ? `${value.firstName} ${value.lastName ?? ""}`.trim() : null);

export class SalesWorkQueueService {
  async list(
    organizationId: string,
    actorUserId: string,
    permissions: string[],
    query: SalesQueueQuery,
  ) {
    const enabledCodes = new Set(
      (
        await prisma.organizationService.findMany({
          where: {
            organizationId,
            status: "ENABLED",
            deletedAt: null,
            service: { status: "ACTIVE", archivedAt: null },
          },
          select: { service: { select: { code: true } } },
        })
      ).map((item) => item.service.code),
    );
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + query.horizonDays);
    const mine = query.scope === "MINE";

    const [followUps, inquiries, deals, appointments] = await Promise.all([
      enabledCodes.has("CRM") && permissions.includes("CRM_ACTIVITY_VIEW")
        ? prisma.customerFollowUp.findMany({
            where: {
              organizationId,
              status: "PENDING",
              deletedAt: null,
              dueAt: { lte: horizon },
              ...(mine ? { assignedToId: actorUserId } : {}),
            },
            include: {
              customer: { select: { id: true, displayName: true } },
              assignedTo: { select: { firstName: true, lastName: true } },
            },
            take: 200,
          })
        : [],
      enabledCodes.has("LEADS") && permissions.includes("INQUIRY_VIEW")
        ? prisma.inquiry.findMany({
            where: {
              organizationId,
              deletedAt: null,
              status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] },
              OR: [
                { responseDueAt: { lte: horizon }, firstRespondedAt: null },
                { nextFollowUpAt: { lte: horizon }, followUpCompletedAt: null },
              ],
              ...(mine
                ? { assignedEmployee: { linkedUserId: actorUserId } }
                : {}),
            },
            include: {
              assignedEmployee: { select: { firstName: true, lastName: true } },
            },
            take: 200,
          })
        : [],
      prisma.deal.findMany({
        where: {
          organizationId,
          deletedAt: null,
          stage: { notIn: ["WON", "LOST"] },
          ...(mine ? { ownerId: actorUserId } : {}),
        },
        include: {
          customer: { select: { id: true, displayName: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
        take: 200,
      }),
      enabledCodes.has("CALENDAR") && permissions.includes("CALENDAR_VIEW")
        ? prisma.calendarEvent.findMany({
            where: {
              organizationId,
              deletedAt: null,
              status: "SCHEDULED",
              startAt: { gte: now, lte: horizon },
              AND: [
                { OR: [{ dealId: { not: null } }, { customerId: { not: null } }] },
                ...(mine
                  ? [{ OR: [
                      { createdById: actorUserId },
                      {
                        attendees: {
                          some: { employee: { linkedUserId: actorUserId } },
                        },
                      },
                    ] }]
                  : []),
              ],
            },
            include: {
              customer: { select: { id: true, displayName: true } },
              deal: { select: { amount: true, currency: true } },
            },
            take: 200,
          })
        : [],
    ]);

    const rank = (
      dueAt: Date | null,
      priority: QueueItem["priority"],
      value = 0,
    ) =>
      (dueAt && dueAt < now
        ? 1000
        : dueAt && dueAt < tomorrowStart
          ? 700
          : dueAt
            ? 300
            : 50) +
      { URGENT: 200, HIGH: 120, MEDIUM: 60, LOW: 10 }[priority] +
      Math.min(100, Math.log10(Math.max(1, value)) * 15);
    const items: QueueItem[] = [];
    for (const item of followUps)
      items.push({
        id: `CRM_FOLLOW_UP:${item.id}`,
        sourceId: item.id,
        type: "CRM_FOLLOW_UP",
        title: item.title,
        contact: item.customer.displayName,
        detail: item.description,
        dueAt: item.dueAt,
        priority: item.dueAt < now ? "URGENT" : "MEDIUM",
        owner: person(item.assignedTo),
        customerId: item.customer.id,
        value: null,
        currency: null,
        view: "crm",
        canComplete: permissions.includes("CRM_FOLLOWUP_MANAGE"),
        score: rank(item.dueAt, item.dueAt < now ? "URGENT" : "MEDIUM"),
      });
    for (const item of inquiries) {
      const responseDue = !item.firstRespondedAt ? item.responseDueAt : null;
      const followUpDue = !item.followUpCompletedAt
        ? item.nextFollowUpAt
        : null;
      const dueAt =
        [responseDue, followUpDue]
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      items.push({
        id: `INQUIRY:${item.id}`,
        sourceId: item.id,
        type: "INQUIRY",
        title: item.subject,
        contact: item.contactName,
        detail:
          responseDue && responseDue.getTime() === dueAt?.getTime()
            ? "First response required"
            : item.followUpNote,
        dueAt,
        priority: item.priority,
        owner: item.assignedEmployee
          ? `${item.assignedEmployee.firstName} ${item.assignedEmployee.lastName ?? ""}`.trim()
          : null,
        customerId: item.customerId,
        value: null,
        currency: null,
        view: "inquiries",
        canComplete: Boolean(
          followUpDue && permissions.includes("INQUIRY_MANAGE"),
        ),
        score: rank(dueAt, item.priority),
      });
    }
    for (const item of deals) {
      const value = Number(item.amount);
      const dueAt = item.expectedCloseDate;
      const priority: QueueItem["priority"] =
        dueAt && dueAt < now
          ? "HIGH"
          : item.probability >= 70
            ? "HIGH"
            : "MEDIUM";
      items.push({
        id: `DEAL:${item.id}`,
        sourceId: item.id,
        type: "DEAL",
        title: item.name,
        contact: item.customer.displayName,
        detail: `${item.stage.replaceAll("_", " ")} · ${item.probability}% probability`,
        dueAt,
        priority,
        owner: person(item.owner),
        customerId: item.customer.id,
        value,
        currency: item.currency,
        view: "sales",
        canComplete: false,
        score: rank(dueAt, priority, value),
      });
    }
    for (const item of appointments) {
      const value = item.deal ? Number(item.deal.amount) : null;
      items.push({
        id: `APPOINTMENT:${item.id}`,
        sourceId: item.id,
        type: "APPOINTMENT",
        title: item.title,
        contact: item.customer?.displayName ?? "Sales appointment",
        detail:
          item.location ??
          item.meetingUrl ??
          item.locationType.replaceAll("_", " "),
        dueAt: item.startAt,
        priority: item.startAt < tomorrowStart ? "HIGH" : "MEDIUM",
        owner: null,
        customerId: item.customerId,
        value,
        currency: item.deal?.currency ?? null,
        view: "calendar",
        canComplete: false,
        score: rank(
          item.startAt,
          item.startAt < tomorrowStart ? "HIGH" : "MEDIUM",
          value ?? 0,
        ),
      });
    }
    items.sort(
      (a, b) =>
        b.score - a.score ||
        (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );
    return {
      items,
      metrics: {
        total: items.length,
        overdue: items.filter((item) => item.dueAt && item.dueAt < now).length,
        dueToday: items.filter(
          (item) =>
            item.dueAt &&
            item.dueAt >= todayStart &&
            item.dueAt < tomorrowStart,
        ).length,
        unassigned: items.filter(
          (item) => !item.owner && item.type === "INQUIRY",
        ).length,
        forecastAtRisk: items
          .filter(
            (item) => item.type === "DEAL" && item.dueAt && item.dueAt < now,
          )
          .reduce((total, item) => total + (item.value ?? 0), 0),
      },
      sources: {
        inquiries:
          enabledCodes.has("LEADS") && permissions.includes("INQUIRY_VIEW"),
        crmFollowUps:
          enabledCodes.has("CRM") && permissions.includes("CRM_ACTIVITY_VIEW"),
        deals: true,
        appointments:
          enabledCodes.has("CALENDAR") && permissions.includes("CALENDAR_VIEW"),
      },
    };
  }

  async completeCrmFollowUp(
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.customerFollowUp.updateMany({
        where: { id, organizationId, status: "PENDING", deletedAt: null },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          updatedById: actorUserId,
        },
      });
      if (updated.count)
        await tx.notification.updateMany({
          where: {
            organizationId,
            sourceType: "CUSTOMER_FOLLOW_UP",
            sourceId: id,
          },
          data: { deletedAt: new Date(), updatedById: actorUserId },
        });
      return updated;
    });
    if (result.count !== 1)
      throw new AppError(
        404,
        "Pending CRM follow-up was not found.",
        "FOLLOW_UP_NOT_FOUND",
      );
  }

  async completeInquiryFollowUp(
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    const result = await prisma.inquiry.updateMany({
      where: {
        id,
        organizationId,
        deletedAt: null,
        followUpCompletedAt: null,
        nextFollowUpAt: { not: null },
      },
      data: { followUpCompletedAt: new Date(), updatedById: actorUserId },
    });
    if (result.count !== 1)
      throw new AppError(
        404,
        "Pending inquiry follow-up was not found.",
        "INQUIRY_FOLLOW_UP_NOT_FOUND",
      );
  }
}
