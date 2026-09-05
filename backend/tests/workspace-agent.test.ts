/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  connectorFindFirst: vi.fn(),
  connectorCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdate: vi.fn(),
  eventUpdateMany: vi.fn(),
  eventFindMany: vi.fn(),
  customerCount: vi.fn(),
  customerFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  txCustomerCreate: vi.fn(),
  txAuditCreate: vi.fn(),
}));
const proactive = vi.hoisted(() => ({ brief: vi.fn(), goals: vi.fn() }));
const serviceAccess = vi.hoisted(() => vi.fn());
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: serviceAccess }));
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    integrationConnector: {
      findFirst: db.connectorFindFirst,
      create: db.connectorCreate,
    },
    integrationEvent: {
      findFirst: db.eventFindFirst,
      create: db.eventCreate,
      update: db.eventUpdate,
      updateMany: db.eventUpdateMany,
      findMany: db.eventFindMany,
    },
    customer: { count: db.customerCount, findFirst: db.customerFindFirst },
    auditEvent: { create: db.auditCreate },
    $transaction: db.transaction,
  },
}));
vi.mock(
  "../src/modules/workspace-agent/workspace-agent.proactive.service.js",
  () => ({
    WorkspaceAgentProactiveService: class {
      brief = proactive.brief;
      goals = proactive.goals;
    },
  }),
);
import { WorkspaceAgentService } from "../src/modules/workspace-agent/workspace-agent.service.js";
import { workspaceAgentMessageSchema } from "../src/modules/workspace-agent/workspace-agent.validation.js";
import { env } from "../src/config/env.js";
import { AppError } from "../src/shared/errors/app-error.js";

const context = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  roleCode: "ORGANIZATION_OWNER",
  permissions: ["CRM_VIEW", "CRM_CREATE"],
};
const input = (message: string, id = "message-1") => ({
  conversationId: "00000000-0000-4000-8000-000000000004",
  externalMessageId: id,
  message,
});

