import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  ApprovalInput,
  DeploymentInput,
  RequestInput,
  WebsiteInput,
} from "./website.validation.js";
export class WebsiteService {
  async list(organizationId: string, archived: boolean) {
    const now = new Date();
    const [websites, customers, employees, projects] = await Promise.all([
      prisma.managedWebsite.findMany({
        where: { organizationId, deletedAt: archived ? { not: null } : null },
        include: {
          customer: { select: { id: true, displayName: true } },
          assignedEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          requests: {
            where: { deletedAt: null },
            include: {
              project: { select: { id: true, code: true, name: true } },
              deployments: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { createdAt: "desc" },
          },
          deployments: { orderBy: { createdAt: "desc" }, take: 10 },
        },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.employee.findMany({
        where: { organizationId, status: "ACTIVE", deletedAt: null },
        select: { id: true, firstName: true, lastName: true, jobTitle: true },
        orderBy: { firstName: "asc" },
      }),
      prisma.project.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const requests = websites.flatMap((item) => item.requests),
      deployments = websites.flatMap((item) => item.deployments);
    const customerSafeWebsites = websites.map((website) => ({
      ...website,
      requests: website.requests.map((request) => ({
        ...request,
        providerInternalNote: undefined,
        providerAssignedToId: undefined,
      })),
    }));
    return {
      websites: customerSafeWebsites,
      customers,
      employees,
      projects,
      metrics: {
        websites: websites.length,
        active: websites.filter((item) => item.status === "ACTIVE").length,
        pendingApproval: requests.filter(
          (item) => item.status === "AWAITING_APPROVAL",
        ).length,
        overdue: requests.filter(
          (item) =>
            item.deadline &&
            item.deadline < now &&
            !["DEPLOYED", "REJECTED", "CANCELED"].includes(item.status),
        ).length,
        failedDeployments: deployments.filter(
          (item) => item.status === "FAILED",
        ).length,
      },
    };
  }
  private async references(organizationId: string, input: WebsiteInput) {
    const [customer, employee] = await Promise.all([
      input.customerId
        ? prisma.customer.findFirst({
            where: { id: input.customerId, organizationId, deletedAt: null },
          })
        : null,
      input.assignedEmployeeId
        ? prisma.employee.findFirst({
            where: {
              id: input.assignedEmployeeId,
              organizationId,
              status: "ACTIVE",
              deletedAt: null,
            },
          })
        : null,
    ]);
    if (input.customerId && !customer)
      throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    if (input.assignedEmployeeId && !employee)
      throw new AppError(404, "Employee was not found.", "EMPLOYEE_NOT_FOUND");
  }
  async createWebsite(
    organizationId: string,
    userId: string,
    input: WebsiteInput,
  ) {
    await this.references(organizationId, input);
    return prisma.managedWebsite.create({
      data: {
        ...input,
        customerId: input.customerId ?? null,
        assignedEmployeeId: input.assignedEmployeeId ?? null,
        organizationId,
        createdById: userId,
        updatedById: userId,
      },
    });
  }
  async updateWebsite(
    organizationId: string,
    userId: string,
    id: string,
    input: WebsiteInput,
  ) {
    await this.references(organizationId, input);
    if (
      (
        await prisma.managedWebsite.updateMany({
          where: { id, organizationId, deletedAt: null },
          data: {
            ...input,
            customerId: input.customerId ?? null,
            assignedEmployeeId: input.assignedEmployeeId ?? null,
            updatedById: userId,
          },
        })
      ).count !== 1
    )
      throw new AppError(404, "Website was not found.", "WEBSITE_NOT_FOUND");
  }
  async createRequest(
    organizationId: string,
    userId: string,
    input: RequestInput,
  ) {
    const [website, project] = await Promise.all([
      prisma.managedWebsite.findFirst({
        where: { id: input.websiteId, organizationId, deletedAt: null },
      }),
      input.projectId
        ? prisma.project.findFirst({
            where: { id: input.projectId, organizationId, deletedAt: null },
          })
        : null,
    ]);
    if (!website)
      throw new AppError(404, "Website was not found.", "WEBSITE_NOT_FOUND");
    if (input.projectId && !project)
      throw new AppError(404, "Project was not found.", "PROJECT_NOT_FOUND");
    const requestNumber = `WEB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    return prisma.websiteChangeRequest.create({
      data: {
        ...input,
        projectId: input.projectId ?? null,
        organizationId,
        requestNumber,
        createdById: userId,
        updatedById: userId,
      },
    });
  }
  async updateRequest(
    organizationId: string,
    userId: string,
    id: string,
    input: RequestInput,
  ) {
    const current = await prisma.websiteChangeRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!current)
      throw new AppError(
        404,
        "Change request was not found.",
        "REQUEST_NOT_FOUND",
      );
    if (["APPROVED", "DEPLOYED"].includes(current.status))
      throw new AppError(
        409,
        "Approved or deployed requests cannot be edited.",
        "REQUEST_LOCKED",
      );
    if (current.websiteId !== input.websiteId)
      throw new AppError(
        400,
        "A change request cannot be moved to another website.",
        "WEBSITE_CHANGE_NOT_ALLOWED",
      );
    if (
      input.projectId &&
      !(await prisma.project.findFirst({
        where: { id: input.projectId, organizationId, deletedAt: null },
      }))
    )
      throw new AppError(404, "Project was not found.", "PROJECT_NOT_FOUND");
    return prisma.websiteChangeRequest.update({
      where: { id },
      data: {
        ...input,
        projectId: input.projectId ?? null,
        updatedById: userId,
      },
    });
  }
  async submitToProvider(organizationId: string, userId: string, id: string) {
    const current = await prisma.websiteChangeRequest.findFirst({
      where: { id, organizationId, deletedAt: null, website: { deletedAt: null } },
    });
    if (!current)
      throw new AppError(404, "Change request was not found.", "REQUEST_NOT_FOUND");
    if (current.submittedToProviderAt)
      throw new AppError(409, "This request has already been submitted to B² Brain.", "REQUEST_ALREADY_SUBMITTED");
    if (["REJECTED", "CANCELED", "DEPLOYED"].includes(current.status))
      throw new AppError(409, "This request cannot be submitted in its current state.", "REQUEST_NOT_SUBMITTABLE");
    const now = new Date();
    return prisma.websiteChangeRequest.update({
      where: { id },
      data: {
        submittedToProviderAt: now,
        providerStatus: "SUBMITTED",
        providerCustomerUpdate: "Your request has been received by B² Brain Operations.",
        providerUpdatedAt: now,
        updatedById: userId,
      },
    });
  }

  async approve(
    organizationId: string,
    userId: string,
    id: string,
    input: ApprovalInput,
  ) {
    const current = await prisma.websiteChangeRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!current)
      throw new AppError(
        404,
        "Change request was not found.",
        "REQUEST_NOT_FOUND",
      );
    if (current.status !== "AWAITING_APPROVAL")
      throw new AppError(
        409,
        "Only requests awaiting approval can be approved or rejected.",
        "APPROVAL_NOT_AVAILABLE",
      );
    return prisma.websiteChangeRequest.update({
      where: { id },
      data: {
        status: input.approved ? "APPROVED" : "REJECTED",
        approvalNotes: input.notes,
        approvedById: input.approved ? userId : null,
        approvedAt: input.approved ? new Date() : null,
        updatedById: userId,
      },
    });
  }
  async deploy(
    organizationId: string,
    userId: string,
    websiteId: string,
    input: DeploymentInput,
  ) {
    const request = await prisma.websiteChangeRequest.findFirst({
      where: {
        id: input.requestId,
        websiteId,
        organizationId,
        deletedAt: null,
      },
    });
    if (!request)
      throw new AppError(
        404,
        "Approved change request was not found.",
        "REQUEST_NOT_FOUND",
      );
    if (input.environment === "PRODUCTION" && request.status !== "APPROVED")
      throw new AppError(
        409,
        "Production deployment requires explicit change-request approval.",
        "PRODUCTION_APPROVAL_REQUIRED",
      );
    if (
      input.environment !== "PRODUCTION" &&
      !["AWAITING_APPROVAL", "APPROVED"].includes(request.status)
    )
      throw new AppError(
        409,
        "Preview and staging deployments require a prepared request.",
        "REQUEST_NOT_READY",
      );
    return prisma.$transaction(async (tx) => {
      const deployment = await tx.websiteDeployment.create({
        data: {
          ...input,
          organizationId,
          websiteId,
          createdById: userId,
          startedAt: [
            "IN_PROGRESS",
            "SUCCEEDED",
            "FAILED",
            "ROLLED_BACK",
          ].includes(input.status)
            ? new Date()
            : null,
          completedAt: ["SUCCEEDED", "FAILED", "ROLLED_BACK"].includes(
            input.status,
          )
            ? new Date()
            : null,
        },
      });
      if (input.environment === "PRODUCTION" && input.status === "SUCCEEDED")
        await tx.websiteChangeRequest.update({
          where: { id: request.id },
          data: { status: "DEPLOYED", updatedById: userId },
        });
      return deployment;
    });
  }
  async archive(organizationId: string, userId: string, id: string) {
    if (
      (
        await prisma.managedWebsite.updateMany({
          where: { id, organizationId, deletedAt: null },
          data: { deletedAt: new Date(), updatedById: userId },
        })
      ).count !== 1
    )
      throw new AppError(404, "Website was not found.", "WEBSITE_NOT_FOUND");
  }
  async restore(organizationId: string, userId: string, id: string) {
    if (
      (
        await prisma.managedWebsite.updateMany({
          where: { id, organizationId, deletedAt: { not: null } },
          data: { deletedAt: null, updatedById: userId },
        })
      ).count !== 1
    )
      throw new AppError(
        404,
        "Archived website was not found.",
        "WEBSITE_NOT_FOUND",
      );
  }
}
