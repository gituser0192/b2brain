/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  connectorFindFirst: vi.fn(),
  connectorCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  eventFindMany: vi.fn(),
  customerCount: vi.fn(),
  customerFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  txCustomerCreate: vi.fn(),
  txAuditCreate: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    integrationConnector: {
      findFirst: db.connectorFindFirst,
      create: db.connectorCreate,
    },
    integrationEvent: {
      findFirst: db.eventFindFirst,
      create: db.eventCreate,
      findMany: db.eventFindMany,
    },
    customer: { count: db.customerCount, findFirst: db.customerFindFirst },
    auditEvent: { create: db.auditCreate },
    $transaction: db.transaction,
  },
}));
import { WorkspaceAgentService } from "../src/modules/workspace-agent/workspace-agent.service.js";
import { workspaceAgentMessageSchema } from "../src/modules/workspace-agent/workspace-agent.validation.js";

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
    db.auditCreate.mockResolvedValue({});
    db.transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run({
        customer: { create: db.txCustomerCreate },
        auditEvent: { create: db.txAuditCreate },
      }),
    );
    db.txAuditCreate.mockResolvedValue({});
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
});
