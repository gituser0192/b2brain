import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

export function newPlatformInvitationToken() { return randomBytes(48).toString("base64url"); }
export function hashPlatformInvitationToken(token: string) { return createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(`platform-invitation:${token}`).digest("hex"); }
export function platformInvitationExpiry() { return new Date(Date.now() + 7 * 24 * 60 * 60_000); }
