import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ organization: vi.fn(), services: vi.fn(), customers: vi.fn() }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  organization: { findFirst: mocks.organization }, organizationService: { findMany: mocks.services }, customer: { count: mocks.customers },
  payment: { findMany: vi.fn() }, expense: { findMany: vi.fn() }, invoice: { findMany: vi.fn() }, deal: { findMany: vi.fn() }, customerFollowUp: { count: vi.fn() }, order: { findMany: vi.fn(), count: vi.fn() }, projectTask: { count: vi.fn() }, stockLevel: { findMany: vi.fn() }, marketingCampaign: { findMany: vi.fn() }, campaignLead: { findMany: vi.fn() }, supportTicket: { findMany: vi.fn() },
} }));

import { AnalysisService } from "../src/modules/analysis/analysis.service.js";

describe("Business Analysis tenant isolation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.organization.mockResolvedValue({ currency: "INR" }); mocks.services.mockResolvedValue([{ service: { code: "CRM" } }]); mocks.customers.mockResolvedValueOnce(2).mockResolvedValueOnce(1); });
  it("scopes every permitted customer calculation to the authenticated organization", async () => {
    await new AnalysisService().analyze("org-b", ["CRM_VIEW"], 30);
    expect(mocks.organization).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "org-b", deletedAt: null } }));
    expect(mocks.services).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-b" }) }));
    expect(mocks.customers).toHaveBeenCalledTimes(2);
    for (const [query] of mocks.customers.mock.calls) expect(query.where.organizationId).toBe("org-b");
  });
});
