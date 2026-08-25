import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  IncomingPaymentInput,
  PaymentAccountInput,
  ReconcileInput,
  IgnoreIncomingPaymentInput,
  RefundCompletionInput,
  RefundInput,
} from "./payment-collection.validation.js";
import { synchronizeInvoiceSettlement } from "./invoice-settlement.service.js";
import { findExactPaymentMatch } from "./payment-match.engine.js";

export class PaymentCollectionService {
  async overview(organizationId: string) {
    const [accounts, transactions, refunds] = await Promise.all([
      prisma.paymentAccount.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incomingPaymentTransaction.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          paymentAccount: { select: { id: true, name: true, type: true } },
          payment: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  customer: { select: { displayName: true } },
                },
              },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
      }),
      prisma.paymentRefund.findMany({
        where: { organizationId },
        include: {
          payment: {
            select: {
              receiptNumber: true,
              currency: true,
              invoice: { select: { invoiceNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const unmatched = transactions.filter(
      (item) => item.status === "UNMATCHED",
    );
    return {
      accounts,
      transactions,
      refunds,
      metrics: {
        activeAccounts: accounts.filter((item) => item.isActive).length,
        unmatchedCount: unmatched.length,
        unmatchedValue: unmatched.reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        ),
        matchedValue: transactions
          .filter((item) => item.status === "MATCHED")
          .reduce((sum, item) => sum + Number(item.amount), 0),
        pendingRefunds: refunds.filter(
          (item) => item.status === "PENDING_APPROVAL",
        ).length,
      },
    };
  }

  async createAccount(
    organizationId: string,
    actorUserId: string,
    input: PaymentAccountInput,
  ) {
    try {
      return await prisma.paymentAccount.create({
        data: {
          ...input,
          organizationId,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "This payment account identifier already exists.",
          "PAYMENT_ACCOUNT_EXISTS",
        );
      throw error;
    }
  }

  async updateAccount(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: PaymentAccountInput,
  ) {
    const result = await prisma.paymentAccount.updateMany({
      where: { id, organizationId, archivedAt: null },
      data: { ...input, updatedById: actorUserId },
    });
    if (!result.count)
      throw new AppError(
        404,
        "Payment account not found.",
        "PAYMENT_ACCOUNT_NOT_FOUND",
      );
  }

  async captureIncoming(
    organizationId: string,
    actorUserId: string,
    input: IncomingPaymentInput,
  ) {
    if (
      !(await prisma.paymentAccount.findFirst({
        where: {
          id: input.paymentAccountId,
          organizationId,
          archivedAt: null,
          isActive: true,
        },
      }))
    )
      throw new AppError(
        404,
        "Active payment account not found.",
        "PAYMENT_ACCOUNT_NOT_FOUND",
      );
    try {
      const transaction = await prisma.incomingPaymentTransaction.create({
        data: {
          ...input,
          organizationId,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      const invoices = await prisma.invoice.findMany({ where: { organizationId, deletedAt: null, currency: input.currency, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { customer: { select: { email: true } }, payments: { where: { deletedAt: null }, select: { amount: true, refundedAmount: true } } }, take: 250 });
      const match = findExactPaymentMatch({ externalReference: input.externalReference, payerContact: input.payerContact, amount: input.amount }, invoices.map((invoice) => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total), customerEmail: invoice.customer.email, payments: invoice.payments.map((payment) => ({ amount: Number(payment.amount), refundedAmount: Number(payment.refundedAmount) })) })));
      if (match.matched) {
        const payment = await this.reconcile(organizationId, actorUserId, transaction.id, { invoiceId: match.invoiceId });
        return { transaction: { ...transaction, status: "MATCHED" as const }, autoMatched: true, invoiceId: match.invoiceId, payment };
      }
      return { transaction, autoMatched: false, matchReason: match.reason };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "This incoming transaction reference already exists.",
          "TRANSACTION_REFERENCE_EXISTS",
        );
      throw error;
    }
  }

  async reconcile(
    organizationId: string,
    actorUserId: string,
    transactionId: string,
    input: ReconcileInput,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const [incoming, invoice] = await Promise.all([
        tx.incomingPaymentTransaction.findFirst({
          where: {
              id: transactionId,
              organizationId,
              deletedAt: null,
            status: "UNMATCHED",
          },
          include: { paymentAccount: { select: { type: true } } },
          }),
          tx.invoice.findFirst({
            where: {
              id: input.invoiceId,
              organizationId,
              deletedAt: null,
              status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
            },
            include: { payments: { where: { deletedAt: null } } },
          }),
        ]);
        if (!incoming)
          throw new AppError(
            404,
            "Unmatched incoming transaction not found.",
            "INCOMING_TRANSACTION_NOT_FOUND",
          );
        if (!invoice)
          throw new AppError(
            404,
            "Collectible invoice not found.",
            "INVOICE_NOT_FOUND",
          );
        if (incoming.currency !== invoice.currency)
          throw new AppError(
            409,
            "Transaction and invoice currencies do not match.",
            "CURRENCY_MISMATCH",
          );
        const netPaid = invoice.payments.reduce(
          (sum, payment) =>
            sum + Number(payment.amount) - Number(payment.refundedAmount),
          0,
        );
        const outstanding = Number(invoice.total) - netPaid;
        if (Number(incoming.amount) > outstanding + 0.001)
          throw new AppError(
            409,
            "Incoming amount exceeds the invoice balance. Split reconciliation is not enabled yet.",
            "PAYMENT_EXCEEDS_BALANCE",
          );
        const receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
        const payment = await tx.payment.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            amount: incoming.amount,
            currency: incoming.currency,
            method:
              incoming.paymentAccount.type === "UPI"
                ? "UPI"
                : incoming.paymentAccount.type === "CASH"
                  ? "CASH"
                  : incoming.paymentAccount.type === "BANK"
                    ? "BANK_TRANSFER"
                    : incoming.paymentAccount.type === "PAYMENT_GATEWAY"
                      ? "CARD"
                      : "OTHER",
            reference: incoming.externalReference,
            receiptNumber,
            incomingTransactionId: incoming.id,
            paidAt: incoming.receivedAt,
            createdById: actorUserId,
          },
        });
        const remaining = outstanding - Number(incoming.amount);
        await Promise.all([
          tx.incomingPaymentTransaction.update({
            where: { id: incoming.id, organizationId },
            data: { status: "MATCHED", updatedById: actorUserId },
          }),
          tx.invoice.update({
            where: { id: invoice.id, organizationId },
            data: {
              status:
                remaining <= 0.001
                  ? "PAID"
                  : invoice.dueDate < new Date()
                    ? "OVERDUE"
                    : "PARTIALLY_PAID",
              updatedById: actorUserId,
            },
          }),
          tx.auditEvent.create({
            data: {
              organizationId,
              actorType: "USER",
              actorUserId,
              serviceCode: "FINANCE",
              actionCode: "PAYMENT_RECONCILED",
              sourceType: "PAYMENT",
              sourceId: payment.id,
              summary: `${incoming.currency} ${Number(incoming.amount).toFixed(2)} reconciled to ${invoice.invoiceNumber}.`,
              metadata: { transactionId: incoming.id, receiptNumber },
            },
          }),
        ]);
        await synchronizeInvoiceSettlement(tx, { organizationId, actorUserId, invoiceId: invoice.id, customerId: invoice.customerId, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency, remaining, paymentId: payment.id });
        return payment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async ignoreIncoming(organizationId: string, actorUserId: string, transactionId: string, input: IgnoreIncomingPaymentInput) {
    return prisma.$transaction(async (tx) => {
      const incoming = await tx.incomingPaymentTransaction.findFirst({ where: { id: transactionId, organizationId, deletedAt: null, status: "UNMATCHED" } });
      if (!incoming) throw new AppError(404, "Unmatched incoming transaction not found.", "INCOMING_TRANSACTION_NOT_FOUND");
      const updated = await tx.incomingPaymentTransaction.update({ where: { id: incoming.id, organizationId }, data: { status: "IGNORED", notes: [incoming.notes, `Ignored: ${input.reason}`].filter(Boolean).join("\n"), updatedById: actorUserId } });
      await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "FINANCE", actionCode: "INCOMING_PAYMENT_IGNORED", sourceType: "INCOMING_PAYMENT", sourceId: incoming.id, summary: `${incoming.currency} ${Number(incoming.amount).toFixed(2)} incoming transaction marked as ignored.`, metadata: { externalReference: incoming.externalReference, reason: input.reason } } });
      return updated;
    });
  }

  async requestRefund(
    organizationId: string,
    actorUserId: string,
    paymentId: string,
    input: RefundInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId, deletedAt: null },
        include: {
          invoice: { select: { invoiceNumber: true } },
          refunds: {
            where: {
              status: { in: ["PENDING_APPROVAL", "APPROVED", "COMPLETED"] },
            },
          },
        },
      });
      if (!payment)
        throw new AppError(404, "Payment not found.", "PAYMENT_NOT_FOUND");
      const reserved = payment.refunds.reduce(
        (sum, refund) => sum + Number(refund.amount),
        0,
      );
      if (input.amount > Number(payment.amount) - reserved + 0.001)
        throw new AppError(
          409,
          "Refund exceeds the refundable payment balance.",
          "REFUND_EXCEEDS_BALANCE",
        );
      const refund = await tx.paymentRefund.create({
        data: {
          organizationId,
          paymentId,
          amount: new Prisma.Decimal(input.amount),
          reason: input.reason,
          requestedById: actorUserId,
          updatedById: actorUserId,
        },
      });
      await tx.approvalRequest.create({
        data: {
          organizationId,
          serviceCode: "FINANCE",
          actionCode: "PAYMENT_REFUND",
          title: `Refund ${payment.receiptNumber}`,
          description: `${payment.currency} ${input.amount.toFixed(2)} refund for invoice ${payment.invoice.invoiceNumber}. ${input.reason}`,
          riskLevel: "HIGH",
          sourceType: "PAYMENT_REFUND",
          sourceId: refund.id,
          requestedById: actorUserId,
          context: {
            paymentId,
            amount: input.amount,
            currency: payment.currency,
          },
        },
      });
      return refund;
    });
  }

  async completeRefund(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: RefundCompletionInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findFirst({
        where: { id, organizationId, status: "APPROVED" },
        include: {
          payment: {
            include: {
              invoice: {
                include: { payments: { where: { deletedAt: null } } },
              },
            },
          },
        },
      });
      if (!refund)
        throw new AppError(
          404,
          "Approved refund not found.",
          "REFUND_NOT_APPROVED",
        );
      const updated = await tx.paymentRefund.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          updatedById: actorUserId,
        },
      });
      await tx.payment.update({
        where: { id: refund.paymentId, organizationId },
        data: { refundedAmount: { increment: refund.amount } },
      });
      const invoice = refund.payment.invoice;
      const netPaid =
        invoice.payments.reduce(
          (sum, payment) =>
            sum + Number(payment.amount) - Number(payment.refundedAmount),
          0,
        ) - Number(refund.amount);
      await tx.invoice.update({
        where: { id: invoice.id, organizationId },
        data: {
          status:
            netPaid <= 0.001
              ? invoice.dueDate < new Date()
                ? "OVERDUE"
                : "ISSUED"
              : netPaid < Number(invoice.total)
                ? invoice.dueDate < new Date()
                  ? "OVERDUE"
                  : "PARTIALLY_PAID"
                : "PAID",
          updatedById: actorUserId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorType: "USER",
          actorUserId,
          serviceCode: "FINANCE",
          actionCode: "PAYMENT_REFUND_COMPLETED",
          sourceType: "PAYMENT_REFUND",
          sourceId: id,
          summary: `Refund completed with reference ${input.reference}.`,
          metadata: {
            reference: input.reference,
            amount: Number(refund.amount),
          },
        },
      });
      return updated;
    });
  }
}
