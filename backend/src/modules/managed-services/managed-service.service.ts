import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ManagedServiceUpdateInput, ProviderReplyInput } from "./managed-service.validation.js";

export class ManagedServiceDeskService {
  async list() {
    const [requests, serviceRequests, operators] = await Promise.all([
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
      prisma.providerServiceRequest.findMany({
        where: { deletedAt: null },
        select: {
          id: true, organizationId: true, requestNumber: true, category: true, subject: true, description: true,
          priority: true, status: true, assignedToId: true, customerUpdate: true, internalNote: true,
          firstRespondedAt: true, completedAt: true, createdAt: true, updatedAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { firstName: true, lastName: true, email: true } },
          messages: { where: { deletedAt: null }, select: { id: true, type: true, body: true, customerVisible: true, createdAt: true, createdBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.user.findMany({
        where: { isPlatformAdmin: true, status: "ACTIVE", deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: "asc" },
      }),
    ]);
    return {
      requests,
      serviceRequests,
      operators,
      metrics: {
        total: requests.length + serviceRequests.length,
        new: requests.filter((item) => item.providerStatus === "SUBMITTED").length + serviceRequests.filter((item) => item.status === "SUBMITTED").length,
        active: requests.filter((item) => ["TRIAGED", "IN_PROGRESS"].includes(item.providerStatus ?? "")).length + serviceRequests.filter((item) => ["TRIAGED", "IN_PROGRESS"].includes(item.status)).length,
        waiting: requests.filter((item) => ["WAITING_CUSTOMER", "AWAITING_CUSTOMER_APPROVAL"].includes(item.providerStatus ?? "")).length + serviceRequests.filter((item) => ["WAITING_CUSTOMER", "AWAITING_CUSTOMER_APPROVAL"].includes(item.status)).length,
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

  async updateServiceRequest(id: string, actorUserId: string, input: ManagedServiceUpdateInput) {
    const current = await prisma.providerServiceRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true, organizationId: true, createdById: true, firstRespondedAt: true } });
    if (!current) throw new AppError(404, "Service request was not found.", "SERVICE_REQUEST_NOT_FOUND");
    if (input.assignedToId) {
      const operator = await prisma.user.findFirst({ where: { id: input.assignedToId, isPlatformAdmin: true, status: "ACTIVE", deletedAt: null }, select: { id: true } });
      if (!operator) throw new AppError(404, "B² Brain operator was not found.", "OPERATOR_NOT_FOUND");
    }
    const now = new Date();
    await prisma.providerServiceRequest.updateMany({
      where: { id, organizationId: current.organizationId, deletedAt: null },
      data: { status: input.status, assignedToId: input.assignedToId, customerUpdate: input.customerUpdate, internalNote: input.internalNote, completedAt: input.status === "COMPLETED" ? now : null, updatedById: actorUserId },
    });
    return { id, status: input.status };
  }

  async replyToServiceRequest(id: string, actorUserId: string, input: ProviderReplyInput) {
    const current = await prisma.providerServiceRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true, organizationId: true, createdById: true, firstRespondedAt: true, status: true } });
    if (!current) throw new AppError(404, "Service request was not found.", "SERVICE_REQUEST_NOT_FOUND");
    if (["COMPLETED", "CANCELED"].includes(current.status)) throw new AppError(409, "This request is closed.", "SERVICE_REQUEST_CLOSED");
    const visible = input.type === "PROVIDER_REPLY";
    return prisma.$transaction(async (tx) => {
      const message = await tx.providerServiceMessage.create({ data: { organizationId: current.organizationId, requestId: id, type: input.type, body: input.body, customerVisible: visible, createdById: actorUserId } });
      await tx.providerServiceRequest.updateMany({ where: { id, organizationId: current.organizationId }, data: { firstRespondedAt: visible && !current.firstRespondedAt ? new Date() : current.firstRespondedAt, status: visible && current.status === "SUBMITTED" ? "IN_PROGRESS" : current.status, ...(visible ? { customerUpdate: input.body } : {}), updatedById: actorUserId } });
      if (visible) await tx.notification.upsert({ where: { organizationId_recipientId_sourceType_sourceId: { organizationId: current.organizationId, recipientId: current.createdById, sourceType: "PROVIDER_SERVICE_REQUEST", sourceId: id } }, create: { organizationId: current.organizationId, recipientId: current.createdById, type: "SYSTEM", title: "B² Brain replied to your request", message: input.body, sourceType: "PROVIDER_SERVICE_REQUEST", sourceId: id, actionPath: "/dashboard", createdById: actorUserId, updatedById: actorUserId }, update: { message: input.body, availableAt: new Date(), readAt: null, updatedById: actorUserId } });
      return message;
    });
  }
}
