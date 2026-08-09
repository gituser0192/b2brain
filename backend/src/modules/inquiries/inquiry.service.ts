import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ConversionInput, InquiryInput } from "./inquiry.validation.js";
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
};
export class InquiryService {
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
  async list(org: string) {
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
        converted,
        conversionRate: inquiries.length
          ? (converted / inquiries.length) * 100
          : 0,
      },
    };
  }
  async create(org: string, user: string, input: InquiryInput) {
    await this.refs(org, input);
    const match = await this.match(org, input.email, input.phone);
    return prisma.inquiry.create({
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
    return prisma.inquiry.update({
      where: { id },
      data: {
        ...input,
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
    return prisma.$transaction(async (tx) => {
      let customerId = inquiry.customerId;
      if (!customerId) {
        const customer = await tx.customer.create({
          data: {
            organizationId: org,
            type: inquiry.companyName ? "COMPANY" : "PERSON",
            displayName: inquiry.companyName || inquiry.contactName,
            companyName: inquiry.companyName,
            email: inquiry.email,
            phone: inquiry.phone,
            status: "LEAD",
            createdById: user,
            updatedById: user,
          },
        });
        customerId = customer.id;
      }
      let dealId = null,
        ticketId = null;
      if (input.target === "DEAL") {
        await this.service(org, "SALES");
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
            ownerId: user,
            createdById: user,
            updatedById: user,
          },
        });
        dealId = deal.id;
      }
      if (input.target === "SUPPORT") {
        await this.service(org, "SUPPORT");
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
      return tx.inquiry.update({
        where: { id },
        data: {
          customerId,
          convertedDealId: dealId,
          convertedTicketId: ticketId,
          status: "CONVERTED",
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
