import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { validateBody } from "../../middleware/validate.js";
import { EmailService } from "../../shared/email/email.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  organization: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(200).default(""),
}).strict();

const limiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });
const email = new EmailService();
export const publicAccessRouter = Router();

publicAccessRouter.post("/request-access", limiter, validateBody(schema), async (request, response) => {
  const input = request.body as z.infer<typeof schema>;
  if (input.website) return response.status(202).json(success({}, "Request received."));
  const content = `Name: ${input.name}\nEmail: ${input.email}\nOrganization: ${input.organization}\n\n${input.message}`;
  const delivery = await email.send({
    to: "sathsupport@sathos.in",
    subject: "SATHOS access request",
    text: content,
    html: `<pre style="white-space:pre-wrap;font-family:sans-serif">${content.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)}</pre>`,
  });
  if (!delivery.delivered) throw new AppError(503, "We could not send your request. Please try again later or email sathsupport@sathos.in.", "ACCESS_REQUEST_DELIVERY_FAILED");
  return response.status(202).json(success({}, "Request received."));
});
