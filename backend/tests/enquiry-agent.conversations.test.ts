/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  connectorFindFirst: vi.fn(),
  connectorUpdate: vi.fn(),
  eventFindMany: vi.fn(),
  inquiryFindMany: vi.fn(),
  followUpFindMany: vi.fn(),
}));

vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    integrationConnector: {
      findFirst: db.connectorFindFirst,
      update: db.connectorUpdate,
    },
    integrationEvent: { findMany: db.eventFindMany },
    inquiry: { findMany: db.inquiryFindMany },
    customerFollowUp: { findMany: db.followUpFindMany },
  },
}));

import { EnquiryAgentService } from "../src/modules/enquiry-agent/enquiry-agent.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const connectorId = "00000000-0000-4000-8000-000000000003";
const conversationId = "00000000-0000-4000-8000-000000000004";
const inquiryId = "00000000-0000-4000-8000-000000000005";

describe("enquiry-agent conversation inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.connectorFindFirst.mockResolvedValue({
      id: connectorId,
      configuration: { humanTakeoverConversationIds: [] },
    });
    db.inquiryFindMany.mockResolvedValue([
      { id: inquiryId, customerId: "customer-1", status: "NEW" },
    ]);
    db.followUpFindMany.mockResolvedValue([
      { id: "follow-up-1", customerId: "customer-1" },
    ]);
    db.connectorUpdate.mockResolvedValue({});
  });

  it("lists only organization-scoped conversations with friendly inbox state", async () => {
    db.eventFindMany.mockResolvedValue([
      {
        id: "event-1",
        resultId: inquiryId,
        status: "COMPLETED",
        createdAt: new Date("2026-08-29T08:00:00.000Z"),
        payload: {
          conversationId,
          customerName: "Test Customer",
          phone: "919876543210",
          message: "What services do you provide?",
          analysis: { intent: "SALES_ENQUIRY" },
        },
        messageDrafts: [{ status: "PENDING_APPROVAL" }],
      },
    ]);
    const result = await new EnquiryAgentService().conversations(
      organizationId,
    );
    expect(db.connectorFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId }),
      }),
    );
    expect(db.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId, connectorId }),
      }),
    );
    expect(result[0]).toMatchObject({
      conversationId,
      customerId: "customer-1",
      inquiryId,
      followUpId: "follow-up-1",
      status: "WAITING_APPROVAL",
      unreadCount: 1,
    });
  });

  it("persists read state inside the organization connector configuration", async () => {
    db.eventFindMany.mockResolvedValue([{ payload: { conversationId } }]);
    await new EnquiryAgentService().markConversationRead(
      organizationId,
      userId,
      conversationId,
    );
    expect(db.connectorUpdate).toHaveBeenCalledWith({
      where: { id: connectorId },
      data: expect.objectContaining({
        updatedById: userId,
        configuration: expect.objectContaining({
          conversationReadAt: expect.objectContaining({
            [conversationId]: expect.any(String),
          }),
        }),
      }),
    });
  });

  it("does not mark an inaccessible conversation as read", async () => {
    db.eventFindMany.mockResolvedValue([
      { payload: { conversationId: crypto.randomUUID() } },
    ]);
    await expect(
      new EnquiryAgentService().markConversationRead(
        organizationId,
        userId,
        conversationId,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.connectorUpdate).not.toHaveBeenCalled();
  });
});
