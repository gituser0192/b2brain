/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ inquiries: vi.fn(), inquiry: vi.fn(), events: vi.fn(), eventGroups: vi.fn(), drafts: vi.fn(), timeline: vi.fn(), connectors: vi.fn() }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  inquiry: { findMany: db.inquiries, findFirst: db.inquiry },
  integrationEvent: { findMany: db.events, groupBy: db.eventGroups }, automationMessageDraft: { findMany: db.drafts },
  inquiryTimeline: { findFirst: db.timeline }, integrationConnector: { findMany: db.connectors },
} }));
vi.mock("../src/config/env.js", () => ({ env: {} }));
vi.mock("../src/config/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { WhatsappService } from "../src/modules/automation-bridge/whatsapp.service.js";
import { whatsappConversationIdSchema, whatsappConversationListQuerySchema } from "../src/modules/automation-bridge/whatsapp-conversation.validation.js";

const org = crypto.randomUUID(), inquiryId = crypto.randomUUID(), otherOrg = crypto.randomUUID();
const inquiry = { id: inquiryId, contactName: "Synthetic Customer", phone: "+919876543210", type: "SALES_OPPORTUNITY", status: "REVIEWING", subject: "Pricing", message: "Need pricing", customerId: null, updatedAt: new Date("2026-09-13T10:00:00Z") };

describe("WhatsApp customer conversation contract", () => {
  beforeEach(() => { vi.clearAllMocks(); db.inquiries.mockResolvedValue([inquiry]); db.eventGroups.mockResolvedValue([{ resultId: inquiryId, _max: { createdAt: inquiry.updatedAt } }]); db.events.mockResolvedValue([{ id: crypto.randomUUID(), connectorId: crypto.randomUUID(), resultId: inquiryId, payload: { message: "Latest safe message" }, status: "COMPLETED", createdAt: inquiry.updatedAt }]); db.drafts.mockResolvedValue([]); db.timeline.mockResolvedValue(null); db.connectors.mockResolvedValue([]); db.inquiry.mockResolvedValue(inquiry); });

  it("validates bounded pagination and canonical UUIDs", () => {
    expect(whatsappConversationListQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(() => whatsappConversationListQuerySchema.parse({ limit: 51 })).toThrow();
    expect(whatsappConversationIdSchema.parse(inquiryId)).toBe(inquiryId);
    expect(() => whatsappConversationIdSchema.parse("919876543210")).toThrow();
  });

  it("returns bounded organization-scoped summaries without histories or raw phones", async () => {
    const result = await new WhatsappService().conversationSummaries(org, { page: 1, limit: 25 });
    expect(db.eventGroups).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: org, resultType: "INQUIRY" }), take: 26 }));
    expect(db.inquiries).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: org, source: "WHATSAPP", id: { in: [inquiryId] } }) }));
    expect(result.conversations[0]).toMatchObject({ conversationId: inquiryId, maskedContact: "••••3210", latestMessagePreview: "Latest safe message" });
    expect(JSON.stringify(result)).not.toContain("919876543210");
    expect(result.conversations[0]).not.toHaveProperty("messages");
  });

  it("uses stable page bounds and reports hasMore", async () => {
    const records = Array.from({ length: 3 }, (_, index) => ({ ...inquiry, id: crypto.randomUUID(), contactName: `Customer ${index}` }));
    db.eventGroups.mockResolvedValue(records.map(item => ({ resultId: item.id, _max: { createdAt: item.updatedAt } })));
    db.inquiries.mockResolvedValue(records);
    db.events.mockResolvedValue([]);
    const result = await new WhatsappService().conversationSummaries(org, { page: 2, limit: 2 });
    expect(db.eventGroups).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 3, orderBy: [{ _max: { createdAt: "desc" } }, { resultId: "asc" }] }));
    expect(result.pagination).toEqual({ page: 2, limit: 2, hasMore: true });
  });

  it("omits unsupported events that are not linked to an organization-owned WhatsApp inquiry", async () => {
    db.inquiries.mockResolvedValue([]);
    const result = await new WhatsappService().conversationSummaries(org, { page: 1, limit: 25 });
    expect(result.conversations).toEqual([]);
  });

  it("loads one conversation chronologically and keeps every query organization-scoped", async () => {
    const eventId = crypto.randomUUID(); db.events.mockResolvedValue([{ id: eventId, connectorId: crypto.randomUUID(), payload: { message: "First" }, status: "COMPLETED", createdAt: new Date("2026-09-13T10:00:00Z") }]);
    db.drafts.mockResolvedValue([{ id: crypto.randomUUID(), eventId, body: "Second", status: "PENDING_APPROVAL", failureMessage: null, createdAt: new Date("2026-09-13T10:01:00Z"), sentAt: null, connector: { name: "Simulator", provider: "B2BRAIN_SIMULATOR" } }]);
    const result = await new WhatsappService().conversationDetail(org, inquiryId);
    expect(db.inquiry).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: inquiryId, organizationId: org }) }));
    expect(result.messages.map(item => item.body)).toEqual(["First", "Second"]);
    expect(JSON.stringify(result)).not.toContain(inquiry.phone);
    expect(db.drafts).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: org, eventId: { in: [eventId] } }) }));
  });

  it("returns the same safe not-found result for absent and cross-organization conversations", async () => {
    db.inquiry.mockResolvedValue(null);
    await expect(new WhatsappService().conversationDetail(org, inquiryId)).rejects.toMatchObject({ statusCode: 404, code: "WHATSAPP_CONVERSATION_NOT_FOUND" });
    await expect(new WhatsappService().conversationDetail(otherOrg, inquiryId)).rejects.toMatchObject({ statusCode: 404, code: "WHATSAPP_CONVERSATION_NOT_FOUND" });
  });
});
