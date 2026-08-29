import "dotenv/config";
import { z } from "zod";

const durationPattern = /^\d+[smhd]$/;
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(5000),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "Must be a PostgreSQL URL",
      ),
    DIRECT_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "Must be a PostgreSQL URL",
      )
      .optional(),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    TRUST_PROXY: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().regex(durationPattern).default("15m"),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_EXPIRES_IN: z.string().regex(durationPattern).default("30d"),
    COOKIE_NAME: z.string().min(1).default("b2brain_refresh"),
    COOKIE_SECURE: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    PASSWORD_HASH_COST: z.coerce.number().int().min(8).max(16).default(12),
    SUPER_ADMIN_EMAIL: z
      .string()
      .email()
      .optional()
      .transform((value) => value?.toLowerCase()),
    BRIDGE_ENCRYPTION_KEY: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_ENABLED: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    META_WHATSAPP_OUTBOUND_ENABLED: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    META_WHATSAPP_VERIFY_TOKEN: z
      .string()
      .min(16)
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_APP_SECRET: z
      .string()
      .min(16)
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_ACCESS_TOKEN: z
      .string()
      .min(20)
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_PHONE_NUMBER_ID: z
      .string()
      .min(5)
      .max(100)
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: z
      .string()
      .min(5)
      .max(100)
      .optional()
      .transform((value) => value || undefined),
    META_WHATSAPP_ALLOWED_TEST_RECIPIENTS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.replace(/\D/g, ""))
          .filter(Boolean),
      ),
    META_WHATSAPP_WEBHOOK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(30000)
      .default(10000),
    META_WHATSAPP_PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(30000)
      .default(10000),
    META_WHATSAPP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    META_GRAPH_API_VERSION: z.string().default("v23.0"),
    SMTP_HOST: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_SECURE: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    SMTP_PASSWORD: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    EMAIL_FROM: z.string().default("B2 Brain <no-reply@b2brain.local>"),
    ENQUIRY_AI_MODE: z
      .enum(["deterministic", "hosted"])
      .default("deterministic"),
    ENQUIRY_AI_KILL_SWITCH: z
      .string()
      .default("false")
      .transform((value) => value === "true"),
    ENQUIRY_AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    ENQUIRY_AI_MODEL: z
      .string()
      .min(1)
      .optional()
      .transform((value) => value || undefined),
    OPENAI_API_KEY: z
      .string()
      .min(1)
      .optional()
      .transform((value) => value || undefined),
    ENQUIRY_AI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60000)
      .default(12000),
    ENQUIRY_AI_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
    ENQUIRY_AI_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(200)
      .max(2000)
      .default(700),
    ENQUIRY_AI_DAILY_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(100),
  })
  .superRefine((value, context) => {
    if (value.META_WHATSAPP_ENABLED) {
      for (const key of [
        "META_WHATSAPP_VERIFY_TOKEN",
        "META_WHATSAPP_APP_SECRET",
        "META_WHATSAPP_PHONE_NUMBER_ID",
        "META_WHATSAPP_BUSINESS_ACCOUNT_ID",
      ] as const)
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when Meta WhatsApp is enabled.`,
          });
    }
    if (value.META_WHATSAPP_OUTBOUND_ENABLED) {
      if (!value.META_WHATSAPP_ENABLED)
        context.addIssue({
          code: "custom",
          path: ["META_WHATSAPP_OUTBOUND_ENABLED"],
          message:
            "Inbound Meta WhatsApp must be enabled before outbound delivery.",
        });
      if (!value.META_WHATSAPP_ACCESS_TOKEN)
        context.addIssue({
          code: "custom",
          path: ["META_WHATSAPP_ACCESS_TOKEN"],
          message: "Outbound Meta WhatsApp requires an access token.",
        });
      if (value.META_WHATSAPP_ALLOWED_TEST_RECIPIENTS.length === 0)
        context.addIssue({
          code: "custom",
          path: ["META_WHATSAPP_ALLOWED_TEST_RECIPIENTS"],
          message:
            "At least one explicit test recipient is required for outbound delivery.",
        });
    }
    if (value.ENQUIRY_AI_MODE === "hosted" && !value.ENQUIRY_AI_KILL_SWITCH) {
      if (!value.OPENAI_API_KEY)
        context.addIssue({
          code: "custom",
          path: ["OPENAI_API_KEY"],
          message: "Hosted enquiry AI requires an API key.",
        });
      if (!value.ENQUIRY_AI_MODEL)
        context.addIssue({
          code: "custom",
          path: ["ENQUIRY_AI_MODEL"],
          message: "Hosted enquiry AI requires a model.",
        });
    }
    if (value.NODE_ENV !== "production") return;
    if (!value.FRONTEND_URL.startsWith("https://"))
      context.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message: "Production frontend URL must use HTTPS.",
      });
    if (!value.COOKIE_SECURE)
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "Production cookies must be secure.",
      });
    if (value.COOKIE_SAME_SITE !== "none")
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message: "Cross-origin staging requires SameSite=none.",
      });
    for (const [key, url] of [
      ["DATABASE_URL", value.DATABASE_URL],
      ["DIRECT_URL", value.DIRECT_URL],
    ] as const) {
      if (url && new URL(url).searchParams.get("sslmode") !== "require")
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Production database connections must require SSL.",
        });
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
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ""),
    environment: env.NODE_ENV,
  };
}
