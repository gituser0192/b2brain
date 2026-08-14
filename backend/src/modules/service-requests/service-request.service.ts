import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  CreateServiceRequestInput,
  CustomerApprovalInput,
  CustomerServiceMessageInput,
} from "./service-request.validation.js";

export class ServiceRequestService {
  async list(organizationId: string) {
    const requests = await prisma.providerServiceRequest.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        requestNumber: true,
        category: true,
        subject: true,
        description: true,
        priority: true,
        status: true,
        customerUpdate: true,
        firstRespondedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        responseDueAt: true,
        resolutionDueAt: true,
        approvalStatus: true,
        completionSummary: true,
        completionEvidenceUrl: true,
        verificationResult: true,
        createdBy: { select: { firstName: true, lastName: true } },
        messages: {
          where: { organizationId, customerVisible: true, deletedAt: null },
          select: {
            id: true,
            type: true,
            body: true,
            createdAt: true,
            createdBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        events: {
          where: { customerVisible: true },
          select: { id: true, type: true, summary: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { requests };
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateServiceRequestInput,
  ) {
    const requestNumber = `B2-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const now = new Date();
    const responseHours =
      input.priority === "URGENT" ? 2 : input.priority === "HIGH" ? 4 : 8;
    const resolutionHours =
      input.priority === "URGENT" ? 24 : input.priority === "HIGH" ? 48 : 72;
    return prisma.providerServiceRequest.create({
      data: {
        organizationId,
        requestNumber,
        ...input,
        customerUpdate: "Your request has been securely submitted to B² Brain.",
        responseDueAt: new Date(now.getTime() + responseHours * 3600000),
        resolutionDueAt: new Date(now.getTime() + resolutionHours * 3600000),
        createdById: userId,
        updatedById: userId,
        messages: {
          create: {
            organizationId,
            type: "SYSTEM_EVENT",
            body: "Request submitted to B² Brain",
            customerVisible: true,
            createdById: userId,
          },
        },
        events: {
          create: {
            organizationId,
            type: "CREATED",
            summary: "Customer submitted the service request",
            customerVisible: true,
            actorUserId: userId,
          },
        },
      },
      select: { id: true, requestNumber: true },
    });
  }

  async message(
    organizationId: string,
    userId: string,
    requestId: string,
    input: CustomerServiceMessageInput,
  ) {
    const request = await prisma.providerServiceRequest.findFirst({
      where: { id: requestId, organizationId, deletedAt: null },
    });
    if (!request)
      throw new AppError(
        404,
        "Service request was not found.",
        "SERVICE_REQUEST_NOT_FOUND",
      );
    if (["COMPLETED", "CANCELED"].includes(request.status))
      throw new AppError(
        409,
        "This request is closed.",
        "SERVICE_REQUEST_CLOSED",
      );
    return prisma.$transaction(async (tx) => {
      const message = await tx.providerServiceMessage.create({
        data: {
          organizationId,
          requestId,
          type: "CUSTOMER_MESSAGE",
          body: input.body,
          customerVisible: true,
          createdById: userId,
        },
      });
      await tx.providerServiceRequest.updateMany({
        where: { id: requestId, organizationId },
        data: {
          status:
            request.status === "WAITING_CUSTOMER"
              ? "IN_PROGRESS"
              : request.status,
          updatedById: userId,
        },
      });
      return message;
    });
  }
  async approval(
    organizationId: string,
    userId: string,
    requestId: string,
    input: CustomerApprovalInput,
  ) {
    const request = await prisma.providerServiceRequest.findFirst({
      where: {
        id: requestId,
        organizationId,
        deletedAt: null,
        approvalStatus: "PENDING_CUSTOMER",
      },
      select: { id: true },
    });
    if (!request)
      throw new AppError(
        409,
        "This request is not awaiting customer approval.",
        "CUSTOMER_APPROVAL_NOT_AVAILABLE",
      );
    const status = input.approved ? "APPROVED" : "REJECTED";
    await prisma.$transaction(async (tx) => {
      await tx.providerServiceRequest.updateMany({
        where: { id: requestId, organizationId, deletedAt: null },
        data: {
          approvalStatus: status,
          approvalNote: input.note,
          approvalDecidedById: userId,
          approvalDecidedAt: new Date(),
          status: input.approved ? "IN_PROGRESS" : "WAITING_CUSTOMER",
          updatedById: userId,
        },
      });
      await tx.providerRequestEvent.create({
        data: {
          organizationId,
          requestId,
          type: "APPROVAL_DECIDED",
          summary: `Customer ${input.approved ? "approved" : "rejected"} the proposed action: ${input.note}`,
          customerVisible: true,
          actorUserId: userId,
        },
      });
    });
    return { id: requestId, approvalStatus: status };
  }
}
