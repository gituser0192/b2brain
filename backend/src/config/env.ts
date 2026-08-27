import "dotenv/config";
import { z } from "zod";

const durationPattern = /^\d+[smhd]$/;
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "Must be a PostgreSQL URL"),
  DIRECT_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "Must be a PostgreSQL URL").optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  TRUST_PROXY: z.string().default("false").transform((value) => value === "true"),
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
  SMTP_HOST: z.string().optional().transform((value) => value || undefined),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_SECURE: z.string().default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional().transform((value) => value || undefined),
  SMTP_PASSWORD: z.string().optional().transform((value) => value || undefined),
  EMAIL_FROM: z.string().default("B2 Brain <no-reply@b2brain.local>"),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  if (!value.FRONTEND_URL.startsWith("https://")) context.addIssue({ code: "custom", path: ["FRONTEND_URL"], message: "Production frontend URL must use HTTPS." });
  if (!value.COOKIE_SECURE) context.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "Production cookies must be secure." });
  if (value.COOKIE_SAME_SITE !== "none") context.addIssue({ code: "custom", path: ["COOKIE_SAME_SITE"], message: "Cross-origin staging requires SameSite=none." });
  for (const [key, url] of [["DATABASE_URL", value.DATABASE_URL], ["DIRECT_URL", value.DIRECT_URL]] as const) {
    if (url && new URL(url).searchParams.get("sslmode") !== "require") context.addIssue({ code: "custom", path: [key], message: "Production database connections must require SSL." });
  }
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
