import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

function key(version: number) {
  const material = version === 1 ? env.BRIDGE_ENCRYPTION_KEY : version === 2 ? env.BRIDGE_ENCRYPTION_KEY_V2 : undefined;
  if (!material) throw new AppError(503, "Bridge credential encryption is not configured.", "BRIDGE_ENCRYPTION_NOT_CONFIGURED");
  return createHash("sha256").update(material).digest();
}

type CredentialScope = { organizationId: string; connectorId: string };
function aad(version: number, scope?: CredentialScope) {
  if (version !== 2) return undefined;
  if (!scope?.organizationId || !scope.connectorId) throw new AppError(400, "Credential scope is required.", "BRIDGE_CREDENTIAL_SCOPE_REQUIRED");
  return Buffer.from(`${scope.organizationId}:${scope.connectorId}`, "utf8");
}

export function encryptSecret(value: string, version = 1, scope?: CredentialScope) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(version), iv);
  const associatedData = aad(version, scope);
  if (associatedData) cipher.setAAD(associatedData);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string, version = 1, scope?: CredentialScope) {
  try {
    const [iv, tag, data] = value.split(".");
    if (!iv || !tag || !data) throw new Error("Invalid ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", key(version), Buffer.from(iv, "base64"));
    const associatedData = aad(version, scope);
    if (associatedData) decipher.setAAD(associatedData);
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError(500, "Stored bridge credential is invalid.", "INVALID_BRIDGE_CREDENTIAL");
  }
}
