import "dotenv/config";
import { z } from "zod";

const durationPattern = /^\d+[smhd]$/;
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "Must be a PostgreSQL URL"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().regex(durationPattern).default("15m"),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().regex(durationPattern).default("30d"),
  COOKIE_NAME: z.string().min(1).default("b2brain_refresh"),
  COOKIE_SECURE: z.string().default("false").transform((value) => value === "true"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional().transform((value) => value || undefined),
  PASSWORD_HASH_COST: z.coerce.number().int().min(8).max(16).default(12),
  SUPER_ADMIN_EMAIL: z.string().email().optional().transform((value) => value?.toLowerCase()),
  BRIDGE_ENCRYPTION_KEY: z.string().optional().transform((value) => value || undefined),
  META_GRAPH_API_VERSION: z.string().default("v23.0"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const fields = Object.keys(result.error.flatten().fieldErrors).join(", ");
  throw new Error(`Invalid environment configuration. Check: ${fields}`);
}

export const env = result.data;

export function safeDatabaseIdentity() {
  const url = new URL(env.DATABASE_URL);
  return { host: url.hostname, database: url.pathname.replace(/^\//, ""), environment: env.NODE_ENV };
}
