import { describe, expect, it } from "vitest";
import { connectorSchema, intakeSchema, whatsappEscalationSchema, whatsappTemplateDraftSchema } from "../src/modules/automation-bridge/bridge.validation.js";

describe("automation bridge validation", () => {
  it("rejects trusted tenant identifiers", () => expect(() => connectorSchema.parse({ name: "WhatsApp store", type: "WHATSAPP", provider: "Meta", externalAccountRef: "", status: "ACTIVE", mode: "MANUAL_APPROVAL", organizationId: crypto.randomUUID() })).toThrow());
  it("accepts the null external reference sent by the connector form", () => expect(connectorSchema.parse({ name: "Website Contact Form", type: "WEBSITE", provider: "B2 Brain Hosted Form", externalAccountRef: null, status: "ACTIVE", mode: "ASSISTED" })).toMatchObject({ externalAccountRef: null, type: "WEBSITE" }));
  it("requires real contact details for communication events", () => expect(() => intakeSchema.parse({ externalEventId: "wa-1", eventName: "message.received", kind: "INQUIRY", contactName: "", email: "", phone: "", subject: "", message: "", raw: {} })).toThrow());
  it("accepts traceable payment events without inventing customer data", () => expect(intakeSchema.parse({ externalEventId: "pay-1", eventName: "payment.received", kind: "PAYMENT", raw: { providerReference: "p-1" } })).toMatchObject({ kind: "PAYMENT", contactName: null }));
  it("validates inquiry-aware WhatsApp draft and escalation commands", () => {
    const connectorId = crypto.randomUUID(), inquiryId = crypto.randomUUID();
    expect(whatsappTemplateDraftSchema.parse({ connectorId, inquiryId, template: "FOLLOW_UP", customMessage: null })).toMatchObject({ template: "FOLLOW_UP" });
    expect(whatsappEscalationSchema.parse({ inquiryId, reason: "Customer requested a person" })).toMatchObject({ inquiryId });
  });
});
