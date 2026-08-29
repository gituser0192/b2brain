import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeterministicEnquiryAgentProvider, type EnquiryAgentProvider } from "../src/modules/enquiry-agent/enquiry-agent.provider.js";

const db = vi.hoisted(() => ({
  connectorFindFirst: vi.fn(),
  connectorCreate: vi.fn(),
  connectorUpdate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCount: vi.fn(),
  organizationFindFirst: vi.fn(),
  customerFindMany: vi.fn(),
  inquiryFindMany: vi.fn(),
  membershipFindFirst: vi.fn(),
  transaction: vi.fn(),
  txCustomerCreate: vi.fn(),
  txEventCreate: vi.fn(),
  txEventUpdate: vi.fn(),
  txInquiryCreate: vi.fn(),
  txInquiryUpdate: vi.fn(),
  txTimelineCreate: vi.fn(),
  txActivityCreate: vi.fn(),
  txFollowUpCreate: vi.fn(),
  txDraftCreate: vi.fn(),
  txApprovalCreate: vi.fn(),
  txNotificationUpsert: vi.fn(),
  txAuditCreate: vi.fn(),
  txConnectorUpdate: vi.fn(),
}));

vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    integrationConnector: { findFirst: db.connectorFindFirst, create: db.connectorCreate, update: db.connectorUpdate },
    integrationEvent: { findFirst: db.eventFindFirst, count: db.eventCount },
    organization: { findFirst: db.organizationFindFirst },
    customer: { findMany: db.customerFindMany },
    inquiry: { findMany: db.inquiryFindMany },
    organizationMembership: { findFirst: db.membershipFindFirst },
    $transaction: db.transaction,
  },
}));

import { EnquiryAgentService } from "../src/modules/enquiry-agent/enquiry-agent.service.js";

const ids = {
  orgA: "00000000-0000-4000-8000-00000000000a",
  orgB: "00000000-0000-4000-8000-00000000000b",
  user: "00000000-0000-4000-8000-000000000001",
  connector: "00000000-0000-4000-8000-000000000002",
  customer: "00000000-0000-4000-8000-000000000003",
  event: "00000000-0000-4000-8000-000000000004",
  inquiry: "00000000-0000-4000-8000-000000000005",
  draft: "00000000-0000-4000-8000-000000000006",
  approval: "00000000-0000-4000-8000-000000000007",
};

const input = (overrides: Record<string, unknown> = {}) => ({
  channel: "WEBSITE_PLAYGROUND" as const,
  externalMessageId: "launch-message-1",
  conversationId: "00000000-0000-4000-8000-000000000008",
  customerName: "Launch Customer",
  phone: "919999990001",
  message: "I need CRM setup",
  metadata: {},
  ...overrides,
});

const tx = {
  customer: { create: db.txCustomerCreate },
  integrationEvent: { create: db.txEventCreate, update: db.txEventUpdate },
  inquiry: { create: db.txInquiryCreate, update: db.txInquiryUpdate },
  inquiryTimeline: { create: db.txTimelineCreate },
  customerActivity: { create: db.txActivityCreate },
  customerFollowUp: { create: db.txFollowUpCreate },
  automationMessageDraft: { create: db.txDraftCreate },
  approvalRequest: { create: db.txApprovalCreate },
  notification: { upsert: db.txNotificationUpsert },
  auditEvent: { create: db.txAuditCreate },
  integrationConnector: { update: db.txConnectorUpdate },
};

function configure(configuration: Record<string, unknown> = {}) {
  db.connectorFindFirst.mockResolvedValue({ id: ids.connector, configuration });
  db.eventFindFirst.mockResolvedValue(null);
  db.eventCount.mockResolvedValue(0);
  db.organizationFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id, name: where.id === ids.orgA ? "Cosmic Academy" : "Northwind Repairs" }),
  );
  db.customerFindMany.mockResolvedValue([]);
  db.inquiryFindMany.mockResolvedValue([]);
  db.membershipFindFirst.mockResolvedValue({ userId: ids.user });
  db.txCustomerCreate.mockResolvedValue({ id: ids.customer, displayName: "Launch Customer" });
  db.txEventCreate.mockResolvedValue({ id: ids.event });
  db.txEventUpdate.mockResolvedValue({});
  db.txInquiryCreate.mockResolvedValue({ id: ids.inquiry });
  db.txInquiryUpdate.mockResolvedValue({ id: ids.inquiry });
  db.txTimelineCreate.mockResolvedValue({});
  db.txActivityCreate.mockResolvedValue({});
  db.txFollowUpCreate.mockResolvedValue({});
  db.txDraftCreate.mockResolvedValue({ id: ids.draft });
  db.txApprovalCreate.mockResolvedValue({ id: ids.approval });
  db.txNotificationUpsert.mockResolvedValue({});
  db.txAuditCreate.mockResolvedValue({});
  db.txConnectorUpdate.mockResolvedValue({});
  db.transaction.mockImplementation((run: (client: typeof tx) => unknown) => Promise.resolve(run(tx)));
}

