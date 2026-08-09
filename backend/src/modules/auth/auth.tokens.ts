import { createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AuthContext } from "./auth.types.js";

const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function durationMs(value: string): number {
  const unit = value.at(-1) as keyof typeof unitMs;
  return Number(value.slice(0, -1)) * unitMs[unit];
}

export function issueAccessToken(context: AuthContext): string {
  return jwt.sign(context, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: Math.floor(durationMs(env.JWT_ACCESS_EXPIRES_IN) / 1000),
    issuer: "b2brain-backend",
    audience: "b2brain-frontend",
  });
}

export function verifyAccessToken(token: string): AuthContext {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: "b2brain-backend",
    audience: "b2brain-frontend",
  }) as AuthContext;
}

export function newRefreshToken(): string { return randomBytes(48).toString("base64url"); }
export function hashRefreshToken(token: string): string {
  return createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(token).digest("hex");
}
export function refreshExpiry(): Date { return new Date(Date.now() + durationMs(env.REFRESH_TOKEN_EXPIRES_IN)); }
