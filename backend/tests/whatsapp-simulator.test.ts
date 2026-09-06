import { describe, expect, it, vi } from "vitest";
import { normalizeWhatsappPhone } from "../src/modules/automation-bridge/whatsapp-simulator.service.js";
import { inquiryTypeForAgentIntent } from "../src/modules/enquiry-agent/enquiry-agent.service.js";
import { whatsappSimulatorSchema } from "../src/modules/automation-bridge/bridge.validation.js";

describe("WhatsApp CRM intake simulator", () => {
  it("adapts the existing request to the shared normalized pipeline", async () => {
    const processAuthenticatedSimulator = vi.fn().mockResolvedValue({ version: "1", eventId: crypto.randomUUID() });
    const service = new (await import("../src/modules/automation-bridge/whatsapp-simulator.service.js")).WhatsappSimulatorService(
      { processAuthenticatedSimulator } as never,
    );
    await service.receive(crypto.randomUUID(), crypto.randomUUID(), {
      connectorId: "2e74c42a-41a6-4b32-b15c-b2e4964eb684",
      externalMessageId: "wamid.adapter-001",
      from: "+91 98765-43210",
      contactName: "Synthetic Customer",
      message: "Need a quotation",
    });
    expect(processAuthenticatedSimulator).toHaveBeenCalledOnce();
    expect(processAuthenticatedSimulator.mock.calls[0]?.[2]).toMatchObject({
      version: "1", channel: "SIMULATOR", eventType: "CUSTOMER_MESSAGE",
      sender: { phone: "919876543210" }, content: { text: "Need a quotation" },
    });
  });
  it.each([
    ["SALES_ENQUIRY", "SALES"],
    ["SERVICE_PRICING", "PRODUCT_QUESTION"],
    ["SUPPORT_REQUEST", "SUPPORT"],
    ["COMPLAINT", "COMPLAINT"],
    ["REFUND_PAYMENT", "SUPPORT"],
    ["SPAM", "SPAM"],
    ["UNKNOWN", "UNCLASSIFIED"],
  ])("maps shared agent intent %s to CRM inquiry type %s", (intent, expected) => {
    expect(inquiryTypeForAgentIntent(intent)).toBe(expected);
  });

  it("normalizes common phone formatting", () => {
    expect(normalizeWhatsappPhone("+91 98765-43210")).toBe("919876543210");
  });

  it("rejects organization identity and unknown webhook fields", () => {
    const result = whatsappSimulatorSchema.safeParse({
      connectorId: "2e74c42a-41a6-4b32-b15c-b2e4964eb684",
      externalMessageId: "wamid.test-001",
      from: "919876543210",
      contactName: "Test Customer",
      message: "Need a quotation",
      organizationId: "untrusted",
    });
    expect(result.success).toBe(false);
  });

  it("limits untrusted message size", () => {
    expect(whatsappSimulatorSchema.safeParse({
      connectorId: "2e74c42a-41a6-4b32-b15c-b2e4964eb684",
      externalMessageId: "wamid.test-002",
      from: "919876543210",
      contactName: "Test Customer",
      message: "x".repeat(4097),
    }).success).toBe(false);
  });
});
