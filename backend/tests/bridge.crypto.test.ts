import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import {
  decryptSecret,
  encryptSecret,
} from "../src/modules/automation-bridge/bridge.crypto.js";
describe("bridge credential encryption", () => {
  it("encrypts authenticated ciphertext and decrypts it", () => {
    const secret = "meta-secret-value-123",
      ciphertext = encryptSecret(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decryptSecret(ciphertext)).toBe(secret);
  });
  it("rejects modified ciphertext", () => {
    const ciphertext = encryptSecret("meta-secret-value-123"),
      parts = ciphertext.split(".");
    parts[1] = `${parts[1]?.startsWith("A") ? "B" : "A"}${parts[1]?.slice(1)}`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
  it("preserves version-one ciphertext and redacts an unsupported key version", () => {
    const secret = "synthetic-credential-never-log";
    const ciphertext = encryptSecret(secret, 1);
    expect(decryptSecret(ciphertext, 1)).toBe(secret);
    expect(() => decryptSecret(ciphertext, 99)).toThrowError("Stored bridge credential is invalid.");
    try { decryptSecret(ciphertext, 99); } catch (error) { expect(String(error)).not.toContain(secret); }
  });
  it("binds version-two ciphertext to one connector and organization", () => {
    const previous = env.BRIDGE_ENCRYPTION_KEY_V2;
    env.BRIDGE_ENCRYPTION_KEY_V2 = "synthetic-version-two-encryption-key";
    try {
      const scope = { organizationId: "organization-a", connectorId: "connector-a" };
      const ciphertext = encryptSecret("synthetic-scoped-credential", 2, scope);
      expect(decryptSecret(ciphertext, 2, scope)).toBe("synthetic-scoped-credential");
      expect(() => decryptSecret(ciphertext, 2, { ...scope, organizationId: "organization-b" })).toThrowError("Stored bridge credential is invalid.");
      expect(() => decryptSecret(ciphertext, 2, { ...scope, connectorId: "connector-b" })).toThrowError("Stored bridge credential is invalid.");
      expect(() => encryptSecret("synthetic-scoped-credential", 2)).toThrowError("Credential scope is required.");
    } finally { env.BRIDGE_ENCRYPTION_KEY_V2 = previous; }
  });
});
