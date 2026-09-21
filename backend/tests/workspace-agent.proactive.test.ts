/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  goalFindMany: vi.fn(),
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));
const serviceAccess = vi.hoisted(() => vi.fn());
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: serviceAccess }));
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    businessGoal: {
      findMany: db.goalFindMany,
      findFirst: db.goalFindFirst,
      updateMany: db.goalUpdateMany,
    },
    $transaction: db.transaction,
  },
}));
import { WorkspaceAgentProactiveService } from "../src/modules/workspace-agent/workspace-agent.proactive.service.js";
import { businessGoalSchema } from "../src/modules/workspace-agent/workspace-agent.proactive.validation.js";

const context = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  roleCode: "ORGANIZATION_OWNER",
  permissions: ["FINANCE_VIEW", "FINANCE_MANAGE"],
};
const input = {
  type: "MONTHLY_REVENUE" as const,
  title: "Reach monthly revenue target",
  targetValue: 500000,
  periodStart: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-08-31T23:59:59.999Z",
};

describe("Ask SATHOS proactive management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceAccess.mockResolvedValue("READ_WRITE");
    db.goalFindMany.mockResolvedValue([]);
    db.goalUpdateMany.mockResolvedValue({ count: 1 });
    db.goalCreate.mockResolvedValue({ id: "goal-1", ...input });
    db.auditCreate.mockResolvedValue({});
    db.transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run({
        businessGoal: { create: db.goalCreate },
        auditEvent: { create: db.auditCreate },
      }),
    );
  });

  it("rejects zero targets and inverted periods", () => {
    expect(
      businessGoalSchema.safeParse({
        ...input,
        targetValue: 0,
        periodEnd: "2026-07-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("creates goals only in authenticated organization context and audits them", async () => {
    await new WorkspaceAgentProactiveService().createGoal(context, input);
    expect(db.goalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: context.organizationId,
          createdById: context.userId,
        }),
      }),
    );
    expect(db.auditCreate).toHaveBeenCalled();
  });

  it("scopes goal listing to the authenticated organization", async () => {
    await new WorkspaceAgentProactiveService().goals(context);
    expect(db.goalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: context.organizationId,
          archivedAt: null,
        },
      }),
    );
  });

  it("blocks financial goal creation without finance management permission", async () => {
    serviceAccess.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
    await expect(
      new WorkspaceAgentProactiveService().createGoal(
        { ...context, permissions: ["FINANCE_VIEW"] },
        input,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.goalCreate).not.toHaveBeenCalled();
  });

  it("checks goal type entitlement and manage permission before archive", async () => {
    db.goalFindFirst.mockResolvedValue({ type: "MONTHLY_REVENUE" });
    await new WorkspaceAgentProactiveService().archiveGoal(context, "goal-1");
    expect(serviceAccess).toHaveBeenCalledWith(expect.objectContaining({ organizationId: context.organizationId }), "FINANCE", "FINANCE_MANAGE");
    expect(db.goalUpdateMany).toHaveBeenCalled();
  });

  it("does not archive a goal when its owning service is unavailable", async () => {
    db.goalFindFirst.mockResolvedValue({ type: "PROJECT_COMPLETION" });
    serviceAccess.mockRejectedValueOnce(Object.assign(new Error("Disabled"), { statusCode: 403 }));
    await expect(new WorkspaceAgentProactiveService().archiveGoal(context, "goal-1")).rejects.toMatchObject({ statusCode: 403 });
    expect(db.goalUpdateMany).not.toHaveBeenCalled();
  });
});
