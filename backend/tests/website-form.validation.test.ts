import { describe, expect, it } from "vitest";
import { websiteFormConfigSchema, websiteLeadSchema } from "../src/modules/automation-bridge/website-form.validation.js";

describe("website lead form validation", () => {
  it("accepts a real lead with either email or phone", () => {
    expect(websiteLeadSchema.parse({ contactName: "Asha", email: "asha@example.com", phone: "", service: "CRM", message: "Please call me", website: "", startedAt: Date.now() })).toMatchObject({ phone: null });
  });
  it("rejects a lead without contact details", () => {
    expect(() => websiteLeadSchema.parse({ contactName: "Asha", email: "", phone: "", service: "", message: "Please call me", website: "", startedAt: Date.now() })).toThrow();
  });
  it("rejects unexpected tenant or actor identifiers", () => {
    expect(() => websiteLeadSchema.parse({ contactName: "Asha", email: "asha@example.com", phone: "", service: "", message: "Please call me", website: "", startedAt: Date.now(), organizationId: crypto.randomUUID() })).toThrow();
  });
  it("accepts safe form presentation settings", () => {
    expect(websiteFormConfigSchema.parse({ title: "Talk to us", description: "Tell us what you need.", submitLabel: "Send", successMessage: "Received.", accentColor: "#087ce3", askService: true, serviceLabel: "Interested service" })).toMatchObject({ askService: true });
  });
});
