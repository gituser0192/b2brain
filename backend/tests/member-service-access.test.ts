import { describe, expect, it, vi } from "vitest";
import { ServiceCatalogueService } from "../src/modules/services/service.service.js";

const serviceId = "00000000-0000-4000-8000-000000000001";
const organizationServiceId = "00000000-0000-4000-8000-000000000002";
const record = {
  id: organizationServiceId,
  serviceId,
  service: { id: serviceId, code: "CRM", name: "CRM", description: null, iconKey: null, routePath: null },
};

describe("member service assignment identifiers", () => {
  it("returns the assignable service ID instead of the organization-service ID", async () => {
    const repository = { enabledForOrganization: vi.fn().mockResolvedValue([record]), assignedServiceIds: vi.fn().mockResolvedValue([]) };
    const result = await new ServiceCatalogueService(repository as never).enabled("org-1", "member-1", "ORGANIZATION_OWNER");
    expect(result[0]).toMatchObject({ id: serviceId, organizationServiceId });
  });

  it("filters non-owner services using assigned service IDs", async () => {
    const repository = { enabledForOrganization: vi.fn().mockResolvedValue([record]), assignedServiceIds: vi.fn().mockResolvedValue([serviceId]) };
    const result = await new ServiceCatalogueService(repository as never).enabled("org-1", "member-1", "ORGANIZATION_MEMBER");
    expect(result).toHaveLength(1);
  });
});
