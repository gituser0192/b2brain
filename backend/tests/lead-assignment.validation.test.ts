import { describe, expect, it } from "vitest";
import { leadAssignmentRuleSchema, manualLeadAssignmentSchema } from "../src/modules/inquiries/lead-assignment.validation.js";

const employeeId = crypto.randomUUID();
describe("lead assignment validation", () => {
  it("accepts a controlled round-robin rule", () => expect(leadAssignmentRuleSchema.parse({ name: "Website sales", isActive: true, sortOrder: 10, source: "WEBSITE", inquiryType: "SALES", priority: null, campaignId: null, strategy: "ROUND_ROBIN", eligibleEmployeeIds: [employeeId], responseTimeMinutes: 30, escalationAfterMinutes: 60, escalationEmployeeId: crypto.randomUUID() })).toMatchObject({ source: "WEBSITE", strategy: "ROUND_ROBIN" }));
  it("requires exactly one employee for fixed assignment", () => expect(() => leadAssignmentRuleSchema.parse({ name: "Fixed", isActive: true, sortOrder: 10, strategy: "FIXED", eligibleEmployeeIds: [employeeId, crypto.randomUUID()], responseTimeMinutes: 30 })).toThrow());
  it("requires an escalation owner when escalation is enabled", () => expect(() => leadAssignmentRuleSchema.parse({ name: "Escalate", isActive: true, sortOrder: 10, strategy: "ROUND_ROBIN", eligibleEmployeeIds: [employeeId], responseTimeMinutes: 30, escalationAfterMinutes: 60 })).toThrow());
  it("rejects tenant-owned identifiers", () => expect(() => leadAssignmentRuleSchema.parse({ name: "Unsafe", isActive: true, sortOrder: 10, strategy: "FIXED", eligibleEmployeeIds: [employeeId], responseTimeMinutes: 30, organizationId: crypto.randomUUID() })).toThrow());
  it("accepts a reasoned manual reassignment", () => expect(manualLeadAssignmentSchema.parse({ employeeId, reason: "Territory ownership", responseTimeMinutes: 45 })).toMatchObject({ employeeId, responseTimeMinutes: 45 }));
});
