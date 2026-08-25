import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  ExpenseInput,
  InvoiceInput,
  PaymentInput,
} from "./finance.validation.js";
import { synchronizeInvoiceSettlement } from "../payment-collection/invoice-settlement.service.js";

export class FinanceService {
  private async context(
    organizationId: string,
    customerId: string,
    projectId: string | null,
  ) {
    if (
      !(await prisma.customer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
      }))
    )
      throw new AppError(404, "Customer not found.", "CUSTOMER_NOT_FOUND");
    if (
      projectId &&
      !(await prisma.project.findFirst({
        where: { id: projectId, organizationId, deletedAt: null },
      }))
    )
      throw new AppError(404, "Project not found.", "PROJECT_NOT_FOUND");
  }

  async list(organizationId: string) {
    await prisma.invoice.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: new Date() },
      },
      data: { status: "OVERDUE" },
    });
    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          customer: {
            select: { id: true, displayName: true, email: true, phone: true },
          },
          items: true,
          payments: {
            where: { deletedAt: null },
            include: { refunds: true },
            orderBy: { paidAt: "desc" },
          },
          collectionFollowUps: {
            where: { organizationId, status: "PENDING", deletedAt: null },
            select: { id: true, title: true, description: true, dueAt: true, status: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { issueDate: "desc" },
      }),
      prisma.expense.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { expenseDate: "desc" },
      }),
    ]);
    const enrichedInvoices = invoices.map((invoice) => {
      const paid = invoice.payments.reduce(
        (sum, payment) =>
          sum + Number(payment.amount) - Number(payment.refundedAmount),
        0,
      );
      return {
        ...invoice,
        paid,
        outstanding: Math.max(0, Number(invoice.total) - paid),
        daysOverdue:
          invoice.status === "OVERDUE"
            ? Math.max(
                1,
                Math.floor(
                  (Date.now() - invoice.dueDate.getTime()) / 86_400_000,
                ),
              )
            : 0,
      };
    });
    const active = enrichedInvoices.filter(
      (invoice) => invoice.status !== "CANCELED",
    );
    const invoiced = active.reduce(
      (sum, invoice) => sum + Number(invoice.total),
      0,
    );
    const received = active.reduce((sum, invoice) => sum + invoice.paid, 0);
    const outstanding = active.reduce(
      (sum, invoice) => sum + invoice.outstanding,
      0,
    );
    const overdue = active
      .filter((invoice) => invoice.status === "OVERDUE")
      .reduce((sum, invoice) => sum + invoice.outstanding, 0);
    const spent = expenses
      .filter((expense) => expense.status === "RECORDED")
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return {
      invoices: enrichedInvoices,
      expenses,
      metrics: {
        invoiced,
        received,
        outstanding,
        overdue,
        expenses: spent,
        netCash: received - spent,
      },
    };
  }

  async createInvoice(
    organizationId: string,
    actorUserId: string,
    input: InvoiceInput,
  ) {
    await this.context(organizationId, input.customerId, input.projectId);
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const total = Math.max(0, subtotal - input.discount + input.tax);
    try {
      return await prisma.invoice.create({
        data: {
          organizationId,
          customerId: input.customerId,
          projectId: input.projectId,
          invoiceNumber: input.invoiceNumber.toUpperCase(),
          status: input.status,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal: new Prisma.Decimal(subtotal),
          discount: new Prisma.Decimal(input.discount),
          tax: new Prisma.Decimal(input.tax),
          total: new Prisma.Decimal(total),
          notes: input.notes,
          createdById: actorUserId,
          updatedById: actorUserId,
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
        include: { items: true },
      });
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

  async pay(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: PaymentInput,
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const invoice = await transaction.invoice.findFirst({
            where: {
              id,
              organizationId,
              deletedAt: null,
              status: { notIn: ["DRAFT", "CANCELED"] },
            },
            include: { payments: { where: { deletedAt: null } } },
          });
          if (!invoice)
            throw new AppError(
              404,
              "Issued invoice not found.",
              "INVOICE_NOT_FOUND",
            );
          if (
            input.reference &&
            (await transaction.payment.findFirst({
              where: {
                organizationId,
                reference: input.reference,
                deletedAt: null,
              },
            }))
          )
            throw new AppError(
              409,
              "This payment reference has already been recorded.",
              "PAYMENT_REFERENCE_EXISTS",
            );
          const paid = invoice.payments.reduce(
            (sum, payment) =>
              sum + Number(payment.amount) - Number(payment.refundedAmount),
            0,
          );
          const balance = Number(invoice.total) - paid;
          if (input.amount > balance + 0.001)
            throw new AppError(
              400,
              "Payment exceeds outstanding balance.",
              "PAYMENT_EXCEEDS_BALANCE",
            );
          const receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
          const payment = await transaction.payment.create({
            data: {
              organizationId,
              invoiceId: id,
              amount: new Prisma.Decimal(input.amount),
              currency: invoice.currency,
              method: input.method,
              reference: input.reference,
              receiptNumber,
              paidAt: input.paidAt,
              createdById: actorUserId,
            },
          });
          const remaining = balance - input.amount;
          const status =
            remaining <= 0.001
              ? "PAID"
              : invoice.dueDate < new Date()
                ? "OVERDUE"
                : "PARTIALLY_PAID";
          await transaction.invoice.update({
            where: { id, organizationId },
            data: { status, updatedById: actorUserId },
          });
          await synchronizeInvoiceSettlement(transaction, { organizationId, actorUserId, invoiceId: invoice.id, customerId: invoice.customerId, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency, remaining, paymentId: payment.id });
          return payment;
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
          "This payment reference has already been recorded.",
          "PAYMENT_REFERENCE_EXISTS",
        );
      throw error;
    }
  }

  async createCollectionFollowUp(
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      include: {
        customer: { select: { id: true, displayName: true } },
        payments: { where: { deletedAt: null } },
      },
    });
    if (!invoice)
      throw new AppError(
        404,
        "Collectible invoice not found.",
        "INVOICE_NOT_FOUND",
      );
    const outstanding = Math.max(
      0,
      Number(invoice.total) -
        invoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
    );
    if (outstanding <= 0.001)
      throw new AppError(
        400,
        "This invoice has no outstanding balance.",
        "INVOICE_ALREADY_PAID",
      );
    const title = `Payment follow-up: ${invoice.invoiceNumber}`;
    const existing = await prisma.customerFollowUp.findFirst({
        where: {
          organizationId,
          customerId: invoice.customerId,
          OR: [{ invoiceId: invoice.id }, { invoiceId: null, title: { in: [title, `Collect ${invoice.invoiceNumber}`] } }],
          status: "PENDING",
          deletedAt: null,
        },
      });
    if (existing) {
      if (!existing.invoiceId) await prisma.customerFollowUp.updateMany({ where: { id: existing.id, organizationId, invoiceId: null }, data: { invoiceId: invoice.id, updatedById: actorUserId } });
      return { ...existing, invoiceId: invoice.id, reused: true };
    }
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 1);
    return prisma.$transaction(async (transaction) => {
      const followUp = await transaction.customerFollowUp.create({
        data: {
          organizationId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          title,
          description: `${invoice.customer.displayName} has ${invoice.currency} ${outstanding.toFixed(2)} outstanding. Invoice due date: ${invoice.dueDate.toISOString().slice(0, 10)}.`,
          dueAt,
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
          title,
          message: `Collection follow-up created for ${invoice.customer.displayName}.`,
          sourceType: "CUSTOMER_FOLLOW_UP",
          sourceId: followUp.id,
          actionPath: "/dashboard",
          availableAt: dueAt,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      return followUp;
    });
  }

  async expense(
    organizationId: string,
    actorUserId: string,
    input: ExpenseInput,
  ) {
    if (
      input.projectId &&
      !(await prisma.project.findFirst({
        where: { id: input.projectId, organizationId, deletedAt: null },
      }))
    )
      throw new AppError(404, "Project not found.", "PROJECT_NOT_FOUND");
    return prisma.expense.create({
      data: {
        ...input,
        amount: new Prisma.Decimal(input.amount),
        organizationId,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
  }
}
