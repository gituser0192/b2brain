import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { synchronizeInvoiceSettlement } from "../src/modules/payment-collection/invoice-settlement.service.js";

describe("invoice payment settlement notifications", () => {
  it("updates the existing invoice notification when later partial and final payments are recorded", async () => {
    const notificationUpsert = vi.fn().mockResolvedValue({});
    const tx = {
      customerFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      approvalRequest: { findMany: vi.fn().mockResolvedValue([]) },
      organizationMembership: { findFirst: vi.fn().mockResolvedValue({ userId: "00000000-0000-4000-8000-000000000002" }) },
      notification: { upsert: notificationUpsert },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as Prisma.TransactionClient;
    const base = {
      organizationId: "00000000-0000-4000-8000-000000000001",
      actorUserId: "00000000-0000-4000-8000-000000000003",
      invoiceId: "00000000-0000-4000-8000-000000000004",
      customerId: null,
      invoiceNumber: "004",
      currency: "INR",
      paymentId: "00000000-0000-4000-8000-000000000005",
    };

    await synchronizeInvoiceSettlement(tx, { ...base, remaining: 17800 });
    await synchronizeInvoiceSettlement(tx, { ...base, remaining: 0, paymentId: "00000000-0000-4000-8000-000000000006" });

    expect(notificationUpsert).toHaveBeenCalledTimes(2);
    expect(notificationUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId_recipientId_sourceType_sourceId: { organizationId: base.organizationId, recipientId: "00000000-0000-4000-8000-000000000002", sourceType: "INVOICE", sourceId: base.invoiceId } },
      create: { title: "Partial payment received", message: "004 now has INR 17800.00 outstanding." },
      update: { title: "Partial payment received", readAt: null },
    });
    expect(notificationUpsert.mock.calls[1]?.[0]).toMatchObject({
      where: { organizationId_recipientId_sourceType_sourceId: { organizationId: base.organizationId, recipientId: "00000000-0000-4000-8000-000000000002", sourceType: "INVOICE", sourceId: base.invoiceId } },
      create: { title: "Invoice paid" },
      update: { title: "Invoice paid", readAt: null },
    });
  });
});
