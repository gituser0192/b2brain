import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { apiRouter } from "./routes.js";

function safeRequestLog(value: unknown) {
  const request = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const url = typeof request.url === "string" ? request.url.split("?")[0] : undefined;
  return {
    ...(typeof request.id === "string" || typeof request.id === "number" ? { id: request.id } : {}),
    ...(typeof request.method === "string" ? { method: request.method } : {}),
    ...(url ? { url } : {}),
    ...(typeof request.remoteAddress === "string" ? { remoteAddress: request.remoteAddress } : {}),
  };
}

export const app = express();

app.disable("x-powered-by");
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) { callback(null, !origin || origin === env.FRONTEND_URL); },
  credentials: true,
}));
app.use(pinoHttp({
  logger,
  serializers: {
    req: safeRequestLog,
  },
}));
app.use(express.json({ limit: "1mb", verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
