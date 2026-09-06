import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedInboundEvent } from "../src/modules/automation-bridge/contracts/inbound-event.contract.js";

const database = vi.hoisted(() => ({
  integrationConnector: { findFirst: vi.fn() },
  integrationEvent: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: database }));

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
});
