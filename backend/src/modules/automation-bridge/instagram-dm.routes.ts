import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { success } from "../../shared/responses/api-response.js";
import { InstagramDmService } from "./instagram-dm.service.js";

const service = new InstagramDmService();
const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const verify: RequestHandler = (request, response) => response.status(200).type("text/plain").send(service.verify(request.query["hub.mode"], request.query["hub.verify_token"], request.query["hub.challenge"]));
const receive: RequestHandler = async (request, response) => {
  const result = await service.accept((request as typeof request & { rawBody?: Buffer }).rawBody, request.header("x-hub-signature-256"), request.body);
  response.status(200).json(success(result, "Webhook accepted."));
};
export const instagramDmWebhookRouter = Router();
instagramDmWebhookRouter.get("/", verify);
instagramDmWebhookRouter.post("/", limiter, receive);
