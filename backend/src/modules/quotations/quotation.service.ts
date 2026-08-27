import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type QuotationStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { EmailService } from "../../shared/email/email.service.js";
import { WhatsappService } from "../automation-bridge/whatsapp.service.js";
import { InvoiceAutomationService } from "../finance/invoice-automation.service.js";
import type {
  QuotationConversionInput,
  QuotationFollowUpInput,
  QuotationInput,
  QuotationPublicDecisionInput,
  QuotationShareInput,
} from "./quotation.validation.js";

const include = {
  customer: {
    select: { id: true, displayName: true, email: true, phone: true },
  },
  inquiry: { select: { id: true, subject: true, contactName: true } },
  deal: { select: { id: true, name: true, stage: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
  items: true,
} satisfies Prisma.QuotationInclude;

export class QuotationService {
  private email = new EmailService();
  private whatsapp = new WhatsappService();
  private invoiceAutomation = new InvoiceAutomationService();
  private token(id: string, organizationId: string, expiresAt: Date) {
    const payload = Buffer.from(JSON.stringify({ id, organizationId, expiresAt: expiresAt.toISOString() })).toString("base64url");
    const signature = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`quotation:${payload}`).digest("base64url");
    return `${payload}.${signature}`;
  }
  private verifyToken(token: string) {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) throw new AppError(404, "Quotation link is invalid.", "QUOTATION_LINK_INVALID");
    const expected = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`quotation:${payload}`).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      throw new AppError(404, "Quotation link is invalid.", "QUOTATION_LINK_INVALID");
    try {
      const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: string; organizationId: string; expiresAt: string };
      if (new Date(value.expiresAt) <= new Date()) throw new AppError(410, "Quotation link has expired.", "QUOTATION_LINK_EXPIRED");
      return value;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(404, "Quotation link is invalid.", "QUOTATION_LINK_INVALID");
    }
  }
  private async validateContext(
    organizationId: string,
    input: Pick<QuotationInput, "customerId" | "inquiryId" | "dealId">,
  ) {
    const [customer, inquiry, deal] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: input.customerId, organizationId, deletedAt: null },
      }),
      input.inquiryId
        ? prisma.inquiry.findFirst({
            where: { id: input.inquiryId, organizationId, deletedAt: null },
          })
        : null,
      input.dealId
        ? prisma.deal.findFirst({
            where: { id: input.dealId, organizationId, deletedAt: null },
          })
        : null,
    ]);
    if (!customer)
      throw new AppError(404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    if (
      input.inquiryId &&
      (!inquiry ||
        (inquiry.customerId && inquiry.customerId !== input.customerId))
    )
      throw new AppError(
        404,
        "Matching inquiry not found.",
        "INQUIRY_NOT_FOUND",
      );
    if (input.dealId && (!deal || deal.customerId !== input.customerId))
      throw new AppError(404, "Matching deal not found.", "DEAL_NOT_FOUND");
  }

  async list(organizationId: string) {
    const now = new Date();
    await prisma.quotation.updateMany({
      where: {
        organizationId,
        archivedAt: null,
        status: { in: ["DRAFT", "SENT"] },
        validUntil: { lt: now },
      },
      data: { status: "EXPIRED" },
    });
    const [quotations, customers, inquiries, deals] = await Promise.all([
      prisma.quotation.findMany({
        where: { organizationId, archivedAt: null },
        include,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.inquiry.findMany({
        where: { organizationId, deletedAt: null, customerId: { not: null } },
        select: {
          id: true,
          customerId: true,
          contactName: true,
          subject: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.deal.findMany({
        where: { organizationId, deletedAt: null, stage: { not: "LOST" } },
        select: { id: true, customerId: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const active = quotations.filter(
      (item) => !["CANCELED", "REJECTED"].includes(item.status),
    );
    return {
      quotations,
      customers,
      inquiries,
      deals,
      metrics: {
        total: quotations.length,
        draft: quotations.filter((item) => item.status === "DRAFT").length,
        awaitingDecision: quotations.filter((item) => item.status === "SENT")
          .length,
        acceptedValue: quotations
          .filter((item) => ["ACCEPTED", "CONVERTED"].includes(item.status))
          .reduce((sum, item) => sum + Number(item.total), 0),
        openValue: active
          .filter((item) => ["DRAFT", "SENT"].includes(item.status))
          .reduce((sum, item) => sum + Number(item.total), 0),
        expiringSoon: quotations.filter(
          (item) =>
            ["DRAFT", "SENT"].includes(item.status) &&
            item.validUntil <= new Date(now.getTime() + 3 * 86_400_000),
        ).length,
      },
    };
  }

  async create(
    organizationId: string,
    actorUserId: string,
    input: QuotationInput,
  ) {
    await this.validateContext(organizationId, input);
    return this.persist(organizationId, actorUserId, input);
  }

  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: QuotationInput,
  ) {
    await this.validateContext(organizationId, input);
    const current = await prisma.quotation.findFirst({
      where: { id, organizationId, archivedAt: null },
    });
    if (!current)
      throw new AppError(404, "Quotation not found.", "QUOTATION_NOT_FOUND");
    if (!["DRAFT", "SENT", "EXPIRED"].includes(current.status))
      throw new AppError(
        409,
        "Accepted, rejected, converted, or canceled quotations cannot be edited.",
        "QUOTATION_LOCKED",
      );
    return this.persist(organizationId, actorUserId, input, id);
  }

  private async persist(
    organizationId: string,
    actorUserId: string,
    input: QuotationInput,
    id?: string,
  ) {
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const total = Math.max(0, subtotal - input.discount + input.tax);
    const data = {
      organizationId,
      customerId: input.customerId,
      inquiryId: input.inquiryId ?? null,
      dealId: input.dealId ?? null,
      quotationNumber: input.quotationNumber.toUpperCase(),
      issueDate: input.issueDate,
      validUntil: input.validUntil,
      currency: input.currency,
      subtotal: new Prisma.Decimal(subtotal),
      discount: new Prisma.Decimal(input.discount),
      tax: new Prisma.Decimal(input.tax),
      total: new Prisma.Decimal(total),
      notes: input.notes,
      terms: input.terms,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      updatedById: actorUserId,
    };
    try {
      if (!id)
        return await prisma.quotation.create({
          data: {
            ...data,
            createdById: actorUserId,
            items: {
              create: input.items.map((item) => ({
                organizationId,
                description: item.description,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice),
                amount: new Prisma.Decimal(item.quantity * item.unitPrice),
              })),
            },
          },
          include,
        });
      return await prisma.$transaction(async (transaction) => {
        await transaction.quotationLineItem.deleteMany({
          where: { quotationId: id, organizationId },
        });
        return transaction.quotation.update({
          where: { id, organizationId },
          data: {
            ...data,
            items: {
              create: input.items.map((item) => ({
                organizationId,
                description: item.description,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice),
                amount: new Prisma.Decimal(item.quantity * item.unitPrice),
              })),
            },
          },
          include,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "Quotation number already exists in this organization.",
          "QUOTATION_NUMBER_EXISTS",
        );
      throw error;
    }
  }

  async setStatus(
    organizationId: string,
    actorUserId: string,
    id: string,
    target: QuotationStatus,
  ) {
    const quotation = await prisma.quotation.findFirst({
      where: { id, organizationId, archivedAt: null },
    });
    if (!quotation)
      throw new AppError(404, "Quotation not found.", "QUOTATION_NOT_FOUND");
    const transitions: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
      DRAFT: ["SENT", "CANCELED"],
      SENT: ["ACCEPTED", "REJECTED", "CANCELED"],
      EXPIRED: ["SENT", "CANCELED"],
    };
    if (!transitions[quotation.status]?.includes(target))
      throw new AppError(
        409,
        `Quotation cannot move from ${quotation.status} to ${target}.`,
        "INVALID_QUOTATION_TRANSITION",
      );
    const timestamp = new Date();
    return prisma.quotation.update({
      where: { id, organizationId },
      data: {
        status: target,
        sentAt: target === "SENT" ? timestamp : quotation.sentAt,
        acceptedAt: target === "ACCEPTED" ? timestamp : quotation.acceptedAt,
        rejectedAt: target === "REJECTED" ? timestamp : quotation.rejectedAt,
        updatedById: actorUserId,
      },
      include,
    });
  }
  async share(organizationId: string, actorUserId: string, id: string, input: QuotationShareInput) {
    const quotation = await prisma.quotation.findFirst({ where: { id, organizationId, archivedAt: null, status: { in: ["DRAFT", "SENT", "EXPIRED"] } }, include });
    if (!quotation) throw new AppError(404, "Open quotation not found.", "QUOTATION_NOT_FOUND");
    const expiresAt = quotation.validUntil > new Date() ? quotation.validUntil : new Date(Date.now() + 7 * 86_400_000);
    const token = this.token(quotation.id, organizationId, expiresAt);
    const path = `/quotation/${encodeURIComponent(token)}`;
    const url = `${env.FRONTEND_URL}${path}`;
    let delivery: { delivered: boolean; preview?: boolean; draftId?: string } = { delivered: false };
    if (input.channel === "EMAIL") {
      if (!quotation.customer.email) throw new AppError(409, "Customer email is missing.", "CUSTOMER_EMAIL_MISSING");
      const result = await this.email.send({ to: quotation.customer.email, subject: `Quotation ${quotation.quotationNumber}`, text: `Review quotation ${quotation.quotationNumber}: ${url}`, html: `<h2>Quotation ${quotation.quotationNumber}</h2><p>Hello ${quotation.customer.displayName},</p><p>Your quotation is ready for review.</p><p><a href="${url}">View and respond to quotation</a></p><p>This secure link expires on ${expiresAt.toDateString()}.</p>` });
      delivery = result;
    }
    if (input.channel === "WHATSAPP") {
      if (!quotation.customer.phone) throw new AppError(409, "Customer phone number is missing.", "CUSTOMER_PHONE_MISSING");
      const draft = await this.whatsapp.draft(organizationId, actorUserId, input.connectorId!, { eventId: null, recipient: quotation.customer.phone, body: `Hello ${quotation.customer.displayName}, your quotation ${quotation.quotationNumber} is ready. Review and respond securely: ${url}` });
      delivery = { delivered: false, draftId: draft.id };
    }
    const updated = await prisma.quotation.update({ where: { id, organizationId }, data: { status: "SENT", sentAt: quotation.sentAt ?? new Date(), updatedById: actorUserId }, include });
    await prisma.customerActivity.create({ data: { organizationId, customerId: quotation.customerId, type: "NOTE", summary: `Quotation ${quotation.quotationNumber} shared by ${input.channel.toLowerCase()}.`, details: input.channel === "LINK" ? "Secure link generated." : delivery.delivered ? "Delivery confirmed." : input.channel === "WHATSAPP" ? "WhatsApp approval draft created." : "Email delivery is not configured; secure link returned.", occurredAt: new Date(), createdById: actorUserId, updatedById: actorUserId } });
    return { quotation: updated, path, expiresAt, delivery };
  }
  async publicView(token: string) {
    const value = this.verifyToken(token);
    const quotation = await prisma.quotation.findFirst({ where: { id: value.id, organizationId: value.organizationId, archivedAt: null }, include: { ...include, organization: { select: { name: true, currency: true } } } });
    if (!quotation) throw new AppError(404, "Quotation was not found.", "QUOTATION_NOT_FOUND");
    return quotation;
  }
  async publicDecision(token: string, input: QuotationPublicDecisionInput) {
    const value = this.verifyToken(token);
    const quotation = await prisma.quotation.findFirst({ where: { id: value.id, organizationId: value.organizationId, archivedAt: null }, include: { customer: { select: { displayName: true } } } });
    if (!quotation) throw new AppError(404, "Quotation was not found.", "QUOTATION_NOT_FOUND");
    if (quotation.status !== "SENT") throw new AppError(409, `This quotation is already ${quotation.status.toLowerCase()}.`, "QUOTATION_ALREADY_DECIDED");
    if (quotation.validUntil < new Date()) throw new AppError(410, "This quotation has expired.", "QUOTATION_EXPIRED");
    const timestamp = new Date();
    const updated = await prisma.$transaction(async transaction => {
      const result = await transaction.quotation.update({ where: { id: quotation.id, organizationId: quotation.organizationId }, data: { status: input.decision, acceptedAt: input.decision === "ACCEPTED" ? timestamp : null, rejectedAt: input.decision === "REJECTED" ? timestamp : null, updatedById: quotation.updatedById }, include });
      if (quotation.dealId) await transaction.deal.updateMany({ where: { id: quotation.dealId, organizationId: quotation.organizationId, customerId: quotation.customerId, deletedAt: null }, data: { stage: input.decision === "ACCEPTED" ? "WON" : "LOST", probability: input.decision === "ACCEPTED" ? 100 : 0, updatedById: quotation.updatedById } });
      await transaction.customerFollowUp.updateMany({ where: { organizationId: quotation.organizationId, customerId: quotation.customerId, deletedAt: null, status: "PENDING", title: `Quotation follow-up: ${quotation.quotationNumber}` }, data: { status: input.decision === "ACCEPTED" ? "COMPLETED" : "CANCELED", completedAt: timestamp, updatedById: quotation.updatedById } });
      await transaction.notification.updateMany({ where: { organizationId: quotation.organizationId, sourceType: "QUOTATION", sourceId: quotation.id, deletedAt: null }, data: { deletedAt: timestamp, updatedById: quotation.updatedById } });
      await transaction.customerActivity.create({ data: { organizationId: quotation.organizationId, customerId: quotation.customerId, type: "NOTE", summary: `${quotation.customer.displayName} ${input.decision.toLowerCase()} quotation ${quotation.quotationNumber}.`, details: input.note, occurredAt: timestamp, createdById: quotation.updatedById, updatedById: quotation.updatedById } });
      return result;
    });
    if (input.decision === "ACCEPTED") {
      try { await this.invoiceAutomation.prepare(quotation.organizationId, quotation.updatedById, quotation.id); }
      catch { /* The customer decision remains valid; failed automation is recorded for operators. */ }
    }
    return updated;
  }

  async scheduleFollowUp(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: QuotationFollowUpInput,
  ) {
    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        organizationId,
        archivedAt: null,
        status: { in: ["DRAFT", "SENT", "EXPIRED"] },
      },
      include: { customer: { select: { displayName: true } } },
    });
    if (!quotation)
      throw new AppError(
        404,
        "Open quotation not found.",
        "QUOTATION_NOT_FOUND",
      );
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.quotation.update({
        where: { id, organizationId },
        data: { nextFollowUpAt: input.dueAt, updatedById: actorUserId },
      });
      await transaction.customerFollowUp.create({
        data: {
          organizationId,
          customerId: quotation.customerId,
          title: `Quotation follow-up: ${quotation.quotationNumber}`,
          description: input.note,
          dueAt: input.dueAt,
          assignedToId: actorUserId,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      await transaction.notification.create({
        data: {
          organizationId,
          recipientId: actorUserId,
          type: "FOLLOW_UP_DUE",
          title: `Follow up on ${quotation.quotationNumber}`,
          message: `${quotation.customer.displayName}: ${input.note}`,
          sourceType: "QUOTATION",
          sourceId: id,
          actionPath: "/dashboard",
          availableAt: input.dueAt,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      return updated;
    });
  }

  async convert(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: QuotationConversionInput,
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const quotation = await transaction.quotation.findFirst({
            where: {
              id,
              organizationId,
              archivedAt: null,
              status: "ACCEPTED",
              invoiceId: null,
            },
            include: { items: true },
          });
          if (!quotation)
            throw new AppError(
              409,
              "Only an accepted, unconverted quotation can become an invoice.",
              "QUOTATION_NOT_CONVERTIBLE",
            );
          const invoice = await transaction.invoice.create({
            data: {
              organizationId,
              customerId: quotation.customerId,
              projectId: null,
              invoiceNumber: input.invoiceNumber.toUpperCase(),
              status: "ISSUED",
              issueDate: input.issueDate,
              dueDate: input.dueDate,
              currency: quotation.currency,
              subtotal: quotation.subtotal,
              discount: quotation.discount,
              tax: quotation.tax,
              total: quotation.total,
              notes: quotation.notes,
              createdById: actorUserId,
              updatedById: actorUserId,
              items: {
                create: quotation.items.map((item) => ({
                  organizationId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  amount: item.amount,
                })),
              },
            },
          });
          await transaction.quotation.update({
            where: { id, organizationId },
            data: {
              status: "CONVERTED",
              invoiceId: invoice.id,
              convertedAt: new Date(),
              updatedById: actorUserId,
            },
          });
          await transaction.customerActivity.create({
            data: {
              organizationId,
              customerId: quotation.customerId,
              type: "NOTE",
              summary: `Quotation ${quotation.quotationNumber} converted to invoice ${invoice.invoiceNumber}.`,
              occurredAt: new Date(),
              createdById: actorUserId,
              updatedById: actorUserId,
            },
          });
          return invoice;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "Invoice number already exists in this organization.",
          "INVOICE_NUMBER_EXISTS",
        );
      throw error;
    }
  }

  async archive(organizationId: string, actorUserId: string, id: string) {
    const result = await prisma.quotation.updateMany({
      where: { id, organizationId, archivedAt: null },
      data: { archivedAt: new Date(), updatedById: actorUserId },
    });
    if (!result.count)
      throw new AppError(404, "Quotation not found.", "QUOTATION_NOT_FOUND");
  }
}
