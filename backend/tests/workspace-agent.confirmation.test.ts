import { afterEach, describe, expect, it, vi } from "vitest";
import { issueAccessToken, verifyAccessToken } from "../src/modules/auth/auth.tokens.js";
import { createWorkspaceAgentConfirmation, verifyWorkspaceAgentConfirmation } from "../src/modules/workspace-agent/workspace-agent.confirmation.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002" };

describe("workspace Agent confirmation token", () => {
  afterEach(() => vi.useRealTimers());

  it("binds a customer action to its authenticated organization and user", () => {
    const issued = createWorkspaceAgentConfirmation({ ...context, action: "CUSTOMER_CREATE", arguments: { displayName: "Synthetic Customer", phone: "9876543210" } });
    expect(verifyWorkspaceAgentConfirmation(issued.token, context)).toMatchObject({ action: "CUSTOMER_CREATE", arguments: { displayName: "Synthetic Customer", phone: "9876543210" } });
    expect(() => verifyWorkspaceAgentConfirmation(issued.token, { ...context, organizationId: "00000000-0000-4000-8000-000000000099" })).toThrow(/another workspace or user/i);
  });

  it("rejects modified and expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T00:00:00.000Z"));
    const issued = createWorkspaceAgentConfirmation({ ...context, action: "CUSTOMER_CREATE", arguments: { displayName: "Synthetic Customer", phone: "9876543210" } });
    expect(() => verifyWorkspaceAgentConfirmation(`${issued.token.slice(0, -1)}x`, context)).toThrow(/invalid/i);
    vi.advanceTimersByTime(10 * 60_000 + 1);
    expect(() => verifyWorkspaceAgentConfirmation(issued.token, context)).toThrow(/expired/i);
  });

  it("keeps Agent confirmations cryptographically separate from access JWTs", () => {
    const issued = createWorkspaceAgentConfirmation({ ...context, action: "CUSTOMER_CREATE", arguments: { displayName: "Synthetic Customer", phone: "9876543210" } });
    const accessToken = issueAccessToken({ ...context, membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "OWNER", permissions: [] });
    expect(() => verifyWorkspaceAgentConfirmation(accessToken, context)).toThrow(/invalid/i);
    expect(() => verifyAccessToken(issued.token)).toThrow();
  });
});
