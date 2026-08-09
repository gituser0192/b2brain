import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../src/modules/auth/auth.validation.js";

describe("authentication validation", () => {
  it("requires an invitation token and trims names", () => {
    const result = registerSchema.parse({ invitationToken: "a".repeat(64), firstName: "  Ada ", lastName: " Lovelace ", password: "StrongPass123" });
    expect(result).toMatchObject({ invitationToken: "a".repeat(64), firstName: "Ada", lastName: "Lovelace" });
  });

  it("rejects registration without an invitation", () => {
    expect(() => registerSchema.parse({ firstName: "Ada", password: "StrongPass123" })).toThrow();
  });

  it("rejects weak passwords without a number", () => {
    expect(() => registerSchema.parse({ invitationToken: "a".repeat(64), firstName: "Ada", password: "onlyletters" })).toThrow();
  });

  it("rejects passwords longer than the hashing limit", () => {
    expect(() => registerSchema.parse({ invitationToken: "a".repeat(64), firstName: "Ada", password: `A1${"x".repeat(127)}` })).toThrow();
  });

  it("does not accept client-supplied tenant context", () => {
    expect(() => registerSchema.parse({ invitationToken: "a".repeat(64), firstName: "Ada", password: "StrongPass123", organizationId: crypto.randomUUID(), email: "ada@example.com" })).toThrow();
  });

  it("normalizes login email without altering the password", () => {
    expect(loginSchema.parse({ email: " ADA@EXAMPLE.COM ", password: " Exact Password 1 " })).toEqual({ email: "ada@example.com", password: " Exact Password 1 " });
  });
});
