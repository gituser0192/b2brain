/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.hoisted(() => vi.fn());
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: verify }));
import { requireWorkspaceAgentCapability, workspaceAgentCapabilities } from "../src/modules/workspace-agent/workspace-agent.capabilities.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: [] };

describe("workspace Agent capability policy", () => {
  beforeEach(() => verify.mockReset().mockResolvedValue("READ_WRITE"));

  it("defines service, permission, risk and effects for every current sub-capability", async () => {
    for (const [name, policy] of Object.entries(workspaceAgentCapabilities)) {
      expect(policy).toMatchObject({ service: expect.any(String), permission: expect.any(String), mode: expect.stringMatching(/READ|WRITE/), confirmation: expect.any(Boolean), externalEffect: expect.any(Boolean) });
      await requireWorkspaceAgentCapability(context, name as keyof typeof workspaceAgentCapabilities);
      expect(verify).toHaveBeenLastCalledWith(expect.objectContaining({ organizationId: context.organizationId }), policy.service, policy.permission);
    }
  });
});
