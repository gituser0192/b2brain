import { describe, expect, it } from "vitest";
import {
  createServiceRequestSchema,
  customerApprovalSchema,
  customerServiceMessageSchema,
} from "../src/modules/service-requests/service-request.validation.js";

describe("B2 Brain service request validation", () => {
  it("accepts a categorized customer request", () => {
    expect(
      createServiceRequestSchema.parse({
        category: "PLAN_BILLING",
        subject: "Upgrade our plan",
        description: "Please explain the available upgrade options.",
        priority: "MEDIUM",
      }),
    ).toMatchObject({ category: "PLAN_BILLING" });
  });

  it("rejects tenant, assignment, status, and audit identifiers from customers", () => {
    expect(() =>
      createServiceRequestSchema.parse({
        category: "CRM",
        subject: "CRM assistance",
        description: "We need help configuring our pipeline.",
        priority: "HIGH",
        organizationId: crypto.randomUUID(),
        assignedToId: crypto.randomUUID(),
        status: "COMPLETED",
        createdById: crypto.randomUUID(),
      }),
    ).toThrow();
  });

  it("accepts message text only", () => {
    expect(
      customerServiceMessageSchema.parse({
        body: "Here is the additional information.",
      }),
    ).toEqual({ body: "Here is the additional information." });
    expect(() =>
      customerServiceMessageSchema.parse({
        body: "Message",
        type: "INTERNAL_NOTE",
      }),
    ).toThrow();
  });
  it("accepts only the customer's approval decision and note", () => {
    expect(
      customerApprovalSchema.parse({
        approved: true,
        note: "Approved to proceed.",
      }),
    ).toEqual({ approved: true, note: "Approved to proceed." });
    expect(() =>
      customerApprovalSchema.parse({
        approved: true,
        note: "Approved",
        organizationId: crypto.randomUUID(),
        approvalDecidedById: crypto.randomUUID(),
      }),
    ).toThrow();
  });
});
