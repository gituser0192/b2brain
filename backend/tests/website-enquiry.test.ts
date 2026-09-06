import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connector: {
    id: "10000000-0000-4000-8000-00000000000a", organizationId: "00000000-0000-4000-8000-00000000000a",
    createdById: "20000000-0000-4000-8000-00000000000a", appSecretEncrypted: "encrypted",
  },
  findFirst: vi.fn(), decrypt: vi.fn(() => "synthetic-signing-secret"), process: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: { integrationConnector: { findFirst: state.findFirst } } }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({ decryptSecret: state.decrypt }));

import { WebsiteEnquiryService } from "../src/modules/automation-bridge/website-enquiry.service.js";

const payload = {
  version: "1", eventId: "web-001", submittedAt: new Date().toISOString(), name: "Synthetic Visitor",
  email: "VISITOR@EXAMPLE.TEST", phone: "+91 98765 43210", message: "Need course information",
  pageUrl: "https://example.test/contact", utm: { source: "synthetic-test" },
};
const signed = (body: Buffer, eventId = payload.eventId, timestamp = Math.floor(Date.now() / 1000)) => ({
  timestamp: String(timestamp), eventId,
  signature: `v1=${createHmac("sha256", "synthetic-signing-secret").update(Buffer.concat([Buffer.from(`${timestamp}.${eventId}.`), body])).digest("hex")}`,
});

describe("verified website enquiry adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.findFirst.mockResolvedValue(state.connector);
    state.process.mockResolvedValue({ duplicate: false, processingStatus: "COMPLETED", correlationId: crypto.randomUUID() });
  });

  it("verifies exact bytes, derives tenant context from the connector and delegates once", async () => {
    const body = Buffer.from(JSON.stringify(payload));
    const headers = signed(body);
    await new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never)
      .accept("public-connector", body, headers.signature, headers.timestamp, headers.eventId, payload);
    expect(state.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      webhookKey: "public-connector", type: "WEBSITE", status: "ACTIVE", deletedAt: null,
    } }));
    expect(state.process).toHaveBeenCalledWith(state.connector.organizationId, state.connector.createdById,
      expect.objectContaining({ channel: "WEBSITE", eventType: "WEBSITE_ENQUIRY", connectorId: state.connector.id,
        sender: { name: payload.name, email: "visitor@example.test", phone: "919876543210" } }));
  });

  it("rejects missing, invalid, expired, future and body-mismatched signatures before processing", async () => {
    const body = Buffer.from(JSON.stringify(payload));
    const service = new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never);
    for (const headers of [
      { ...signed(body), signature: undefined },
      { ...signed(body), signature: "v1=" + "0".repeat(64) },
      signed(body, payload.eventId, Math.floor(Date.now() / 1000) - 301),
      signed(body, payload.eventId, Math.floor(Date.now() / 1000) + 301),
      signed(Buffer.from(JSON.stringify({ ...payload, message: "different" }))),
    ]) await expect(service.accept("public-connector", body, headers.signature, headers.timestamp, headers.eventId, payload))
      .rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.process).not.toHaveBeenCalled();
  });

  it("does not reveal disabled, deleted or unknown connectors", async () => {
    state.findFirst.mockResolvedValue(null);
    const body = Buffer.from(JSON.stringify(payload));
    const headers = signed(body);
    await expect(new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never)
      .accept("unknown", body, headers.signature, headers.timestamp, headers.eventId, payload))
      .rejects.toMatchObject({ statusCode: 401, code: "INVALID_WEBHOOK_SIGNATURE" });
  });

  it("rejects oversized bodies and event-id substitution", async () => {
    const service = new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never);
    await expect(service.accept("public", Buffer.alloc(65 * 1024), "v1=" + "0".repeat(64), "1", "event", {}))
      .rejects.toMatchObject({ statusCode: 413 });
    const body = Buffer.from(JSON.stringify(payload));
    const headers = signed(body, "other-event");
    await expect(service.accept("public", body, headers.signature, headers.timestamp, headers.eventId, payload))
      .rejects.toMatchObject({ code: "INVALID_WEBSITE_ENQUIRY" });
  });

  it("returns duplicate and failure results unchanged without any delivery path", async () => {
    const body = Buffer.from(JSON.stringify(payload));
    const headers = signed(body);
    state.process.mockResolvedValueOnce({ duplicate: true, processingStatus: "COMPLETED", correlationId: crypto.randomUUID(), externalActionPerformed: false });
    await expect(new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never)
      .accept("public", body, headers.signature, headers.timestamp, headers.eventId, payload)).resolves.toMatchObject({ duplicate: true, externalActionPerformed: false });
    state.process.mockRejectedValueOnce(new Error("atomic failure"));
    await expect(new WebsiteEnquiryService({ processVerifiedWebsite: state.process } as never)
      .accept("public", body, headers.signature, headers.timestamp, headers.eventId, payload)).rejects.toThrow("atomic failure");
  });
});