describe("Ask B² Brain workspace agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.connectorFindFirst.mockResolvedValue({
      id: "connector-1",
      configuration: {},
    });
    db.eventFindFirst.mockResolvedValue(null);
    db.eventCreate.mockResolvedValue({ id: "event-1" });
    db.eventUpdate.mockResolvedValue({ id: "event-1" });
    db.eventUpdateMany.mockResolvedValue({ count: 1 });
    db.auditCreate.mockResolvedValue({});
    db.transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run({
        customer: { create: db.txCustomerCreate },
        auditEvent: { create: db.txAuditCreate },
      }),
    );
    db.txAuditCreate.mockResolvedValue({});
    proactive.brief.mockResolvedValue({
      meaningful: true,
      alerts: [{ code: "OVERDUE_TASKS" }],
      recommendations: [{ title: "Review tasks" }],
      health: { score: 72, missingData: [] },
      activity: {
        newCustomers: 3,
        newLeads: 2,
        overdueFollowUps: 4,
        overdueTasks: 5,
      },
    });
    proactive.goals.mockResolvedValue([
      { id: "goal-1", risk: "HIGH" },
      { id: "goal-2", risk: "ON_TRACK" },
    ]);
  });
  it("counts only customers in the authenticated organization", async () => {
    db.customerCount.mockResolvedValue(4);
    const result = await new WorkspaceAgentService().message(
      context,
      input("Check total number of customers we have"),
    );
    expect(db.customerCount).toHaveBeenCalledWith({
      where: { organizationId: context.organizationId, deletedAt: null },
    });
    expect(result).toMatchObject({
      answer: "Your organization has 4 CRM customers.",
    });
  });
  it("keeps simple factual requests on the zero-token path", async () => {
    const provider = { enabled: true, name: "test", analyze: vi.fn() };
    db.customerCount.mockResolvedValue(2);
    await new WorkspaceAgentService(provider).message(
      context,
      input("Count all CRM customers", "zero-token"),
    );
    expect(provider.analyze).not.toHaveBeenCalled();
    expect(db.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            diagnostics: expect.objectContaining({ aiCalled: false, inputTokens: 0 }),
          }),
        }),
      }),
    );
  });
  it("uses hosted reasoning only for complex analysis with backend facts", async () => {
    db.eventFindMany.mockResolvedValue([]);
    proactive.goals.mockResolvedValue([]);
    const provider = {
      enabled: true,
      name: "test",
      analyze: vi.fn().mockResolvedValue({
        answer: "Prioritize overdue work using the verified figures.",
        evidenceReferences: ["activity.overdueTasks"],
        conclusions: ["Execution needs attention."],
        recommendations: [{ action: "Review overdue tasks", reason: "Five are overdue.", expectedImpact: "Improve delivery." }],
        assumptions: [], missingData: [], confidence: "HIGH",
        proposedToolActions: ["NAVIGATE"], requiresConfirmation: true,
        requiresHumanEscalation: false, source: "REAL_AI",
        providerName: "test", model: "test-model",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }),
    };
    const result = await new WorkspaceAgentService(provider).message(
      context,
      input("What should I improve?", "reasoning-1"),
    );
    expect(provider.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantKey: context.organizationId,
        request: "What should I improve?",
        facts: expect.arrayContaining([
          expect.objectContaining({ id: "activity.overdueTasks", value: 5 }),
        ]),
      }),
    );
    expect(result).toMatchObject({
      answer: "Prioritize overdue work using the verified figures.",
      reasoning: { source: "REAL_AI", requiresConfirmation: true },
    });
  });
  it("creates a customer after an explicit request and audits it", async () => {
    db.customerFindFirst.mockResolvedValue(null);
    db.txCustomerCreate.mockResolvedValue({
      id: "customer-1",
      displayName: "Rahul",
    });
    const result = await new WorkspaceAgentService().message(
      context,
      input("Add Rahul with phone number 9876543210 to CRM", "message-2"),
    );
    expect(db.txCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: context.organizationId,
          phone: "9876543210",
        }),
      }),
    );
    expect(db.txAuditCreate).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: "Rahul was added to CRM as a lead.",
    });
  });
  it("Python fact collection rechecks current service access and authenticated tenant", async () => {
    const saved = { ...env };
    try {
      Object.assign(env, { WORKSPACE_AGENT_REASONING_BACKEND: "python", PYTHON_AGENT_ENABLED: true });
      db.eventFindMany.mockResolvedValue([]);
      proactive.goals.mockResolvedValue([]);
      serviceAccess.mockRejectedValue(new AppError(403, "Not assigned"));
      const provider = { enabled: true, name: "python-test", analyze: vi.fn().mockResolvedValue({ answer: "Insufficient permitted information", evidenceReferences: [], conclusions: [], recommendations: [], assumptions: [], missingData: [], confidence: "LOW", proposedToolActions: [], requiresConfirmation: false, requiresHumanEscalation: false, source: "DETERMINISTIC_FALLBACK", providerName: "python-test", model: null, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }) };
      await new WorkspaceAgentService(provider).message(context, input("What should I improve?", "python-scope"));
      expect(serviceAccess).toHaveBeenCalledWith(expect.objectContaining({ organizationId: context.organizationId, membershipId: context.membershipId }), "CRM");
      expect(proactive.brief).toHaveBeenCalledWith(expect.objectContaining({ organizationId: context.organizationId, permissions: ["CRM_CREATE"] }));
      expect(db.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: context.organizationId }) }));
      expect(db.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: context.organizationId }) }));
    } finally { Object.assign(env, saved); }
  });
  it("Python usage caps include in-flight reservations and do not call a provider over budget", async () => {
    const saved = { ...env };
    try {
      Object.assign(env, { WORKSPACE_AGENT_REASONING_BACKEND: "python", PYTHON_AGENT_ENABLED: true, WORKSPACE_AI_DAILY_TOKEN_LIMIT: 1000 });
      db.eventFindMany.mockResolvedValue([{ createdAt: new Date(), status: "PROCESSING", payload: {} }]);
      proactive.goals.mockResolvedValue([]);
      const provider = { enabled: true, name: "python-test", analyze: vi.fn() };
      const result = await new WorkspaceAgentService(provider).message({ ...context, permissions: [] }, input("What should I improve?", "python-budget"));
      expect(provider.analyze).not.toHaveBeenCalled();
      expect(result).toMatchObject({ reasoning: { source: "DETERMINISTIC_FALLBACK" } });
    } finally { Object.assign(env, saved); }
  });
  it("does not duplicate tool execution when the message ID is retried", async () => {
    db.eventFindFirst.mockResolvedValue({
      id: "event-existing",
      payload: { output: { answer: "Previously completed" } },
    });
    const result = await new WorkspaceAgentService().message(
      context,
      input("Count all CRM customers"),
    );
    expect(result).toMatchObject({
      duplicate: true,
      answer: "Previously completed",
    });
    expect(db.customerCount).not.toHaveBeenCalled();
    expect(db.eventCreate).not.toHaveBeenCalled();
  });
  it("blocks a concurrent request after its idempotency reservation exists", async () => {
    db.eventFindFirst.mockResolvedValue({
      id: "event-processing",
      status: "PROCESSING",
      payload: { conversationId: input("x").conversationId },
    });
    await expect(
      new WorkspaceAgentService().message(
        context,
        input("Count all CRM customers", "same-concurrent-message"),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "WORKSPACE_AGENT_REQUEST_RESERVED",
    });
    expect(db.customerCount).not.toHaveBeenCalled();
    expect(db.eventCreate).not.toHaveBeenCalled();
  });
  it("rejects frontend identity and organization fields", () => {
    expect(
      workspaceAgentMessageSchema.safeParse({
        ...input("Hello"),
        organizationId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("blocks CRM reads for restricted employees", async () => {
    await expect(
      new WorkspaceAgentService().message(
        { ...context, permissions: [] },
        input("Count all CRM customers"),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.customerCount).not.toHaveBeenCalled();
  });
  it("loads history only through the organization-scoped connector", async () => {
    db.eventFindMany.mockResolvedValue([]);
    await new WorkspaceAgentService().history(
      context,
      input("x").conversationId,
    );
    expect(db.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: context.organizationId,
          connectorId: "connector-1",
        }),
      }),
    );
  });
  it.each([
    ["today's brief", "brief"],
    ["Review Today’s Brief.", "brief"],
    ["goals", "goals"],
    ["Create a measurable goal.", "goals"],
    ["New customers", "brief"],
    ["Overdue follow-ups/tasks", "brief"],
  ])("routes management phrase %s to %s", async (message, section) => {
    const result = await new WorkspaceAgentService().message(
      context,
      input(message, `intent-${message}`),
    );
    expect(result).toMatchObject({ managementSection: section });
  });
});
