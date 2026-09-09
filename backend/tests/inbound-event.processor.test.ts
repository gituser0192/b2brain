import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedInboundEvent } from "../src/modules/automation-bridge/contracts/inbound-event.contract.js";

const database = vi.hoisted(() => ({
  integrationConnector: { findFirst: vi.fn() },
  integrationEvent: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
}));
const orderCreate = vi.hoisted(() => vi.fn());
vi.mock("../src/database/prisma.js", () => ({ prisma: database }));
vi.mock("../src/modules/orders/order.service.js", () => ({ OrderService: class { createWebsiteDraft = orderCreate; } }));

import { InboundEventProcessor } from "../src/modules/automation-bridge/processing/inbound-event.processor.js";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const CONNECTOR = "10000000-0000-4000-8000-00000000000a";
const event: NormalizedInboundEvent = {
  version: "1", channel: "SIMULATOR", eventType: "CUSTOMER_MESSAGE", externalEventId: "sim-001",
  occurredAt: "2026-09-06T10:00:00.000Z", receivedAt: "2026-09-06T10:00:01.000Z", connectorId: CONNECTOR,
  sender: { name: "Synthetic Customer", phone: "919876543210" }, content: { text: "Need a quotation" },
  metadata: { simulator: true }, correlationId: "b516e37e-06a8-47e7-a1e1-9364a5630307",
};

