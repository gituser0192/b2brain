import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  CreateProviderWorkInput,
  ManagedServiceUpdateInput,
  ProviderApprovalInput,
  ProviderCompletionInput,
  ProviderReplyInput,
} from "./managed-service.validation.js";

export class ManagedServiceDeskService {
  async list() {
    const [requests, serviceRequests, operators] = await Promise.all([
      prisma.websiteChangeRequest.findMany({
        where: {
          submittedToProviderAt: { not: null },
          deletedAt: null,
          website: { deletedAt: null },
        },
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
          website: {
            select: {
              id: true,
              name: true,
              domain: true,
              platform: true,
              status: true,
            },
          },
        },
        orderBy: [
          { providerUpdatedAt: "desc" },
          { submittedToProviderAt: "desc" },
        ],
      }),
      prisma.providerServiceRequest.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          organizationId: true,
          requestNumber: true,
          category: true,
          subject: true,
          description: true,
          priority: true,
          status: true,
          assignedToId: true,
          customerUpdate: true,
          internalNote: true,
          firstRespondedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          responseDueAt: true,
          resolutionDueAt: true,
          workOrganizationId: true,
          workProjectId: true,
          workTaskId: true,
          approvalStatus: true,
          approvalNote: true,
          completionSummary: true,
          completionEvidenceUrl: true,
          verificationResult: true,
          organization: { select: { id: true, name: true, slug: true } },
          createdBy: {
            select: { firstName: true, lastName: true, email: true },
          },
          messages: {
            where: { deletedAt: null },
            select: {
              id: true,
              type: true,
              body: true,
              customerVisible: true,
              createdAt: true,
              createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          events: {
            select: {
              id: true,
              type: true,
              summary: true,
              customerVisible: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
          workProject: {
            select: { id: true, code: true, name: true, status: true },
          },
          workTask: {
            select: { id: true, title: true, status: true, dueDate: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.organizationMembership.findMany({
        where: {
          organization: {
            isServiceProvider: true,
            status: "ACTIVE",
            deletedAt: null,
          },
          status: "ACTIVE",
          user: { status: "ACTIVE", deletedAt: null },
          role: {
            permissions: {
              some: {
                permission: {
                  code: {
                    in: ["PROVIDER_REQUEST_WORK", "PROVIDER_REQUEST_MANAGE"],
                  },
                },
              },
            },
          },
        },
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        distinct: ["userId"],
        orderBy: { user: { firstName: "asc" } },
      }),
    ]);
    return {
      requests,
      serviceRequests,
      operators: operators.map((membership) => membership.user),
      metrics: {
        total: requests.length + serviceRequests.length,
        new:
          requests.filter((item) => item.providerStatus === "SUBMITTED")
            .length +
          serviceRequests.filter((item) => item.status === "SUBMITTED").length,
        active:
          requests.filter((item) =>
            ["TRIAGED", "IN_PROGRESS"].includes(item.providerStatus ?? ""),
          ).length +
          serviceRequests.filter((item) =>
            ["TRIAGED", "IN_PROGRESS"].includes(item.status),
          ).length,
        waiting:
          requests.filter((item) =>
            ["WAITING_CUSTOMER", "AWAITING_CUSTOMER_APPROVAL"].includes(
              item.providerStatus ?? "",
            ),
          ).length +
          serviceRequests.filter((item) =>
            ["WAITING_CUSTOMER", "AWAITING_CUSTOMER_APPROVAL"].includes(
              item.status,
            ),
          ).length,
      },
    };
  }

  async update(
    id: string,
    actorUserId: string,
    input: ManagedServiceUpdateInput,
  ) {
    const current = await prisma.websiteChangeRequest.findFirst({
      where: {
        id,
        submittedToProviderAt: { not: null },
        deletedAt: null,
        website: { deletedAt: null },
      },
      select: { id: true, organizationId: true, createdById: true },
    });
    if (!current)
      throw new AppError(
        404,
        "Managed service request was not found.",
        "MANAGED_REQUEST_NOT_FOUND",
      );
    if (input.assignedToId) {
      const operator = await prisma.organizationMembership.findFirst({
        where: {
          userId: input.assignedToId,
          organization: {
            isServiceProvider: true,
            status: "ACTIVE",
            deletedAt: null,
          },
          status: "ACTIVE",
          user: { status: "ACTIVE", deletedAt: null },
          role: {
            permissions: {
              some: {
                permission: {
                  code: {
                    in: ["PROVIDER_REQUEST_WORK", "PROVIDER_REQUEST_MANAGE"],
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!operator)
        throw new AppError(
          404,
          "B² Brain operator was not found.",
          "OPERATOR_NOT_FOUND",
        );
    }
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.websiteChangeRequest.updateMany({
        where: {
          id: current.id,
          organizationId: current.organizationId,
          submittedToProviderAt: { not: null },
          deletedAt: null,
        },
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

  async updateServiceRequest(
    id: string,
    actorUserId: string,
    input: ManagedServiceUpdateInput,
  ) {
    const current = await prisma.providerServiceRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        firstRespondedAt: true,
      },
    });
    if (!current)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    if (input.assignedToId) {
      const operator = await prisma.organizationMembership.findFirst({
        where: {
          userId: input.assignedToId,
          organization: {
            isServiceProvider: true,
            status: "ACTIVE",
            deletedAt: null,
          },
          status: "ACTIVE",
          user: { status: "ACTIVE", deletedAt: null },
          role: {
            permissions: {
              some: {
                permission: {
                  code: {
                    in: ["PROVIDER_REQUEST_WORK", "PROVIDER_REQUEST_MANAGE"],
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!operator)
        throw new AppError(
          404,
          "B² Brain operator was not found.",
          "OPERATOR_NOT_FOUND",
        );
    }
    const now = new Date();
    await prisma.providerServiceRequest.updateMany({
      where: { id, organizationId: current.organizationId, deletedAt: null },
      data: {
        status: input.status,
        assignedToId: input.assignedToId,
        customerUpdate: input.customerUpdate,
        internalNote: input.internalNote,
        completedAt: input.status === "COMPLETED" ? now : null,
        updatedById: actorUserId,
      },
    });
    return { id, status: input.status };
  }

  async replyToServiceRequest(
    id: string,
    actorUserId: string,
    input: ProviderReplyInput,
  ) {
    const current = await prisma.providerServiceRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        firstRespondedAt: true,
        status: true,
      },
    });
    if (!current)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    if (["COMPLETED", "CANCELED"].includes(current.status))
      throw new AppError(
        409,
        "This request is closed.",
        "SERVICE_REQUEST_CLOSED",
      );
    const visible = input.type === "PROVIDER_REPLY";
    return prisma.$transaction(async (tx) => {
      const message = await tx.providerServiceMessage.create({
        data: {
          organizationId: current.organizationId,
          requestId: id,
          type: input.type,
          body: input.body,
          customerVisible: visible,
          createdById: actorUserId,
        },
      });
      await tx.providerRequestEvent.create({
        data: {
          organizationId: current.organizationId,
          requestId: id,
          type: "MESSAGE_SENT",
          summary: visible
            ? "B² Brain replied to the customer"
            : "B² Brain added an internal note",
          customerVisible: visible,
          actorUserId,
        },
      });
      await tx.providerServiceRequest.updateMany({
        where: { id, organizationId: current.organizationId },
        data: {
          firstRespondedAt:
            visible && !current.firstRespondedAt
              ? new Date()
              : current.firstRespondedAt,
          status:
            visible && current.status === "SUBMITTED"
              ? "IN_PROGRESS"
              : current.status,
          ...(visible ? { customerUpdate: input.body } : {}),
          updatedById: actorUserId,
        },
      });
      if (visible)
        await tx.notification.upsert({
          where: {
            organizationId_recipientId_sourceType_sourceId: {
              organizationId: current.organizationId,
              recipientId: current.createdById,
              sourceType: "PROVIDER_SERVICE_REQUEST",
              sourceId: id,
            },
          },
          create: {
            organizationId: current.organizationId,
            recipientId: current.createdById,
            type: "SYSTEM",
            title: "B² Brain replied to your request",
            message: input.body,
            sourceType: "PROVIDER_SERVICE_REQUEST",
            sourceId: id,
            actionPath: "/dashboard",
            createdById: actorUserId,
            updatedById: actorUserId,
          },
          update: {
            message: input.body,
            availableAt: new Date(),
            readAt: null,
            updatedById: actorUserId,
          },
        });
      return message;
    });
  }

  async createWork(
    id: string,
    providerOrganizationId: string,
    actorUserId: string,
    input: CreateProviderWorkInput,
  ) {
    const request = await prisma.providerServiceRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        requestNumber: true,
        subject: true,
        description: true,
        priority: true,
        category: true,
        workTaskId: true,
      },
    });
    if (!request)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    if (request.workTaskId)
      throw new AppError(
        409,
        "Work has already been created for this request.",
        "WORK_ALREADY_CREATED",
      );
    const provider = await prisma.organization.findFirst({
      where: {
        id: providerOrganizationId,
        isServiceProvider: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!provider)
      throw new AppError(
        403,
        "A B² Brain provider workspace is required.",
        "PROVIDER_ACCESS_REQUIRED",
      );
    const assignee = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: providerOrganizationId,
        userId: input.assignedToId,
        status: "ACTIVE",
        user: { status: "ACTIVE", deletedAt: null },
        role: {
          permissions: {
            some: { permission: { code: "PROVIDER_REQUEST_WORK" } },
          },
        },
      },
      select: { userId: true },
    });
    if (!assignee)
      throw new AppError(
        404,
        "Eligible B² Brain assignee was not found.",
        "OPERATOR_NOT_FOUND",
      );
    const dueAt = new Date(input.dueAt);
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: providerOrganizationId,
          customerId: null,
          name: `${request.requestNumber} · ${request.subject}`,
          code: `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          description: `B² Brain delivery work for ${request.category.replaceAll("_", " ")}.`,
          status: "ACTIVE",
          priority: request.priority,
          startDate: new Date(),
          dueDate: dueAt,
          ownerId: actorUserId,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      const task = await tx.projectTask.create({
        data: {
          organizationId: providerOrganizationId,
          projectId: project.id,
          title: request.subject,
          description: `${request.description}\n\nChecklist:\n${input.checklist.map((item) => `- ${item}`).join("\n")}`,
          status: "TODO",
          priority: request.priority,
          assignedToId: input.assignedToId,
          dueDate: dueAt,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      await tx.providerServiceRequest.updateMany({
        where: { id, organizationId: request.organizationId, deletedAt: null },
        data: {
          workOrganizationId: providerOrganizationId,
          workProjectId: project.id,
          workTaskId: task.id,
          assignedToId: input.assignedToId,
          status: "TRIAGED",
          updatedById: actorUserId,
        },
      });
      await tx.providerRequestEvent.create({
        data: {
          organizationId: request.organizationId,
          requestId: id,
          type: "WORK_CREATED",
          summary: `B² Brain created delivery task ${project.code}`,
          customerVisible: true,
          actorUserId,
        },
      });
      return {
        projectId: project.id,
        taskId: task.id,
        projectCode: project.code,
      };
    });
  }

  async approval(
    id: string,
    actorUserId: string,
    input: ProviderApprovalInput,
  ) {
    const request = await prisma.providerServiceRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!request)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    const status =
      input.decision === "REQUEST_INTERNAL"
        ? "PENDING_INTERNAL"
        : input.decision === "REQUEST_CUSTOMER"
          ? "PENDING_CUSTOMER"
          : input.decision === "APPROVE"
            ? "APPROVED"
            : "REJECTED";
    await prisma.$transaction(async (tx) => {
      await tx.providerServiceRequest.updateMany({
        where: { id, organizationId: request.organizationId, deletedAt: null },
        data: {
          approvalStatus: status,
          approvalNote: input.note,
          approvalDecidedById: ["APPROVE", "REJECT"].includes(input.decision)
            ? actorUserId
            : null,
          approvalDecidedAt: ["APPROVE", "REJECT"].includes(input.decision)
            ? new Date()
            : null,
          ...(input.decision === "REQUEST_CUSTOMER"
            ? { status: "AWAITING_CUSTOMER_APPROVAL" as const }
            : {}),
          updatedById: actorUserId,
        },
      });
      await tx.providerRequestEvent.create({
        data: {
          organizationId: request.organizationId,
          requestId: id,
          type: input.decision.startsWith("REQUEST")
            ? "APPROVAL_REQUESTED"
            : "APPROVAL_DECIDED",
          summary: `Approval ${status.replaceAll("_", " ").toLowerCase()}: ${input.note}`,
          customerVisible: input.decision === "REQUEST_CUSTOMER",
          actorUserId,
        },
      });
    });
    return { id, approvalStatus: status };
  }

  async complete(
    id: string,
    providerOrganizationId: string,
    actorUserId: string,
    input: ProviderCompletionInput,
  ) {
    const request = await prisma.providerServiceRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        workOrganizationId: true,
        workTaskId: true,
        approvalStatus: true,
      },
    });
    if (!request)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    if (
      !request.workTaskId ||
      request.workOrganizationId !== providerOrganizationId
    )
      throw new AppError(
        409,
        "Create linked delivery work before completion.",
        "WORK_REQUIRED",
      );
    if (!["APPROVED", "NOT_REQUIRED"].includes(request.approvalStatus))
      throw new AppError(
        409,
        "Required approval has not been granted.",
        "APPROVAL_REQUIRED",
      );
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.projectTask.updateMany({
        where: {
          id: request.workTaskId!,
          organizationId: providerOrganizationId,
          deletedAt: null,
        },
        data: {
          status: "COMPLETED",
          completedAt: now,
          updatedById: actorUserId,
        },
      });
      await tx.providerServiceRequest.updateMany({
        where: { id, organizationId: request.organizationId, deletedAt: null },
        data: {
          status: "COMPLETED",
          completedAt: now,
          completionSummary: input.summary,
          completionEvidenceUrl: input.evidenceUrl,
          verificationResult: input.verification,
          customerUpdate: input.summary,
          updatedById: actorUserId,
        },
      });
      await tx.providerRequestEvent.create({
        data: {
          organizationId: request.organizationId,
          requestId: id,
          type: "COMPLETED",
          summary: `Work completed and verified: ${input.verification}`,
          customerVisible: true,
          actorUserId,
        },
      });
    });
    return { id, status: "COMPLETED" };
  }
}
