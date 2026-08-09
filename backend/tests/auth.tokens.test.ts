import { describe, expect, it } from "vitest";
import { durationMs, hashRefreshToken, issueAccessToken, newRefreshToken, verifyAccessToken } from "../src/modules/auth/auth.tokens.js";

const context = {
  userId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
  roleCode: "ORGANIZATION_OWNER",
  permissions: ["ORGANIZATION_VIEW"],
  isPlatformAdmin: false,
};

describe("authentication tokens", () => {
  it("issues and verifies an access token with tenant context", () => {
    expect(verifyAccessToken(issueAccessToken(context))).toMatchObject(context);
  });

  it("creates high-entropy refresh tokens", () => {
    const first = newRefreshToken();
    expect(first.length).toBeGreaterThan(50);
    expect(newRefreshToken()).not.toBe(first);
  });

  it("stores a deterministic hash rather than the raw refresh token", () => {
    const token = newRefreshToken();
    const hash = hashRefreshToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it("parses configured token durations", () => {
    expect(durationMs("15m")).toBe(900_000);
    expect(durationMs("30d")).toBe(2_592_000_000);
  });
});
