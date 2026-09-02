import { describe, expect, it, vi } from "vitest";
import { MembershipService } from "../src/modules/memberships/membership.service.js";

function repository(status: "ACTIVE" | "REMOVED") {
  return {
    findUser: vi.fn().mockResolvedValue({ id: "user-1" }),
    findMembership: vi.fn().mockResolvedValue({ id: "membership-1", status }),
    findRole: vi.fn().mockResolvedValue({ id: "role-1" }),
    createInvitation: vi.fn().mockImplementation((data: { expiresAt: Date }) => Promise.resolve({ id: "invitation-1", email: "member@example.com", status: "PENDING", expiresAt: data.expiresAt, role: { code: "ORGANIZATION_MEMBER", name: "Member" }, organization: { name: "Test organization" } })),
  };
}
const email = { invitation: vi.fn().mockResolvedValue({ delivered: true, preview: false }) };

describe("removed member reinvitations", () => {
  it("allows a removed membership to receive a new invitation", async () => {
    const fake = repository("REMOVED");
    const service = new MembershipService(fake as never, email as never);
    await expect(service.invite("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", { email: "member@example.com", roleCode: "ORGANIZATION_MEMBER" })).resolves.toMatchObject({ invitation: { email: "member@example.com" } });
    expect(fake.createInvitation).toHaveBeenCalledOnce();
  });

  it("continues to reject an active membership", async () => {
    const fake = repository("ACTIVE");
    const service = new MembershipService(fake as never, email as never);
    await expect(service.invite("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", { email: "member@example.com", roleCode: "ORGANIZATION_MEMBER" })).rejects.toMatchObject({ code: "MEMBERSHIP_ALREADY_EXISTS" });
    expect(fake.createInvitation).not.toHaveBeenCalled();
  });
});
