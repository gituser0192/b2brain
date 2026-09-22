import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service.js";

const membership = {
  id: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  user: { id: crypto.randomUUID(), firstName: "Test", lastName: null, email: "test@example.invalid", status: "ACTIVE", isPlatformAdmin: false },
  organization: { id: crypto.randomUUID(), name: "Test", slug: "test", status: "ACTIVE", timezone: "Asia/Kolkata", currency: "INR", isServiceProvider: false, onboardingCompletedAt: new Date() },
  role: { code: "ORGANIZATION_OWNER", name: "Owner", permissions: [] },
};

function repository(session: { revokedAt: Date | null; replacedBySessionId: string | null }, claims: number[]) {
  const updateMany = vi.fn().mockImplementation(() => Promise.resolve({ count: claims.shift() ?? 0 }));
  return {
    findSession: vi.fn().mockResolvedValue({ ...session, id: crypto.randomUUID(), userId: membership.userId, membershipId: membership.id, expiresAt: new Date(Date.now() + 60_000) }),
    findActiveContextByMembership: vi.fn().mockResolvedValue(membership),
    createSession: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ refreshSession: { updateMany } })),
    updateMany,
  };
}

describe("refresh-token rotation retry", () => {
  it("rotates an active refresh session", async () => {
    const repo = repository({ revokedAt: null, replacedBySessionId: null }, [1]);
    await expect(new AuthService(repo as never).refresh("token", {})).resolves.toHaveProperty("refreshToken");
    expect(repo.updateMany).toHaveBeenCalledTimes(1);
  });

  it("allows a recently rotated token to recover a canceled refresh response", async () => {
    const repo = repository({ revokedAt: new Date(), replacedBySessionId: crypto.randomUUID() }, [0, 1]);
    await expect(new AuthService(repo as never).refresh("token", {})).resolves.toHaveProperty("refreshToken");
    expect(repo.updateMany).toHaveBeenCalledTimes(2);
  });

  it("recovers when another request wins the rotation race", async () => {
    const repo = repository({ revokedAt: null, replacedBySessionId: null }, [0, 1]);
    await expect(new AuthService(repo as never).refresh("token", {})).resolves.toHaveProperty("refreshToken");
    expect(repo.updateMany).toHaveBeenCalledTimes(2);
  });

  it("rejects expired retry windows and explicitly revoked sessions", async () => {
    const old = repository({ revokedAt: new Date(Date.now() - 11_000), replacedBySessionId: crypto.randomUUID() }, []);
    await expect(new AuthService(old as never).refresh("token", {})).rejects.toMatchObject({ code: "INVALID_REFRESH_SESSION" });
    const loggedOut = repository({ revokedAt: new Date(), replacedBySessionId: null }, []);
    await expect(new AuthService(loggedOut as never).refresh("token", {})).rejects.toMatchObject({ code: "INVALID_REFRESH_SESSION" });
  });
});
