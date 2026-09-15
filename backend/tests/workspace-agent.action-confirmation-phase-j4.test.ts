import { describe, expect, it } from "vitest";
import { createWorkspaceAgentConfirmation, verifyWorkspaceAgentConfirmation } from "../src/modules/workspace-agent/workspace-agent.confirmation.js";

const organizationId = "00000000-0000-4000-8000-000000000001", userId = "00000000-0000-4000-8000-000000000002", conversationId = "00000000-0000-4000-8000-000000000003";

describe("workspace Agent J4 action confirmation", () => {
  it("binds a typed action to its actor, workspace, conversation and normalized arguments", () => {
    const created = createWorkspaceAgentConfirmation({ action: "TOOL_ACTION", organizationId, userId, conversationId, toolName: "crm.follow_up_create", arguments: { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-09-20T10:00:00.000Z", targetVersion: "2026-09-15T10:00:00.000Z" } });
    expect(verifyWorkspaceAgentConfirmation(created.token, { organizationId, userId }, conversationId)).toMatchObject({ action: "TOOL_ACTION", toolName: "crm.follow_up_create" });
    expect(() => verifyWorkspaceAgentConfirmation(created.token, { organizationId, userId }, "00000000-0000-4000-8000-000000000099")).toThrowError(/another conversation/i);
    expect(() => verifyWorkspaceAgentConfirmation(created.token, { organizationId: "00000000-0000-4000-8000-000000000099", userId }, conversationId)).toThrowError(/another workspace or user/i);
  });
});