const knowledge = {
  approvedForAgent: vi.fn((organizationId: string) => Promise.resolve([
    {
      id: organizationId === ids.orgA ? "cosmic-approved" : "northwind-approved",
      title: "Approved services",
      category: "SERVICE",
      content: organizationId === ids.orgA ? "Cosmic Academy provides mathematics coaching." : "Northwind Repairs services appliances.",
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    },
  ])),
};

describe("customer enquiry agent launch readiness orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configure();
  });

  it("creates organization-scoped CRM records and never performs an external action", async () => {
    const result = await new EnquiryAgentService(
      new DeterministicEnquiryAgentProvider(),
      knowledge as never,
    ).process(ids.orgA, ids.user, input());
    for (const create of [db.txCustomerCreate, db.txEventCreate, db.txInquiryCreate, db.txTimelineCreate, db.txActivityCreate, db.txFollowUpCreate, db.txDraftCreate, db.txAuditCreate]) {
      // Vitest matcher factories are intentionally dynamic.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: ids.orgA }) }));
    }
    expect(result).toMatchObject({ duplicate: false, customerCreated: true, externalActionPerformed: false });
  });

  it("returns an idempotent result without running CRM writes for a duplicate message", async () => {
    db.eventFindFirst.mockResolvedValue({ id: ids.event, resultId: ids.inquiry, status: "COMPLETED", payload: {} });
    const result = await new EnquiryAgentService(
      new DeterministicEnquiryAgentProvider(),
      knowledge as never,
    ).process(ids.orgA, ids.user, input());
    expect(result).toMatchObject({ duplicate: true, eventId: ids.event, inquiryId: ids.inquiry });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("retrieves and writes only within the active organization context", async () => {
    await new EnquiryAgentService(
      new DeterministicEnquiryAgentProvider(),
      knowledge as never,
    ).process(ids.orgB, ids.user, input({ externalMessageId: "org-b-message" }));
    expect(knowledge.approvedForAgent).toHaveBeenCalledWith(ids.orgB);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(db.customerFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: ids.orgB }) }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(db.txInquiryCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: ids.orgB }) }));
    // Prisma is mocked at the persistence boundary for this orchestration test.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const eventPayload = db.txEventCreate.mock.calls[0]?.[0].data.payload as { knowledgeSources: Array<{ id: string }> };
    expect(JSON.stringify(eventPayload)).not.toContain("cosmic-approved");
  });

  it("does not create an automatic reply draft during human takeover", async () => {
    const conversationId = String(input().conversationId);
    configure({ humanTakeoverConversationIds: [conversationId] });
    const result = await new EnquiryAgentService(
      new DeterministicEnquiryAgentProvider(),
      knowledge as never,
    ).process(ids.orgA, ids.user, input());
    expect(result.humanTakeover).toBe(true);
    expect(db.txDraftCreate).not.toHaveBeenCalled();
  });

  it("uses deterministic fallback after the real-AI daily usage limit", async () => {
    const analyze = vi.fn();
    const primary: EnquiryAgentProvider = {
      name: "test-real-ai",
      productionModel: true,
      killSwitchActive: false,
      analyze,
    };
    db.eventCount.mockResolvedValue(1_000_000);
    const result = await new EnquiryAgentService(primary, knowledge as never)
      .process(ids.orgA, ids.user, input({ externalMessageId: "limited-message" }));
    expect(analyze).not.toHaveBeenCalled();
    expect(result.provider).toMatchObject({ source: "DETERMINISTIC_FALLBACK", usageLimitReached: true });
  });

  it("preserves the inbound message and CRM transaction when the AI provider fails", async () => {
    const failing: EnquiryAgentProvider = {
      name: "timed-out-provider",
      productionModel: true,
      killSwitchActive: false,
      analyze: () => Promise.reject(new Error("timeout")),
    };
    const result = await new EnquiryAgentService(failing, knowledge as never)
      .process(ids.orgA, ids.user, input({ externalMessageId: "provider-failure" }));
    // The service has an idempotent early-return union; this branch is asserted by the transaction calls below.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.provider?.source).toBe("DETERMINISTIC_FALLBACK");
    expect(db.txEventCreate).toHaveBeenCalledOnce();
    expect(db.txInquiryCreate).toHaveBeenCalledOnce();
    expect(db.txActivityCreate).toHaveBeenCalledOnce();
  });

  it("keeps refund and payment requests human-only and approval-gated", async () => {
    const result = await new EnquiryAgentService(
      new DeterministicEnquiryAgentProvider(),
      knowledge as never,
    ).process(ids.orgA, ids.user, input({
      externalMessageId: "refund-request",
      message: "Refund my UPI payment now",
    }));
    expect(result).toMatchObject({ approvalRequired: true, humanTakeover: true, externalActionPerformed: false });
    expect(db.txDraftCreate).toHaveBeenCalledWith(expect.objectContaining({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({ status: "PENDING_APPROVAL" }),
    }));
    expect(db.txApprovalCreate).toHaveBeenCalledWith(expect.objectContaining({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({ riskLevel: "HIGH" }),
    }));
  });
});
