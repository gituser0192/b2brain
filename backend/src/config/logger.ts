import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-hub-signature-256']",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "tokenHash",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.tokenHash",
      "*.accessToken",
      "*.refreshToken",
      "*.apiKey",
      "*.secret",
      "err.config.headers.Authorization",
      "err.config.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
