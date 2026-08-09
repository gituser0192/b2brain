import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

export function newInvitationToken() { return randomBytes(32).toString("base64url"); }
export function hashInvitationToken(token: string) {
  return createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(`membership-invitation:${token}`).digest("hex");
}
export function invitationExpiry() { return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); }
