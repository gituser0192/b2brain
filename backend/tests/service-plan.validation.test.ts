import { describe, expect, it } from "vitest";
import { organizationPlanAssignmentSchema, servicePlanSchema, subscriptionPaymentSchema } from "../src/modules/platform/platform.validation.js";

describe("service plan validation", () => {
  it("accepts a controlled plan definition", () => expect(servicePlanSchema.parse({ code: "GROWTH", name: "Growth", description: null, status: "ACTIVE", monthlyPrice: 6999, yearlyPrice: 69990, currency: "inr", serviceIds: [crypto.randomUUID()] })).toMatchObject({ code: "GROWTH", currency: "INR" }));
  it("rejects tenant-owned identifiers in plan definitions", () => expect(() => servicePlanSchema.parse({ code: "GROWTH", name: "Growth", status: "ACTIVE", serviceIds: [], organizationId: crypto.randomUUID() })).toThrow());
  it("requires an end date for a trial", () => expect(() => organizationPlanAssignmentSchema.parse({ planId: crypto.randomUUID(), status: "TRIAL", billingCycle: "MONTHLY", startsAt: "2026-08-10T00:00:00.000Z", trialEndsAt: null, expiresAt: null, additionalServiceIds: [], removedServiceIds: [] })).toThrow());
  it("rejects conflicting service overrides", () => { const id = crypto.randomUUID(); expect(() => organizationPlanAssignmentSchema.parse({ planId: crypto.randomUUID(), status: "ACTIVE", billingCycle: "MONTHLY", startsAt: "2026-08-10T00:00:00.000Z", trialEndsAt: null, expiresAt: null, additionalServiceIds: [id], removedServiceIds: [id] })).toThrow(); });
  it("accepts a manual payment without frontend-owned tenant identifiers", () => expect(subscriptionPaymentSchema.parse({ amount: 6999, paidAt: "2026-08-10T00:00:00.000Z", reference: "UPI-123", note: null })).toMatchObject({ amount: 6999 }));
  it("rejects zero-value subscription payments", () => expect(() => subscriptionPaymentSchema.parse({ amount: 0, paidAt: "2026-08-10T00:00:00.000Z" })).toThrow());
});
