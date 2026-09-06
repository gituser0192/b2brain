import { describe, expect, it } from "vitest";
import { normalizedInboundEventSchema, reservedInboundEventTypes } from "../src/modules/automation-bridge/contracts/inbound-event.contract.js";

const event = {
  version: "1",
  channel: "SIMULATOR",
  eventType: "CUSTOMER_MESSAGE",
  externalEventId: "sim-001",
  occurredAt: "2026-09-06T10:00:00.000Z",
  receivedAt: "2026-09-06T10:00:01.000Z",
  connectorId: "2e74c42a-41a6-4b32-b15c-b2e4964eb684",
  sender: { name: "Synthetic Customer", phone: "+91 98765 43210", email: "TEST@EXAMPLE.COM" },
  content: { text: "Please share your services." },
  metadata: { simulator: true },
  correlationId: "b516e37e-06a8-47e7-a1e1-9364a5630307",
} as const;

describe("normalized inbound event contract v1", () => {
  it("normalizes trusted contact identifiers and rejects tenant input", () => {
    const parsed = normalizedInboundEventSchema.parse(event);
    expect(parsed.sender).toMatchObject({ phone: "919876543210", email: "test@example.com" });
    expect(normalizedInboundEventSchema.safeParse({ ...event, organizationId: crypto.randomUUID() }).success).toBe(false);
  });

  it("rejects unknown event types, oversized content and future timestamps", () => {
    expect(normalizedInboundEventSchema.safeParse({ ...event, eventType: "MESSAGE_STATUS_UPDATED" }).success).toBe(false);
    expect(normalizedInboundEventSchema.safeParse({ ...event, content: { text: "x".repeat(4097) } }).success).toBe(false);
    expect(normalizedInboundEventSchema.safeParse({ ...event, occurredAt: "2026-09-06T11:00:00.000Z" }).success).toBe(false);
  });

  it("documents remaining future types without activating them", () => {
    expect(reservedInboundEventTypes).toEqual(["MESSAGE_STATUS_UPDATED"]);
  });
});
