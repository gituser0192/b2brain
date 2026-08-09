import { describe, expect, it } from "vitest";
import { createRoleSchema, updateRoleSchema } from "../src/modules/roles/role.validation.js";

describe("organization role validation", () => {
  it("deduplicates permission codes", () => {
    const value = createRoleSchema.parse({ name: "Reviewer", permissionCodes: ["ORGANIZATION_VIEW", "ORGANIZATION_VIEW"] });
    expect(value.permissionCodes).toEqual(["ORGANIZATION_VIEW"]);
  });
  it("rejects client tenant identifiers", () => {
    expect(() => createRoleSchema.parse({ name: "Reviewer", permissionCodes: ["ORGANIZATION_VIEW"], organizationId: crypto.randomUUID() })).toThrow();
  });
  it("requires at least one permission", () => {
    expect(() => createRoleSchema.parse({ name: "Reviewer", permissionCodes: [] })).toThrow();
  });
  it("rejects invalid permission vocabulary", () => {
    expect(() => createRoleSchema.parse({ name: "Reviewer", permissionCodes: ["organization.view"] })).toThrow();
  });
  it("requires an actual update", () => {
    expect(() => updateRoleSchema.parse({})).toThrow();
  });
});
