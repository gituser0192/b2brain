import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  expenseFindMany: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceUpdate: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentCreate: vi.fn(),
}));

vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    $transaction: db.transaction,
    invoice: { updateMany: db.invoiceUpdateMany, findMany: db.invoiceFindMany },
    expense: { findMany: db.expenseFindMany },
  },
}));

import { FinanceService } from "../src/modules/finance/finance.service.js";

const invoiceId = "00000000-0000-4000-8000-000000000030";
const organizationId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const expectedUpdatedAt = new Date("2026-11-19T10:00:00.000Z");

describe("finance invoice confirmation concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.transaction.mockImplementation((run: (tx: unknown) => unknown) => run({
      invoice: { findFirst: db.invoiceFindFirst, update: db.invoiceUpdate },
      payment: { findFirst: db.paymentFindFirst, create: db.paymentCreate },
    }));
  });

  it("does not count draft invoices as invoiced or outstanding revenue", async () => {
    db.invoiceFindMany.mockResolvedValue([
      { status: "DRAFT", total: "2500.00", dueDate: new Date("2026-12-01T00:00:00.000Z"), payments: [] },
      { status: "ISSUED", total: "1000.00", dueDate: new Date("2026-12-01T00:00:00.000Z"), payments: [] },
    ]);
    db.expenseFindMany.mockResolvedValue([]);
    await expect(new FinanceService().list(organizationId)).resolves.toMatchObject({ metrics: { invoiced: 1000, received: 0, outstanding: 1000 } });
  });

  it("rejects payment if the invoice changed after the Agent preview, before creating a payment", async () => {
    db.invoiceFindFirst.mockResolvedValue({ id: invoiceId, updatedAt: new Date("2026-11-19T10:01:00.000Z"), payments: [], total: "1000.00", dueDate: new Date("2026-12-01T00:00:00.000Z") });
    await expect(new FinanceService().pay(organizationId, actorUserId, invoiceId, { amount: 500, method: "CASH", reference: null, paidAt: expectedUpdatedAt }, expectedUpdatedAt)).rejects.toMatchObject({ code: "AGENT_ACTION_STALE" });
    expect(db.paymentCreate).not.toHaveBeenCalled();
    expect(db.invoiceUpdate).not.toHaveBeenCalled();
  });

  it("issues only a draft invoice whose version still matches the preview", async () => {
    db.invoiceFindFirst.mockResolvedValue({ id: invoiceId, status: "DRAFT", updatedAt: expectedUpdatedAt, dueDate: new Date("2026-12-01T00:00:00.000Z") });
    db.invoiceUpdate.mockResolvedValue({ id: invoiceId, invoiceNumber: "INV-004", status: "ISSUED" });
    await expect(new FinanceService().issueInvoice(organizationId, actorUserId, invoiceId, expectedUpdatedAt)).resolves.toMatchObject({ status: "ISSUED" });
    expect(db.invoiceUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: invoiceId, organizationId }, data: { status: "ISSUED", updatedById: actorUserId } }));
  });

  it("does not issue a stale or non-draft invoice", async () => {
    db.invoiceFindFirst.mockResolvedValue({ id: invoiceId, status: "DRAFT", updatedAt: new Date("2026-11-19T10:01:00.000Z"), dueDate: new Date("2026-12-01T00:00:00.000Z") });
    await expect(new FinanceService().issueInvoice(organizationId, actorUserId, invoiceId, expectedUpdatedAt)).rejects.toMatchObject({ code: "AGENT_ACTION_STALE" });
    expect(db.invoiceUpdate).not.toHaveBeenCalled();
    db.invoiceFindFirst.mockResolvedValue({ id: invoiceId, status: "PAID", updatedAt: expectedUpdatedAt, dueDate: new Date("2026-12-01T00:00:00.000Z") });
    await expect(new FinanceService().issueInvoice(organizationId, actorUserId, invoiceId, expectedUpdatedAt)).rejects.toMatchObject({ code: "INVOICE_NOT_DRAFT" });
    expect(db.invoiceUpdate).not.toHaveBeenCalled();
  });

  it("does not misreport a different unique-constraint conflict as a duplicate payment reference", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { target: ["organizationId", "recipientId", "sourceType", "sourceId"] },
    });
    db.transaction.mockRejectedValue(conflict);
    await expect(new FinanceService().pay(organizationId, actorUserId, invoiceId, { amount: 500, method: "CASH", reference: null, paidAt: expectedUpdatedAt })).rejects.toBe(conflict);
  });

  it("still reports a payment-reference unique conflict accurately", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { target: ["organizationId", "reference"] },
    });
    db.transaction.mockRejectedValue(conflict);
    await expect(new FinanceService().pay(organizationId, actorUserId, invoiceId, { amount: 500, method: "CASH", reference: "UTR-001", paidAt: expectedUpdatedAt })).rejects.toMatchObject({ code: "PAYMENT_REFERENCE_EXISTS" });
  });
});
