import { describe, expect, it } from "vitest";
import { managedServiceUpdateSchema } from "../src/modules/managed-services/managed-service.validation.js";
import { providerSubmissionSchema } from "../src/modules/websites/website.validation.js";

describe("managed service desk validation", () => {
  it("requires an explicit customer handoff confirmation", () => {
    expect(providerSubmissionSchema.parse({ confirmation: true })).toEqual({ confirmation: true });
    expect(() => providerSubmissionSchema.parse({ confirmation: false })).toThrow();
  });

  it("rejects tenant and audit identity supplied by the operations frontend", () => {
    expect(() => managedServiceUpdateSchema.parse({
      status: "IN_PROGRESS",
      assignedToId: null,
      customerUpdate: "Work has started.",
      internalNote: null,
      organizationId: crypto.randomUUID(),
      updatedById: crypto.randomUUID(),
    })).toThrow();
  });

  it("requires a customer-visible progress update", () => {
    expect(() => managedServiceUpdateSchema.parse({
      status: "TRIAGED",
      assignedToId: null,
      customerUpdate: "",
      internalNote: null,
    })).toThrow();
  });
});
