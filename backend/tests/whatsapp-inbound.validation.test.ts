import { describe, expect, it } from "vitest";
import { whatsappCredentialsSchema } from "../src/modules/automation-bridge/bridge.validation.js";
import { metaWhatsappWebhookSchema } from "../src/modules/automation-bridge/whatsapp-inbound.validation.js";

const payload = (phoneNumberId: string, from = "919876543210") => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ value: {
    metadata: { phone_number_id: phoneNumberId, display_phone_number: "+91 98765 43210" },
    contacts: [{ wa_id: from, profile: { name: "Synthetic Customer" } }],
    messages: [{ id: "wamid.synthetic-1", from, type: "text", text: { body: "Need details" }, timestamp: "1788890000" }],
    whatsapp_business_account_id: "200000000000001",
    page_id: "300000000000001",
  } }] }],
});

describe("WhatsApp inbound validation", () => {
  it("keeps the verified Phone Number ID as an exact bounded string", () => {
    const id = "001234567890123";
    expect(metaWhatsappWebhookSchema.parse(payload(id)).entry[0]?.changes[0]?.value.metadata.phone_number_id).toBe(id);
  });

  it.each(["+919876543210", "1e15", "phone-123", "9".repeat(33)])("rejects malformed Phone Number ID %s", id => {
    expect(metaWhatsappWebhookSchema.safeParse(payload(id)).success).toBe(false);
  });

  it("does not allow display, sender, Page or WABA identifiers to substitute for metadata Phone Number ID", () => {
    const value = payload("") as Record<string, unknown>;
    expect(metaWhatsappWebhookSchema.safeParse(value).success).toBe(false);
  });

  it("allows credentials only with digit-string Meta identifiers", () => {
    const base = { phoneNumberId: "100000000000001", businessAccountId: "200000000000001", accessToken: "synthetic-token-value-long-enough", appSecret: "synthetic-secret" };
    expect(whatsappCredentialsSchema.parse(base).phoneNumberId).toBe(base.phoneNumberId);
    expect(whatsappCredentialsSchema.safeParse({ ...base, phoneNumberId: "+100000000000001" }).success).toBe(false);
  });
});
