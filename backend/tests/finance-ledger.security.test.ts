import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  expenseFindFirst: vi.fn(), expenseUpdateMany: vi.fn(), expenseFindMany: vi.fn(),
  paymentFindMany: vi.fn(), projectFindFirst: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  expense: { findFirst: mocks.expenseFindFirst, updateMany: mocks.expenseUpdateMany, findMany: mocks.expenseFindMany },
  payment: { findMany: mocks.paymentFindMany }, project: { findFirst: mocks.projectFindFirst },
} }));

import { FinanceService } from "../src/modules/finance/finance.service.js";

const ORG_B = "00000000-0000-4000-8000-00000000000b";
const EXPENSE_A = "10000000-0000-4000-8000-00000000000a";
const USER_B = "20000000-0000-4000-8000-00000000000b";

describe("finance ledger and expense isolation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.expenseFindFirst.mockResolvedValue(null); mocks.expenseUpdateMany.mockResolvedValue({ count: 0 }); });

  it("returns 404 when another organization views, updates or archives an expense", async () => {
    const service = new FinanceService();
    await expect(service.getExpense(ORG_B, EXPENSE_A)).rejects.toMatchObject({ statusCode: 404, code: "EXPENSE_NOT_FOUND" });
    const input = { projectId: null, title: "Protected expense", category: "Operations", vendor: null, amount: 100, currency: "INR", expenseDate: new Date(), status: "RECORDED", notes: null } as const;
    await expect(service.updateExpense(ORG_B, USER_B, EXPENSE_A, input)).rejects.toMatchObject({ statusCode: 404, code: "EXPENSE_NOT_FOUND" });
    await expect(service.archiveExpense(ORG_B, USER_B, EXPENSE_A)).rejects.toMatchObject({ statusCode: 404, code: "EXPENSE_NOT_FOUND" });
    expect(mocks.expenseFindFirst).toHaveBeenCalledWith({ where: { id: EXPENSE_A, organizationId: ORG_B, deletedAt: null } });
    expect(mocks.expenseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: EXPENSE_A, organizationId: ORG_B, deletedAt: null } }));
  });

  it("calculates revenue net of refunds and profit from recorded expenses", async () => {
    mocks.paymentFindMany.mockResolvedValue([{ id: "payment-1", amount: 1000, refundedAmount: 200, currency: "INR", method: "UPI", paidAt: new Date("2026-08-10T00:00:00.000Z"), invoice: { invoiceNumber: "INV-1", customer: { displayName: "Customer" } } }]);
    mocks.expenseFindMany.mockResolvedValue([{ id: "expense-1", title: "Hosting", category: "Technology", amount: 300, currency: "INR", expenseDate: new Date("2026-08-12T00:00:00.000Z") }]);
    const result = await new FinanceService().ledger(ORG_B, {});
    expect(result.metrics).toEqual({ revenue: 800, expenses: 300, profit: 500 });
    expect(result.monthly).toEqual([{ month: "2026-08", revenue: 800, expenses: 300, profit: 500 }]);
    expect(mocks.paymentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: ORG_B, deletedAt: null } }));
    expect(mocks.expenseFindMany).toHaveBeenCalledOnce();
  });
});
