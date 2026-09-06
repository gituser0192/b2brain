import { Router, type RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { WebsiteOrderService } from "./website-order.service.js";

const service = new WebsiteOrderService();
const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, keyGenerator: request => `${ipKeyGenerator(request.ip ?? "unknown")}:${String(request.params.connectorPublicId ?? "unknown")}`, message: { success: false, message: "Too many requests. Try again later.", code: "RATE_LIMITED" } });
const receive: RequestHandler = async (request, response) => {
  if (!request.is("application/json")) throw new AppError(415, "Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE");
  const result = await service.accept(String(request.params.connectorPublicId ?? ""), (request as typeof request & { rawBody?: Buffer }).rawBody, request.header("x-b2brain-signature"), request.header("x-b2brain-timestamp"), request.header("x-b2brain-event-id"), request.body);
  response.status(result.duplicate ? 200 : 202).json(success({ accepted: true, duplicate: result.duplicate, reviewRequired: true, status: result.status, referenceId: result.correlationId }, result.duplicate ? "Order already accepted." : "Order accepted for review."));
};
export const websiteOrderWebhookRouter = Router();
websiteOrderWebhookRouter.post("/:connectorPublicId", limiter, receive);
