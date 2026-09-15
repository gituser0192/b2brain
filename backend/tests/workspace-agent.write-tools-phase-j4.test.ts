import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({ customer: vi.fn(), project: vi.fn(), inquiry: vi.fn(), employee: vi.fn(), membership: vi.fn() }));
const mutations = vi.hoisted(() => ({ customer: vi.fn(), followUp: vi.fn(), task: vi.fn(), assignment: vi.fn() }));
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: access }));
vi.mock("../src/database/prisma.js", () => ({ prisma: { customer: { findFirst: db.customer }, project: { findFirst: db.project }, inquiry: { findFirst: db.inquiry }, employee: { findFirst: db.employee }, organizationMembership: { findFirst: db.membership } } }));
vi.mock("../src/modules/customers/customer.service.js", () => ({ CustomerService: class { create = mutations.customer; } }));
vi.mock("../src/modules/customer-engagement/engagement.service.js", () => ({ EngagementService: class { createFollowUp = mutations.followUp; } }));
vi.mock("../src/modules/projects/project.service.js", () => ({ ProjectService: class { createTask = mutations.task; } }));
vi.mock("../src/modules/inquiries/lead-assignment.service.js", () => ({ LeadAssignmentService: class { manualAssign = mutations.assignment; } }));
import { executeWorkspaceAgentWriteTool, previewWorkspaceAgentWriteTool, workspaceAgentWriteTools } from "../src/modules/workspace-agent/workspace-agent.write-tools.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: ["CRM_FOLLOWUP_MANAGE", "TASK_MANAGE", "INQUIRY_MANAGE"] };
const version = "2026-09-15T10:00:00.000Z";

describe("workspace Agent controlled write tools", () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockResolvedValue("READ_WRITE"); });
  it("registers only confirmation-gated internal writes", () => {
    expect(Object.keys(workspaceAgentWriteTools)).toEqual(["crm.customer_create", "crm.follow_up_create", "projects.task_create", "leads.assign"]);
    for (const tool of Object.values(workspaceAgentWriteTools)) expect(tool).toMatchObject({ mode: "WRITE", confirmation: "REQUIRED", externalEffect: false });
  });
  it("previews a follow-up without mutating and binds the current version", async () => {
    db.customer.mockResolvedValue({ displayName: "Synthetic Customer", updatedAt: new Date(version) });
    const result = await previewWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-09-20T10:00:00.000Z" });
    expect(result.preview).toMatchObject({ targetLabel: "Synthetic Customer", externalEffect: false, targetVersion: version });
    expect(Object.values(mutations).every((mutation) => mutation.mock.calls.length === 0)).toBe(true);
    expect(access).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: context.organizationId }), "B2BRAIN_AGENT");
    expect(access).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: context.organizationId }), "CRM", "CRM_FOLLOWUP_MANAGE");
  });
  it("executes through the authoritative follow-up service after reauthorization", async () => {
    db.customer.mockResolvedValue({ updatedAt: new Date(version) }); mutations.followUp.mockResolvedValue({ id: "follow-up", title: "Call customer" });
    await expect(executeWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-09-20T10:00:00.000Z", targetVersion: version })).resolves.toMatchObject({ id: "follow-up", alreadyCompleted: false });
    expect(mutations.followUp).toHaveBeenCalledTimes(1);
  });
  it("refuses a stale target", async () => {
    db.customer.mockResolvedValue({ updatedAt: new Date("2026-09-15T11:00:00.000Z") });
    await expect(executeWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-09-20T10:00:00.000Z", targetVersion: version })).rejects.toMatchObject({ code: "AGENT_ACTION_STALE" });
    expect(mutations.followUp).not.toHaveBeenCalled();
  });
});
