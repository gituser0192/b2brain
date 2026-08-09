import { describe, expect, it } from "vitest";
import { organizationPlanAssignmentSchema, servicePlanSchema } from "../src/modules/platform/platform.validation.js";

describe("service plan validation", () => {
  it("accepts a controlled plan definition", () => expect(servicePlanSchema.parse({ code: "GROWTH", name: "Growth", description: null, status: "ACTIVE", serviceIds: [crypto.randomUUID()] })).toMatchObject({ code: "GROWTH" }));
  it("rejects tenant-owned identifiers in plan definitions", () => expect(() => servicePlanSchema.parse({ code: "GROWTH", name: "Growth", status: "ACTIVE", serviceIds: [], organizationId: crypto.randomUUID() })).toThrow());
  it("requires an end date for a trial", () => expect(() => organizationPlanAssignmentSchema.parse({ planId: crypto.randomUUID(), status: "TRIAL", startsAt: "2026-08-10T00:00:00.000Z", trialEndsAt: null, expiresAt: null, additionalServiceIds: [], removedServiceIds: [] })).toThrow());
  it("rejects conflicting service overrides", () => { const id = crypto.randomUUID(); expect(() => organizationPlanAssignmentSchema.parse({ planId: crypto.randomUUID(), status: "ACTIVE", startsAt: "2026-08-10T00:00:00.000Z", trialEndsAt: null, expiresAt: null, additionalServiceIds: [id], removedServiceIds: [id] })).toThrow(); });
});
