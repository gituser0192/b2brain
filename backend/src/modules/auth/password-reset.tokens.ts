import crypto from "node:crypto";
export const newPasswordResetToken = () => crypto.randomBytes(32).toString("base64url");
export const hashPasswordResetToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const passwordResetExpiry = () => new Date(Date.now() + 30 * 60_000);
