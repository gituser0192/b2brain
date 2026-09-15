import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({
  organization: vi.fn(), services: vi.fn(), access: vi.fn(), team: vi.fn(), customers: vi.fn(), inquiries: vi.fn(), projects: vi.fn(), invoices: vi.fn(), accounts: vi.fn(), connectors: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  organization: { findFirst: reads.organization }, organizationService: { findMany: reads.services }, membershipServiceAccess: { findMany: reads.access }, organizationMembership: { count: reads.team }, customer: { count: reads.customers }, inquiry: { count: reads.inquiries }, project: { count: reads.projects }, invoice: { count: reads.invoices }, paymentAccount: { count: reads.accounts }, integrationConnector: { findMany: reads.connectors },
} }));
import { assessWorkspaceSetup } from "../src/modules/workspace-agent/workspace-agent.setup.js";
import { serviceMaturityRegistry } from "../src/modules/services/service-maturity.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: ["CRM_VIEW", "INQUIRY_VIEW", "PROJECT_VIEW", "FINANCE_VIEW", "AUTOMATION_VIEW"] };

describe("workspace Agent guided setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reads.organization.mockResolvedValue({ name: "Synthetic Workspace", industry: null, timezone: "Asia/Kolkata", currency: "INR" });
    reads.services.mockResolvedValue(Object.keys(serviceMaturityRegistry).map((code) => ({ service: { code } })));
    reads.access.mockResolvedValue([]); reads.team.mockResolvedValue(1); reads.customers.mockResolvedValue(0); reads.inquiries.mockResolvedValue(0); reads.projects.mockResolvedValue(0); reads.invoices.mockResolvedValue(0); reads.accounts.mockResolvedValue(0); reads.connectors.mockResolvedValue([]);
  });

  it("assesses every registered service once and returns at most five verified steps", async () => {
    const result = await assessWorkspaceSetup(context, "Help me set up my business");
    expect(result.areas).toHaveLength(21);
    expect(new Set(result.areas.map((area) => area.key)).size).toBe(21);
    expect(result.steps.length).toBeLessThanOrEqual(5);
    expect(result).toMatchObject({ mutationPerformed: false, externalCallPerformed: false });
    expect(reads.customers).toHaveBeenCalledWith({ where: { organizationId: context.organizationId, deletedAt: null } });
  });

  it("describes WhatsApp honestly as Test Mode without making an external call", async () => {
    const result = await assessWorkspaceSetup(context, "Connect WhatsApp");
    expect(result.steps[0]).toMatchObject({ key: "whatsapp", testMode: true, href: "/automation?section=connections" });
    expect(result.steps[0]?.why).toContain("real Embedded Signup is not available");
    expect(result.externalCallPerformed).toBe(false);
  });

  it("does not read a service when the member lacks its permission", async () => {
    reads.access.mockResolvedValue([{ accessMode: "READ_WRITE", service: { code: "CRM" } }]);
    const result = await assessWorkspaceSetup({ ...context, roleCode: "MEMBER", permissions: [] }, "Set up CRM");
    expect(result.areas.find((area) => area.key === "CRM")?.status).toBe("FORBIDDEN");
    expect(reads.customers).not.toHaveBeenCalled();
  });

  it.each(["Here is my access token", "Here is my webhook secret", "Enable the Finance service"])("refuses protected setup request without querying: %s", async (request) => {
    const result = await assessWorkspaceSetup(context, request);
    expect(result.refused).toBe(true);
    expect(Object.values(reads).every((read) => read.mock.calls.length === 0)).toBe(true);
  });
});
