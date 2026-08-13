import { describe, expect, it } from "vitest";
import { acceptInvitationSchema, inviteMemberSchema, updateMembershipSchema, updateMemberServicesSchema } from "../src/modules/memberships/membership.validation.js";
import { hashInvitationToken, newInvitationToken } from "../src/modules/memberships/membership.tokens.js";

describe("membership security and validation", () => {
  it("normalizes invitation email", () => {
    expect(inviteMemberSchema.parse({ email: " PERSON@EXAMPLE.COM ", roleCode: "ORGANIZATION_MEMBER" }).email).toBe("person@example.com");
  });
  it("does not allow assigning the owner role through invitations", () => {
    expect(() => inviteMemberSchema.parse({ email: "person@example.com", roleCode: "ORGANIZATION_OWNER" })).toThrow();
  });
  it("does not accept tenant identifiers from clients", () => {
    expect(() => inviteMemberSchema.parse({ email: "person@example.com", roleCode: "ORGANIZATION_MEMBER", organizationId: crypto.randomUUID() })).toThrow();
  });
  it("requires a strong acceptance password", () => {
    expect(() => acceptInvitationSchema.parse({ firstName: "Person", password: "password" })).toThrow();
  });
  it("only permits controlled membership updates", () => {
    expect(updateMembershipSchema.parse({ status: "SUSPENDED" })).toEqual({ status: "SUSPENDED" });
    expect(() => updateMembershipSchema.parse({ status: "REMOVED" })).toThrow();
  });
  it("hashes invitation tokens before persistence", () => {
    const token = newInvitationToken();
    expect(hashInvitationToken(token)).toHaveLength(64);
    expect(hashInvitationToken(token)).not.toContain(token);
  });
});

describe("member service access validation", () => {
  it("accepts a unique-looking list of service UUIDs", () => {
    expect(updateMemberServicesSchema.parse({ services: [{ serviceId: "00000000-0000-4000-8000-000000000001", accessMode: "READ_ONLY" }] }).services).toHaveLength(1);
  });

  it("rejects arbitrary service identifiers", () => {
    expect(() => updateMemberServicesSchema.parse({ services: [{ serviceId: "CRM", accessMode: "READ_WRITE" }] })).toThrow();
  });
});
