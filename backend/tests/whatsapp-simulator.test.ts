import { describe, expect, it } from "vitest";
import { classifyWhatsappMessage, normalizeWhatsappPhone } from "../src/modules/automation-bridge/whatsapp-simulator.service.js";
import { whatsappSimulatorSchema } from "../src/modules/automation-bridge/bridge.validation.js";

describe("WhatsApp CRM intake simulator", () => {
  it.each([
    ["I am interested in a demo of your service", "SALES"],
    ["What is the price and is blue colour available?", "PRODUCT_QUESTION"],
    ["I need help, the product is not working", "COMPLAINT"],
    ["Please repair this issue", "SUPPORT"],
    ["I want to buy 20 pieces and arrange delivery", "ORDER_REQUEST"],
    ["Hello there", "UNCLASSIFIED"],
    ["Click here for free money and crypto profit", "SPAM"],
  ])("classifies %s", (message, expected) => {
    expect(classifyWhatsappMessage(message)).toBe(expected);
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
