import { describe, expect, it } from "vitest";
import { automationPolicySchema, simulatePolicySchema } from "../src/modules/automation-policies/automation-policy.validation.js";

const valid = {
  name: "Route website inquiries",
  description: "Prepare verified website inquiries for the CRM team.",
  serviceCode: "AUTOMATION",
  eventCode: "INTEGRATION.INQUIRY_RECEIVED",
  actionCode: "ROUTE_INQUIRY",
  status: "ACTIVE",
  executionMode: "APPROVAL_REQUIRED",
  conditions: { source: "WEBSITE" },
  actionConfig: {},
  priority: 100,
  cooldownMinutes: 0,
};

describe("automation policy validation", () => {
  it("accepts a controlled policy", () => expect(automationPolicySchema.parse(valid)).toMatchObject({ name: valid.name, status: "ACTIVE" }));
  it("rejects unbounded priority and malformed codes", () => expect(() => automationPolicySchema.parse({ ...valid, priority: 0, eventCode: "bad event" })).toThrow());
  it("accepts a tenant-context simulation event without organization or user IDs", () => expect(simulatePolicySchema.parse({ eventCode: valid.eventCode, sourceType: "MANUAL_TEST", payload: {} })).not.toHaveProperty("organizationId"));
});
