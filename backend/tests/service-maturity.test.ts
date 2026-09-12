import { describe, expect, it } from "vitest";
import { serviceMaturityFor, serviceMaturityRegistry } from "../src/modules/services/service-maturity.js";
import { organizationServiceAssignmentSchema, servicePlanSchema } from "../src/modules/platform/platform.validation.js";
import { ServiceCatalogueService } from "../src/modules/services/service.service.js";

describe("code-owned service maturity", () => {
  it("classifies all 21 services as seven Available and fourteen Beta", () => {
    const entries = Object.values(serviceMaturityRegistry);
    expect(entries).toHaveLength(21);
    expect(entries.filter((item) => item.maturity === "AVAILABLE")).toHaveLength(7);
    expect(entries.filter((item) => item.maturity === "BETA")).toHaveLength(14);
    expect(entries.every((item) => item.availabilityNote && item.maturityLabel && item.sellability)).toBe(true);
  });

  it("does not fabricate metadata for unknown service keys", () => {
    expect(serviceMaturityFor("UNKNOWN_SERVICE")).toBeNull();
  });

  it("rejects client attempts to change maturity", () => {
    expect(() => organizationServiceAssignmentSchema.parse({ enabled: true, maturity: "AVAILABLE" })).toThrow();
    expect(() => servicePlanSchema.parse({ code: "TEST", name: "Test", status: "ACTIVE", monthlyPrice: 0, yearlyPrice: 0, currency: "INR", serviceIds: [], maturity: "AVAILABLE" })).toThrow();
  });

  it("adds maturity without changing existing catalogue fields", async () => {
    const service = { id: "service-id", code: "CRM", name: "CRM", description: null, iconKey: null, routePath: "/crm", featureFlags: [] };
    const repository = { catalog: () => Promise.resolve([service]), enabledForOrganization: () => Promise.resolve([]) };
    const result = await new ServiceCatalogueService(repository as never).context("organization-id");
    expect(result.catalog[0]).toMatchObject({ id: "service-id", code: "CRM", routePath: "/crm", maturity: { maturity: "AVAILABLE", maturityLabel: "Available" } });
  });
});
