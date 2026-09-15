/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ customerFindMany: vi.fn(), customerCount: vi.fn() }));
const access = vi.hoisted(() => vi.fn());
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: access }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  customer: { findMany: db.customerFindMany, count: db.customerCount },
} }));
import { executeWorkspaceAgentReadTool, workspaceAgentReadTools } from "../src/modules/workspace-agent/workspace-agent.read-tools.js";
import { AppError } from "../src/shared/errors/app-error.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: ["CRM_VIEW"] };

describe("workspace Agent typed read tools", () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockResolvedValue("READ_WRITE"); db.customerFindMany.mockResolvedValue([]); db.customerCount.mockResolvedValue(0); });

  it("registers immutable read-only metadata and bounded strict schemas", () => {
    expect(Object.keys(workspaceAgentReadTools)).toHaveLength(39);
    expect(new Set(Object.values(workspaceAgentReadTools).map((tool) => tool.name))).toHaveProperty("size", 39);
    for (const tool of Object.values(workspaceAgentReadTools)) {
      expect(tool).toMatchObject({ mode: "READ", confirmation: "NONE", externalEffect: false });
      expect(tool.maxResults).toBeLessThanOrEqual(20);
      expect(tool.timeoutMs).toBeLessThanOrEqual(5_000);
      expect(tool.inputSchema.safeParse({ limit: 21 }).success).toBe(false);
      expect(tool.inputSchema.safeParse({ limit: 1, organizationId: context.organizationId }).success).toBe(false);
    }
  });

  it("checks Agent and CRM access before a tenant-scoped bounded query", async () => {
    const result = await executeWorkspaceAgentReadTool(context, "crm.customer_list", { limit: 5 });
    expect(access).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: context.organizationId }), "B2BRAIN_AGENT");
    expect(access).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: context.organizationId }), "CRM", "CRM_VIEW");
    expect(db.customerFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: context.organizationId }), take: 5 }));
    expect(result).toMatchObject({ availability: "NO_DATA", resultCount: 0, truncated: false, records: [] });
  });

  it("returns a bounded safe projection without contact details", async () => {
    db.customerFindMany.mockResolvedValue([{ id: "customer-1", displayName: "Synthetic Customer", status: "ACTIVE", createdAt: new Date("2026-09-15T00:00:00Z"), city: "Pune", country: "India" }]);
    db.customerCount.mockResolvedValue(18);
    const result = await executeWorkspaceAgentReadTool(context, "crm.customer_list", { limit: 5 });
    expect(result).toMatchObject({ availability: "VERIFIED", resultCount: 1, totalCount: 18, truncated: true, records: [{ label: "Synthetic Customer", href: "/crm/customers/customer-1" }] });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|notes/i);
  });

  it.each([
    ["SERVICE_NOT_ENABLED", "UNAVAILABLE"],
    ["MEMBER_SERVICE_NOT_ASSIGNED", "UNAVAILABLE"],
    ["FORBIDDEN", "FORBIDDEN"],
  ])("maps %s without fabricating a verified zero", async (code, availability) => {
    access.mockRejectedValueOnce(new AppError(403, "Denied", code));
    await expect(executeWorkspaceAgentReadTool(context, "crm.customer_list", { limit: 5 })).resolves.toMatchObject({ availability, resultCount: 0 });
    expect(db.customerFindMany).not.toHaveBeenCalled();
  });
});
