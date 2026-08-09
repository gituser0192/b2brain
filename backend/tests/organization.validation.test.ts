import { describe, expect, it } from "vitest";
import { updateOrganizationSchema } from "../src/modules/organizations/organization.validation.js";

describe("organization validation", () => {
  it("allows only supported organization fields", () => {
    expect(updateOrganizationSchema.parse({ name: " Acme ", timezone: "Asia/Kolkata", currency: "INR" })).toEqual({ name: "Acme", timezone: "Asia/Kolkata", currency: "INR" });
  });

  it("rejects tenant and audit identifiers from clients", () => {
    expect(() => updateOrganizationSchema.parse({ name: "Acme", organizationId: crypto.randomUUID(), updatedById: crypto.randomUUID() })).toThrow();
  });

  it("rejects empty updates", () => {
    expect(() => updateOrganizationSchema.parse({})).toThrow();
  });
});
