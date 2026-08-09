import { describe, expect, it } from "vitest";
import { createAgentSchema } from "../src/modules/agents/agent.validation.js";
const valid = { name: "Follow-up assistant", purpose: "Prepare safe CRM follow-up drafts.", instructions: "Use a professional tone.", supportedService: "CRM", status: "DRAFT", requiresApproval: true, allowedActions: ["CRM_CUSTOMER_READ", "MESSAGE_DRAFT"], dailyRunLimit: 10, dailyContactLimit: 0 };
describe("agent validation", () => {
  it("accepts a controlled agent definition", () => { expect(createAgentSchema.parse(valid)).toMatchObject({ name: "Follow-up assistant", requiresApproval: true }); });
  it("rejects tenant, audit, and unsupported action fields", () => { expect(() => createAgentSchema.parse({ ...valid, organizationId: crypto.randomUUID() })).toThrow(); expect(() => createAgentSchema.parse({ ...valid, allowedActions: ["MAKE_PHONE_CALL"] })).toThrow(); });
  it("bounds execution and contact limits", () => { expect(() => createAgentSchema.parse({ ...valid, dailyRunLimit: 1001 })).toThrow(); expect(() => createAgentSchema.parse({ ...valid, dailyContactLimit: -1 })).toThrow(); });
});