describe("shared inbound event processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR, provider: "B2BRAIN_SIMULATOR", configuration: { simulator: true } });
    database.integrationEvent.findFirst.mockResolvedValue(null);
    database.auditEvent.create.mockResolvedValue({});
    orderCreate.mockResolvedValue({ duplicate: false, status: "AWAITING_APPROVAL", reviewRequired: true });
  });

  it("scopes connector lookup to the authenticated organization and delegates once", async () => {
    const process = vi.fn().mockResolvedValue({
      duplicate: false, eventId: crypto.randomUUID(), conversationId: event.correlationId,
      customer: { id: crypto.randomUUID(), displayName: "Synthetic Customer" }, customerCreated: true,
      inquiryId: crypto.randomUUID(), analysis: { intent: "SALES_ENQUIRY", confidence: 0.9, promptInjectionDetected: false },
      response: "Thanks", tools: ["create_customer"], approvalRequired: false, humanTakeover: false, externalActionPerformed: false,
    });
    const result = await new InboundEventProcessor({ process } as never).processAuthenticatedSimulator(ORG_A, crypto.randomUUID(), event);
    const connectorCall = database.integrationConnector.findFirst.mock.calls[0] as unknown as [{ where: { organizationId: string; status: string } }];
    expect(connectorCall[0].where).toMatchObject({ organizationId: ORG_A, status: "ACTIVE" });
    expect(process).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ version: "1", duplicate: false, processingStatus: "COMPLETED", externalActionPerformed: false });
  });

  it("rejects another organization's or disabled connector without running CRM", async () => {
    database.integrationConnector.findFirst.mockResolvedValue(null);
    const process = vi.fn();
    await expect(new InboundEventProcessor({ process } as never).processAuthenticatedSimulator(ORG_A, crypto.randomUUID(), event))
      .rejects.toMatchObject({ statusCode: 404, code: "CONNECTOR_NOT_FOUND" });
    expect(process).not.toHaveBeenCalled();
  });

  it("returns a bounded completed duplicate and never reruns side effects", async () => {
    database.integrationEvent.findFirst.mockResolvedValue({ id: crypto.randomUUID(), status: "COMPLETED", resultId: crypto.randomUUID(), traceId: crypto.randomUUID() });
    const process = vi.fn();
    const result = await new InboundEventProcessor({ process } as never).processAuthenticatedSimulator(ORG_A, crypto.randomUUID(), event);
    expect(result).toMatchObject({ version: "1", duplicate: true, processingStatus: "COMPLETED", externalActionPerformed: false });
    expect(process).not.toHaveBeenCalled();
  });

  it("rejects an in-progress duplicate", async () => {
    database.integrationEvent.findFirst.mockResolvedValue({ id: crypto.randomUUID(), status: "PROCESSING", resultId: null, traceId: crypto.randomUUID() });
    await expect(new InboundEventProcessor({ process: vi.fn() } as never).processAuthenticatedSimulator(ORG_A, crypto.randomUUID(), event))
      .rejects.toMatchObject({ statusCode: 409, code: "EVENT_PROCESSING" });
  });

  it("records only redacted retry evidence when processing fails", async () => {
    const process = vi.fn().mockRejectedValue(new Error("provider detail must not be returned"));
    await expect(new InboundEventProcessor({ process } as never).processAuthenticatedSimulator(ORG_A, crypto.randomUUID(), event)).rejects.toThrow();
    const auditCall = database.auditEvent.create.mock.calls[0] as unknown as [{ data: { actionCode: string; metadata: { retrySafe: boolean } } }];
    expect(auditCall[0].data).toMatchObject({ actionCode: "INBOUND_EVENT_FAILED", metadata: { retrySafe: true } });
    expect(JSON.stringify(auditCall)).not.toContain(event.content.text);
  });

  it("accepts a verified website event through the same processor without a second CRM workflow", async () => {
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR });
    const process = vi.fn().mockResolvedValue({
      duplicate: false, eventId: crypto.randomUUID(), conversationId: event.correlationId,
      customer: { id: crypto.randomUUID(), displayName: "Synthetic Customer" }, customerCreated: false,
      inquiryId: crypto.randomUUID(), analysis: { intent: "PRODUCT_QUESTION", confidence: 0.88, promptInjectionDetected: false },
      response: "A person will review this enquiry.", tools: ["update_inquiry"], approvalRequired: true,
      humanTakeover: false, externalActionPerformed: false,
    });
    const websiteEvent: NormalizedInboundEvent = { ...event, channel: "WEBSITE", eventType: "WEBSITE_ENQUIRY" };
    const result = await new InboundEventProcessor({ process } as never)
      .processVerifiedWebsite(ORG_A, crypto.randomUUID(), websiteEvent);
    expect(database.integrationConnector.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: CONNECTOR, organizationId: ORG_A, type: "WEBSITE", status: "ACTIVE", deletedAt: null },
    }));
    expect(process).toHaveBeenCalledOnce();
    expect(process).toHaveBeenCalledWith(ORG_A, expect.any(String), expect.objectContaining({ channel: "WEBSITE" }),
      { connectorId: CONNECTOR, source: "WEBSITE" });
    expect(result).toMatchObject({ duplicate: false, externalActionPerformed: false });
  });

  it("delegates verified WhatsApp text to the shared CRM agent with approval required", async () => {
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR });
    const process = vi.fn().mockResolvedValue({
      duplicate: false, eventId: crypto.randomUUID(), customer: null, customerCreated: true,
      inquiryId: crypto.randomUUID(), analysis: { intent: "SALES_ENQUIRY", confidence: 0.9, promptInjectionDetected: false },
      response: "Review required.", tools: [], approvalRequired: true, humanTakeover: false, externalActionPerformed: false,
    });
    const whatsappEvent: NormalizedInboundEvent = { ...event, channel: "WHATSAPP", externalEventId: "wamid.synthetic-1" };
    const result = await new InboundEventProcessor({ process } as never).processVerifiedWhatsapp(ORG_A, crypto.randomUUID(), whatsappEvent);
    expect(database.integrationConnector.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: CONNECTOR, organizationId: ORG_A, type: "WHATSAPP", provider: "META_WHATSAPP_CLOUD", status: "ACTIVE", deletedAt: null },
    }));
    expect(process).toHaveBeenCalledWith(ORG_A, expect.any(String), expect.objectContaining({
      channel: "WHATSAPP", externalMessageId: "wamid.synthetic-1", phone: event.sender.phone,
    }), { connectorId: CONNECTOR, source: "META", forceApproval: true });
    expect(result).toMatchObject({ duplicate: false, externalActionPerformed: false });
  });

  it("keeps the same external ID independent across website connectors", async () => {
    database.integrationConnector.findFirst.mockResolvedValue({ id: "10000000-0000-4000-8000-00000000000b" });
    const process = vi.fn().mockResolvedValue({
      duplicate: false, eventId: crypto.randomUUID(), customer: null, customerCreated: false,
      inquiryId: crypto.randomUUID(), analysis: { intent: "UNCLASSIFIED", confidence: 0.4, promptInjectionDetected: false },
      response: "Review required.", tools: [], approvalRequired: true, humanTakeover: false, externalActionPerformed: false,
    });
    await new InboundEventProcessor({ process } as never).processVerifiedWebsite(ORG_A, crypto.randomUUID(), {
      ...event, channel: "WEBSITE", eventType: "WEBSITE_ENQUIRY", connectorId: "10000000-0000-4000-8000-00000000000b",
    });
    const duplicateCall = database.integrationEvent.findFirst.mock.calls[0] as unknown as [{ where: {
      organizationId: string; connectorId: string; externalEventId: string;
    } }];
    expect(duplicateCall[0].where).toMatchObject({ organizationId: ORG_A,
      connectorId: "10000000-0000-4000-8000-00000000000b", externalEventId: event.externalEventId });
  });

  it("gates website orders by connector capability and delegates order creation", async () => {
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR, configuration: { websiteOrderIngestionEnabled: true } });
    const orderInput = { version: "1", eventId: "order-event-1", submittedAt: event.occurredAt, externalOrderId: "shop-1", customer: { email: "buyer@example.test" }, items: [{ sku: "SKU-1", quantity: 1 }], currency: "INR" } as const;
    await new InboundEventProcessor().processVerifiedWebsiteOrder(ORG_A, "20000000-0000-4000-8000-00000000000a", { ...event, channel: "WEBSITE_ORDER", eventType: "ORDER_CREATED" }, orderInput);
    expect(orderCreate).toHaveBeenCalledWith(ORG_A, "20000000-0000-4000-8000-00000000000a", CONNECTOR, event.correlationId, orderInput);
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR, configuration: {} });
    await expect(new InboundEventProcessor().processVerifiedWebsiteOrder(ORG_A, crypto.randomUUID(), { ...event, channel: "WEBSITE_ORDER", eventType: "ORDER_CREATED" }, orderInput)).rejects.toMatchObject({ code: "WEBSITE_ORDER_UNAVAILABLE" });
  });

  it("delegates a Meta lead exclusively through the shared CRM agent", async () => {
    database.integrationConnector.findFirst.mockResolvedValue({ id: CONNECTOR });
    database.integrationEvent.findFirst.mockResolvedValue(null);
    const process = vi.fn().mockResolvedValue({ duplicate: false, eventId: crypto.randomUUID(), customer: null, customerCreated: true, inquiryId: crypto.randomUUID(), analysis: { intent: "SALES_ENQUIRY", confidence: 0.9, promptInjectionDetected: false }, response: "Review required.", tools: [], approvalRequired: true, humanTakeover: false, externalActionPerformed: false });
    const result = await new InboundEventProcessor({ process } as never).processVerifiedMetaLead(ORG_A, crypto.randomUUID(), { ...event, channel: "META_LEAD_AD", eventType: "LEAD_CAPTURED", externalEventId: "333" });
    expect(process).toHaveBeenCalledWith(ORG_A, expect.any(String), expect.objectContaining({ channel: "META_LEAD_AD", externalMessageId: "333" }), { connectorId: CONNECTOR, source: "META_LEAD", forceApproval: true });
    expect(result).toMatchObject({ duplicate: false, externalActionPerformed: false });
  });
});
