import { describe, expect, it } from "vitest";
import { acceptInvitationSchema, inviteMemberSchema, updateMembershipSchema } from "../src/modules/memberships/membership.validation.js";
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
