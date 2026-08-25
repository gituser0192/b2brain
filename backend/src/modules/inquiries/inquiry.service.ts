import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  ContactInput,
  ConversionInput,
  FollowUpInput,
  InquiryInput,
  MergeMessageInput,
} from "./inquiry.validation.js";
import { LeadAssignmentService } from "./lead-assignment.service.js";
const assignmentService = new LeadAssignmentService();
const include = {
  customer: {
    select: { id: true, displayName: true, email: true, phone: true },
  },
  campaign: { select: { id: true, name: true } },
  assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
  convertedDeal: { select: { id: true, name: true } },
  convertedTicket: { select: { id: true, ticketNumber: true } },
  timeline: {
    orderBy: { createdAt: "desc" as const },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  },
  assignmentHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { actorUser: { select: { firstName: true, lastName: true } } },
  },
};
export class InquiryService {
  private async duplicate(org: string, input: InquiryInput) {
    const recent = await prisma.inquiry.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        status: { in: ["NEW", "REVIEWING", "QUALIFIED"] },
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
      select: {
        id: true,
        contactName: true,
        email: true,
        phone: true,
        subject: true,
      },
    });
    const digits = (value: string | null) => value?.replace(/\D/g, "") ?? "";
    const subject = input.subject.trim().replace(/\s+/g, " ").toLowerCase();
    return (
      recent.find((candidate) => {
        const inputPhone = digits(input.phone);
        const candidatePhone = digits(candidate.phone);
        const sameContact =
          Boolean(
            input.email &&
            candidate.email &&
            input.email.toLowerCase() === candidate.email.toLowerCase(),
          ) ||
          Boolean(
            inputPhone.length >= 7 &&
            candidatePhone.length >= 7 &&
            inputPhone === candidatePhone,
          );
        return (
          sameContact &&
          candidate.subject.trim().replace(/\s+/g, " ").toLowerCase() ===
            subject
        );
      }) ?? null
    );
  }
  private async refs(org: string, input: InquiryInput) {
    const [e, c] = await Promise.all([
      input.assignedEmployeeId
        ? prisma.employee.findFirst({
            where: {
              id: input.assignedEmployeeId,
              organizationId: org,
              deletedAt: null,
              status: "ACTIVE",
            },
          })
        : null,
      input.campaignId
        ? prisma.marketingCampaign.findFirst({
            where: {
              id: input.campaignId,
              organizationId: org,
              deletedAt: null,
            },
          })
        : null,
    ]);
    if (input.assignedEmployeeId && !e)
      throw new AppError(
        404,
        "Assigned employee was not found.",
        "EMPLOYEE_NOT_FOUND",
      );
    if (input.campaignId && !c)
      throw new AppError(404, "Campaign was not found.", "CAMPAIGN_NOT_FOUND");
  }
  private async match(org: string, email: string | null, phone: string | null) {
    const candidates = await prisma.customer.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        OR: [
          ...(email
            ? [{ email: { equals: email, mode: "insensitive" as const } }]
            : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true, displayName: true, email: true, phone: true },
    });
    const digits = (v: string | null) => v?.replace(/\D/g, "") || "";
    return (
      candidates.find(
        (c) =>
          (email && c.email?.toLowerCase() === email.toLowerCase()) ||
          (phone && digits(c.phone) === digits(phone)),
      ) ?? null
    );
  }
  async list(org: string, user: string) {
    await assignmentService.escalateDue(org, user);
    const now = new Date();
    const [inquiries, employees, campaigns] = await Promise.all([
      prisma.inquiry.findMany({
        where: { organizationId: org, deletedAt: null },
        include,
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.employee.findMany({
        where: { organizationId: org, deletedAt: null, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      }),
      prisma.marketingCampaign.findMany({
        where: { organizationId: org, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const converted = inquiries.filter((i) => i.status === "CONVERTED").length;
    return {
      inquiries,
      employees,
      campaigns,
      metrics: {
        new: inquiries.filter((i) => i.status === "NEW").length,
        reviewing: inquiries.filter((i) => i.status === "REVIEWING").length,
        qualified: inquiries.filter((i) => i.status === "QUALIFIED").length,
        overdue: inquiries.filter(
          (i) =>
            i.responseDueAt &&
            i.responseDueAt < now &&
            !i.firstRespondedAt &&
            !["CONVERTED", "DISQUALIFIED", "SPAM"].includes(i.status),
        ).length,
        followUpsDue: inquiries.filter(
          (i) =>
            i.nextFollowUpAt &&
            i.nextFollowUpAt < now &&
            !i.followUpCompletedAt &&
            !["CONVERTED", "DISQUALIFIED", "SPAM"].includes(i.status),
        ).length,
        converted,
        conversionRate: inquiries.length
          ? (converted / inquiries.length) * 100
          : 0,
      },
    };
  }
  async create(
    org: string,
    user: string,
    input: InquiryInput,
    allowDuplicate = false,
  ) {
    await this.refs(org, input);
    const duplicate = await this.duplicate(org, input);
    if (duplicate && !allowDuplicate)
      throw new AppError(
        409,
        "A matching open inquiry already exists.",
        "DUPLICATE_INQUIRY",
        {
          inquiryId: duplicate.id,
          contactName: duplicate.contactName,
          subject: duplicate.subject,
        },
      );
    const match = await this.match(org, input.email, input.phone);
    const created = await prisma.inquiry.create({
      data: {
        ...input,
        organizationId: org,
        customerId: match?.id ?? null,
        createdById: user,
        updatedById: user,
        timeline: {
          create: {
            organizationId: org,
            type: "CREATED",
            summary: match
              ? `Inquiry captured; possible customer match: ${match.displayName}`
              : "Inquiry captured",
            createdById: user,
          },
        },
      },
      include,
    });
    await assignmentService.assignNewInquiry(org, user, created);
    return prisma.inquiry.findFirst({
      where: { id: created.id, organizationId: org },
      include,
    });
  }
  async mergeMessage(
    org: string,
    user: string,
    id: string,
    input: MergeMessageInput,
  ) {
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
        status: { in: ["NEW", "REVIEWING", "QUALIFIED"] },
      },
    });
    if (!inquiry)
      throw new AppError(
        404,
        "Open inquiry was not found.",
        "INQUIRY_NOT_FOUND",
      );
    return prisma.$transaction(async (tx) => {
      await tx.inquiry.update({ where: { id }, data: { updatedById: user } });
      return tx.inquiryTimeline.create({
        data: {
          organizationId: org,
          inquiryId: id,
          type: "NOTE",
          summary: `Additional ${input.source.toLowerCase()} message received`,
          details: input.message,
          createdById: user,
        },
      });
    });
  }
  async update(org: string, user: string, id: string, input: InquiryInput) {
    await this.refs(org, input);
    const current = await prisma.inquiry.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!current)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    if (current.status === "CONVERTED")
      throw new AppError(
        409,
        "Converted inquiries cannot be edited.",
        "INQUIRY_CONVERTED",
      );
    const events = [];
    if (current.status !== input.status)
      events.push({
        organizationId: org,
        type: "STATUS_CHANGED" as const,
        summary: `Status changed from ${current.status} to ${input.status}`,
        createdById: user,
      });
    if (current.type !== input.type)
      events.push({
        organizationId: org,
        type: "CLASSIFIED" as const,
        summary: `Classified as ${input.type}`,
        createdById: user,
      });
    if (current.assignedEmployeeId !== input.assignedEmployeeId)
      events.push({
        organizationId: org,
        type: "ASSIGNED" as const,
        summary: input.assignedEmployeeId
          ? "Inquiry assignment changed"
          : "Inquiry unassigned",
        createdById: user,
      });
    const match = await this.match(org, input.email, input.phone);
    return prisma.inquiry.update({
      where: { id },
      data: {
        ...input,
        customerId: match?.id ?? null,
        firstRespondedAt:
          current.firstRespondedAt ??
          (current.status === "NEW" && input.status !== "NEW"
            ? new Date()
            : null),
        updatedById: user,
        timeline: { create: events },
      },
      include,
    });
  }
  async note(org: string, user: string, id: string, note: string) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    return prisma.inquiryTimeline.create({
      data: {
        organizationId: org,
        inquiryId: id,
        type: "NOTE",
        summary: "Internal note added",
        details: note,
        createdById: user,
      },
    });
  }
  async contact(org: string, user: string, id: string, input: ContactInput) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    if (["CONVERTED", "DISQUALIFIED", "SPAM"].includes(inquiry.status))
      throw new AppError(
        409,
        "Closed inquiries cannot receive new contact activity.",
        "INQUIRY_CLOSED",
      );
    return prisma.$transaction(async (tx) => {
      const event = await tx.inquiryTimeline.create({
        data: {
          organizationId: org,
          inquiryId: id,
          type: "CONTACT_LOGGED",
          summary: `${input.channel}: ${input.summary}`,
          details: input.details,
          createdById: user,
        },
      });
      await tx.inquiry.update({
        where: { id },
        data: {
          firstRespondedAt: inquiry.firstRespondedAt ?? new Date(),
          status: inquiry.status === "NEW" ? "REVIEWING" : inquiry.status,
          updatedById: user,
        },
      });
      return event;
    });
  }
  async scheduleFollowUp(
    org: string,
    user: string,
    id: string,
    input: FollowUpInput,
  ) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    if (["CONVERTED", "DISQUALIFIED", "SPAM"].includes(inquiry.status))
      throw new AppError(
        409,
        "Closed inquiries cannot schedule follow-ups.",
        "INQUIRY_CLOSED",
      );
    return prisma.inquiry.update({
      where: { id },
      data: {
        nextFollowUpAt: input.dueAt,
        followUpNote: input.note,
        followUpCompletedAt: null,
        updatedById: user,
        timeline: {
          create: {
            organizationId: org,
            type: "FOLLOW_UP_SCHEDULED",
            summary: `Follow-up scheduled for ${input.dueAt.toISOString()}`,
            details: input.note,
            createdById: user,
          },
        },
      },
      include,
    });
  }
  async completeFollowUp(org: string, user: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.inquiry.updateMany({
        where: {
          id,
          organizationId: org,
          deletedAt: null,
          nextFollowUpAt: { not: null },
          followUpCompletedAt: null,
        },
        data: { followUpCompletedAt: new Date(), updatedById: user },
      });
      if (result.count !== 1)
        throw new AppError(
          404,
          "Open inquiry follow-up was not found.",
          "FOLLOW_UP_NOT_FOUND",
        );
      return tx.inquiryTimeline.create({
        data: {
          organizationId: org,
          inquiryId: id,
          type: "FOLLOW_UP_COMPLETED",
          summary: "Follow-up completed",
          createdById: user,
        },
      });
    });
  }
  private async service(org: string, code: string) {
    const enabled = await prisma.organizationService.findFirst({
      where: {
        organizationId: org,
        status: "ENABLED",
        service: { code, status: "ACTIVE", archivedAt: null },
      },
    });
    if (!enabled)
      throw new AppError(
        403,
        `${code} service must be enabled before conversion.`,
        "TARGET_SERVICE_DISABLED",
      );
  }
  async convert(org: string, user: string, id: string, input: ConversionInput) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id, organizationId: org, deletedAt: null },
    });
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    if (inquiry.status !== "QUALIFIED")
      throw new AppError(
        409,
        "Only qualified inquiries can be converted.",
        "INQUIRY_NOT_QUALIFIED",
      );
    if (input.target === "DEAL") await this.service(org, "SALES");
    if (input.target === "SUPPORT") await this.service(org, "SUPPORT");
    return prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findFirst({
        where: {
          id,
          organizationId: org,
          deletedAt: null,
          status: "QUALIFIED",
        },
        include: { assignedEmployee: { select: { linkedUserId: true } } },
      });
      if (!current)
        throw new AppError(
          409,
          "This inquiry is no longer available for conversion.",
          "INQUIRY_ALREADY_CONVERTED",
        );
      let customerId = current.customerId;
      if (!customerId) {
        const match = await tx.customer.findFirst({
          where: {
            organizationId: org,
            deletedAt: null,
            OR: [
              ...(current.email
                ? [
                    {
                      email: {
                        equals: current.email,
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
              ...(current.phone ? [{ phone: current.phone }] : []),
            ],
          },
          orderBy: { createdAt: "asc" },
        });
        const customer =
          match ??
          (await tx.customer.create({
            data: {
              organizationId: org,
              type: current.companyName ? "COMPANY" : "PERSON",
              displayName: current.companyName || current.contactName,
              companyName: current.companyName,
              email: current.email,
              phone: current.phone,
              status: "LEAD",
              createdById: user,
              updatedById: user,
            },
          }));
        customerId = customer.id;
      }
      let dealId = null,
        ticketId = null;
      if (input.target === "DEAL") {
        const existingDeal = await tx.deal.findFirst({
          where: {
            organizationId: org,
            customerId,
            name: { equals: input.name, mode: "insensitive" },
            stage: { notIn: ["WON", "LOST"] },
            deletedAt: null,
          },
        });
        if (existingDeal)
          throw new AppError(
            409,
            "An open deal with this name already exists for the customer.",
            "DUPLICATE_DEAL",
          );
        const deal = await tx.deal.create({
          data: {
            organizationId: org,
            customerId,
            name: input.name,
            amount: input.amount,
            currency: input.currency.toUpperCase(),
            probability: input.probability,
            expectedCloseDate: input.expectedCloseDate
              ? new Date(input.expectedCloseDate)
              : null,
            ownerId: current.assignedEmployee?.linkedUserId ?? user,
            createdById: user,
            updatedById: user,
          },
        });
        dealId = deal.id;
      }
      if (input.target === "SUPPORT") {
        const ticket = await tx.supportTicket.create({
          data: {
            organizationId: org,
            customerId,
            ticketNumber: `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
            subject: input.subject,
            description: input.description,
            channel: "MANUAL",
            priority: input.priority,
            status: "OPEN",
            createdById: user,
            updatedById: user,
          },
        });
        ticketId = ticket.id;
      }
      const activeEnrollments = await tx.followUpEnrollment.findMany({
        where: { organizationId: org, inquiryId: id, status: "ACTIVE" },
        select: { id: true },
      });
      const enrollmentIds = activeEnrollments.map((item) => item.id);
      if (enrollmentIds.length) {
        await tx.followUpEnrollment.updateMany({
          where: {
            organizationId: org,
            id: { in: enrollmentIds },
            status: "ACTIVE",
          },
          data: {
            status: "STOPPED",
            stoppedAt: new Date(),
            stopReason: "Inquiry converted.",
            nextStepAt: null,
            updatedById: user,
          },
        });
        await tx.followUpExecution.updateMany({
          where: {
            organizationId: org,
            enrollmentId: { in: enrollmentIds },
            status: { in: ["SCHEDULED", "DUE", "AWAITING_APPROVAL"] },
          },
          data: { status: "CANCELED", outcome: "Inquiry converted." },
        });
      }
      const converted = await tx.inquiry.update({
        where: { id },
        data: {
          customerId,
          convertedDealId: dealId,
          convertedTicketId: ticketId,
          status: "CONVERTED",
          nextFollowUpAt: null,
          followUpCompletedAt: new Date(),
          updatedById: user,
          timeline: {
            create: {
              organizationId: org,
              type: "CONVERTED",
              summary: `Converted to ${input.target.toLowerCase()}`,
              createdById: user,
            },
          },
        },
        include,
      });
      await tx.customerActivity.create({
        data: {
          organizationId: org,
          customerId,
          type: "NOTE",
          summary: `Inquiry converted to ${input.target.toLowerCase()}`,
          details: current.subject,
          createdById: user,
          updatedById: user,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: org,
          actorType: "USER",
          actorUserId: user,
          serviceCode:
            input.target === "DEAL"
              ? "SALES"
              : input.target === "SUPPORT"
                ? "SUPPORT"
                : "CRM",
          actionCode: "INQUIRY_CONVERTED",
          sourceType: "INQUIRY",
          sourceId: id,
          summary: `Converted inquiry ${current.subject} to ${input.target.toLowerCase()}.`,
          beforeState: { status: "QUALIFIED", customerId: current.customerId },
          afterState: { status: "CONVERTED", customerId, dealId, ticketId },
          metadata: { stoppedFollowUpEnrollments: enrollmentIds.length },
        },
      });
      return converted;
    });
  }
  async archive(org: string, user: string, id: string) {
    if (
      (
        await prisma.inquiry.updateMany({
          where: { id, organizationId: org, deletedAt: null },
          data: { deletedAt: new Date(), updatedById: user },
        })
      ).count !== 1
    )
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
  }
}
