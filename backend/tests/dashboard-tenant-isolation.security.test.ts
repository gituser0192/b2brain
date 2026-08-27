import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ organizationFindFirst: vi.fn(), planFindUnique: vi.fn(), servicesFindMany: vi.fn(), customersFindMany: vi.fn(), paymentsFindMany: vi.fn(), expensesFindMany: vi.fn() }));
vi.mock("../src/database/prisma.js", () => {
  const count = vi.fn().mockResolvedValue(0), findMany = vi.fn().mockResolvedValue([]);
  return { prisma: {
    organization: { findFirst: mocks.organizationFindFirst }, organizationPlan: { findUnique: mocks.planFindUnique }, organizationService: { findMany: mocks.servicesFindMany }, membershipServiceAccess: { findMany },
    customer: { findMany: mocks.customersFindMany }, customerFollowUp: { count }, deal: { findMany }, quotation: { findMany }, project: { count, findMany }, projectTask: { count }, employee: { count }, invoice: { findMany }, payment: { findMany: mocks.paymentsFindMany }, incomingPaymentTransaction: { count }, expense: { findMany: mocks.expensesFindMany }, order: { findMany }, stockLevel: { findMany }, marketingCampaign: { findMany }, campaignLead: { findMany }, supportTicket: { findMany }, websiteChangeRequest: { findMany }, websiteDeployment: { findMany }, purchaseOrder: { findMany }, calendarEvent: { findMany }, inquiry: { findMany }, customerActivity: { findMany },
  } };
});

import { DashboardService } from "../src/modules/dashboard/dashboard.service.js";

describe("dashboard tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.organizationFindFirst.mockResolvedValue({ currency: "INR", timezone: "Asia/Kolkata" });
    mocks.planFindUnique.mockResolvedValue(null);
    mocks.servicesFindMany.mockResolvedValue([{ service: { code: "CRM" } }]);
    mocks.paymentsFindMany.mockResolvedValue([]);
    mocks.expensesFindMany.mockResolvedValue([]);
    mocks.customersFindMany.mockImplementation(({ where, take }: { where: { organizationId: string }; take?: number }) => Promise.resolve(where.organizationId === "org-a" ? [{ id: "customer-a", displayName: "A customer", status: "ACTIVE", createdAt: new Date() }] : take ? [] : []));
  });

  it("never returns another organization's customer totals or recent records", async () => {
    const data = await new DashboardService().summary("org-b", "membership-b", "ORGANIZATION_OWNER", ["CRM_VIEW"], 30);
    expect(data.metrics.customers).toBe(0);
    expect(data.recent.customers).toEqual([]);
    expect(mocks.customersFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-b", deletedAt: null } }));
    expect(mocks.customersFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-b", deletedAt: null }, take: 5 }));
  });

  it("aggregates current-month revenue net of refunds and recorded expenses", async () => {
    mocks.servicesFindMany.mockResolvedValue([{ service: { code: "FINANCE" } }]);
    const now = new Date();
    mocks.paymentsFindMany.mockResolvedValue([{ amount: 1_000, refundedAmount: 200, currency: "INR", paidAt: now }]);
    mocks.expensesFindMany.mockResolvedValue([{ amount: 300, currency: "INR", expenseDate: now }]);
    const data = await new DashboardService().summary("org-b", "membership-b", "ORGANIZATION_OWNER", ["FINANCE_VIEW"], 30);
    expect(data.metrics.currentMonthRevenue).toBe(800);
    expect(data.metrics.currentMonthExpenses).toBe(300);
    expect(data.metrics.currentMonthProfit).toBe(500);
    expect(data.monthlyCash.at(-1)).toMatchObject({ revenue: 800, expenses: 300, profit: 500 });
  });
});
