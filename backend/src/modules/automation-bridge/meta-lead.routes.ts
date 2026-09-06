import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { success } from "../../shared/responses/api-response.js";
import { MetaLeadService } from "./meta-lead.service.js";

const service = new MetaLeadService(), limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Too many requests. Try again later.", code: "RATE_LIMITED" } });
const verify: RequestHandler = (request, response) => response.status(200).type("text/plain").send(service.verify(request.query["hub.mode"], request.query["hub.verify_token"], request.query["hub.challenge"]));
const receive: RequestHandler = async (request, response) => { const result = await service.accept((request as typeof request & { rawBody?: Buffer }).rawBody, request.header("x-hub-signature-256"), request.body); response.status(200).json(success(result, "Webhook accepted.")); };
export const metaLeadWebhookRouter = Router();
metaLeadWebhookRouter.get("/", verify);
metaLeadWebhookRouter.post("/", limiter, receive);
