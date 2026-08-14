import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ManagedServiceUpdateInput } from "./managed-service.validation.js";

export class ManagedServiceDeskService {
  async list() {
    const [requests, operators] = await Promise.all([
      prisma.websiteChangeRequest.findMany({
        where: { submittedToProviderAt: { not: null }, deletedAt: null, website: { deletedAt: null } },
        select: {
          id: true,
          organizationId: true,
          requestNumber: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          risk: true,
          deadline: true,
          submittedToProviderAt: true,
          providerStatus: true,
          providerAssignedToId: true,
          providerCustomerUpdate: true,
          providerInternalNote: true,
          providerUpdatedAt: true,
          providerCompletedAt: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          website: { select: { id: true, name: true, domain: true, platform: true, status: true } },
        },
        orderBy: [{ providerUpdatedAt: "desc" }, { submittedToProviderAt: "desc" }],
      }),
      prisma.user.findMany({
        where: { isPlatformAdmin: true, status: "ACTIVE", deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: "asc" },
      }),
    ]);
    return {
      requests,
      operators,
      metrics: {
        total: requests.length,
        new: requests.filter((item) => item.providerStatus === "SUBMITTED").length,
        active: requests.filter((item) => ["TRIAGED", "IN_PROGRESS"].includes(item.providerStatus ?? "")).length,
        waiting: requests.filter((item) => ["WAITING_CUSTOMER", "AWAITING_CUSTOMER_APPROVAL"].includes(item.providerStatus ?? "")).length,
      },
    };
  }

  async update(id: string, actorUserId: string, input: ManagedServiceUpdateInput) {
    const current = await prisma.websiteChangeRequest.findFirst({
      where: { id, submittedToProviderAt: { not: null }, deletedAt: null, website: { deletedAt: null } },
      select: { id: true, organizationId: true, createdById: true },
    });
    if (!current) throw new AppError(404, "Managed service request was not found.", "MANAGED_REQUEST_NOT_FOUND");
    if (input.assignedToId) {
      const operator = await prisma.user.findFirst({
        where: { id: input.assignedToId, isPlatformAdmin: true, status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      if (!operator) throw new AppError(404, "B² Brain operator was not found.", "OPERATOR_NOT_FOUND");
    }
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.websiteChangeRequest.updateMany({
        where: { id: current.id, organizationId: current.organizationId, submittedToProviderAt: { not: null }, deletedAt: null },
        data: {
          providerStatus: input.status,
          providerAssignedToId: input.assignedToId,
          providerCustomerUpdate: input.customerUpdate,
          providerInternalNote: input.internalNote,
          providerUpdatedAt: now,
          providerCompletedAt: input.status === "COMPLETED" ? now : null,
          updatedById: actorUserId,
        },
      });
      await tx.notification.upsert({
        where: {
          organizationId_recipientId_sourceType_sourceId: {
            organizationId: current.organizationId,
            recipientId: current.createdById,
            sourceType: "MANAGED_WEBSITE_REQUEST",
            sourceId: current.id,
          },
        },
        create: {
          organizationId: current.organizationId,
          recipientId: current.createdById,
          type: "SYSTEM",
          title: `Website request ${input.status.replaceAll("_", " ").toLowerCase()}`,
          message: input.customerUpdate,
          sourceType: "MANAGED_WEBSITE_REQUEST",
          sourceId: current.id,
          actionPath: "/dashboard",
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        update: {
          title: `Website request ${input.status.replaceAll("_", " ").toLowerCase()}`,
          message: input.customerUpdate,
          availableAt: now,
          readAt: null,
          updatedById: actorUserId,
        },
      });
      return tx.websiteChangeRequest.findFirstOrThrow({
        where: { id: current.id, organizationId: current.organizationId },
        select: { id: true, providerStatus: true, providerUpdatedAt: true },
      });
    });
  }
}
