import { describe, expect, it } from "vitest";
import { executePublicTool, publicToolRegistry } from "../src/modules/workspace-agent/workspace-agent.public-tools.js";
import { routeWorkspaceRequest } from "../src/modules/workspace-agent/workspace-agent.router.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: [] };

describe("workspace Agent public tools", () => {
  it("registers five read-only tools with no external effect", () => {
    expect(Object.keys(publicToolRegistry)).toEqual(["public.calculate", "public.weather", "public.reference_search", "public.currency_convert", "public.web_search"]);
    for (const tool of Object.values(publicToolRegistry)) expect(tool).toMatchObject({ mode: "READ", externalEffect: false });
  });
  it.each([
    ["Calculate 18% GST on ₹5,000", 5900], ["What is 12500 minus 18 percent?", 10250], ["20 plus 5", 25], ["average 10 20 30", 20], ["profit margin cost 80 selling 100", 20], ["markup cost 80 selling 100", 25],
  ])("calculates locally: %s", async (query, result) => expect(await executePublicTool(context, "public.calculate", query)).toMatchObject({ availability: "VERIFIED", external: false, details: { result } }));
  it.each(["eval(2+2)", "10 / 0", "function(){return 4}"])("rejects unsafe or invalid calculation: %s", async (query) => expect(executePublicTool(context, "public.calculate", query)).rejects.toBeTruthy());
  it("returns external tools unavailable without making a provider request", async () => expect(await executePublicTool(context, "public.weather", "weather in Gurugram")).toMatchObject({ availability: "UNAVAILABLE", external: true }));
  it.each(["Search using my access token abc", "Search my customer's phone number"])("blocks private public-provider queries: %s", async (query) => expect(executePublicTool(context, "public.web_search", query)).rejects.toMatchObject({ code: "PUBLIC_QUERY_BLOCKED" }));
  it("keeps public education separate from organization reads", () => {
    expect(routeWorkspaceRequest("What is CRM?").publicToolName).toBe("public.reference_search");
    expect(routeWorkspaceRequest("Show my CRM customers").publicToolName).toBeUndefined();
    expect(routeWorkspaceRequest("Calculate my profit").publicToolName).toBeUndefined();
    expect(routeWorkspaceRequest("kal gurugram me barish hogi").publicToolName).toBe("public.weather");
  });
});
