import { describe, expect, it } from "vitest";
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
});
