import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { WebsiteFormService } from "./website-form.service.js";
import { websiteFormConfigSchema, websiteLeadSchema, type WebsiteFormConfigInput, type WebsiteLeadInput } from "./website-form.validation.js";

const service = new WebsiteFormService();
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many form submissions. Please try again later.", code: "RATE_LIMITED" },
});
const auth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};

export const publicWebsiteFormRouter = Router();
publicWebsiteFormRouter.get("/:formKey", async (request, response) =>
  response.json(success(await service.publicConfig(String(request.params.formKey)))));
publicWebsiteFormRouter.post("/:formKey", limiter, validateBody(websiteLeadSchema), async (request, response) =>
  response.status(202).json(success(await service.submit(String(request.params.formKey), request.body as WebsiteLeadInput), "Inquiry received.")));

export const websiteFormAdminRouter = Router();
websiteFormAdminRouter.use(requireAuth, requireActiveContext, requireEnabledService("AUTOMATION"));
websiteFormAdminRouter.put("/connectors/:id/website-form", requirePermission("AUTOMATION_MANAGE"), validateBody(websiteFormConfigSchema), async (request, response) => {
  const context = auth(request);
  response.json(success(await service.updateConfig(context.organizationId, context.userId, String(request.params.id), request.body as WebsiteFormConfigInput), "Website form configured."));
});
