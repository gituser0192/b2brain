import { Router, type RequestHandler } from "express";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
  verifyServiceAccess,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { QuotationService } from "./quotation.service.js";
import {
  quotationConversionSchema,
  quotationFollowUpSchema,
  quotationSchema,
  quotationStatusSchema,
  quotationShareSchema,
  quotationPublicDecisionSchema,
  type QuotationConversionInput,
  type QuotationFollowUpInput,
  type QuotationInput,
  type QuotationStatusInput,
  type QuotationShareInput,
  type QuotationPublicDecisionInput,
} from "./quotation.validation.js";

const service = new QuotationService();
function auth(request: Parameters<RequestHandler>[0]) {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
}

export const quotationRouter = Router();
export const publicQuotationRouter = Router();
publicQuotationRouter.get("/:token", async (request, response) =>
  response.json(success(await service.publicView(String(request.params.token)))));
publicQuotationRouter.post("/:token/decision", validateBody(quotationPublicDecisionSchema), async (request, response) =>
  response.json(success(await service.publicDecision(String(request.params.token), request.body as QuotationPublicDecisionInput), "Quotation response recorded.")));
quotationRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("SALES"),
);
quotationRouter.get(
  "/",
  requirePermission("DEAL_VIEW"),
  async (request, response) =>
    response.json(success(await service.list(auth(request).organizationId))),
);
quotationRouter.post(
  "/",
  requirePermission("DEAL_MANAGE"),
  validateBody(quotationSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.create(
            context.organizationId,
            context.userId,
            request.body as QuotationInput,
          ),
          "Quotation created.",
        ),
      );
  },
);
quotationRouter.put(
  "/:id",
  requirePermission("DEAL_MANAGE"),
  validateBody(quotationSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.update(
          context.organizationId,
          context.userId,
          String(request.params.id),
          request.body as QuotationInput,
        ),
        "Quotation updated.",
      ),
    );
  },
);
quotationRouter.patch(
  "/:id/status",
  requirePermission("DEAL_MANAGE"),
  validateBody(quotationStatusSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.setStatus(
          context.organizationId,
          context.userId,
          String(request.params.id),
          (request.body as QuotationStatusInput).status,
        ),
        "Quotation status updated.",
      ),
    );
  },
);
quotationRouter.post(
  "/:id/share",
  requirePermission("DEAL_MANAGE"),
  validateBody(quotationShareSchema),
  async (request, response) => {
    const context = auth(request), input = request.body as QuotationShareInput;
    if (input.channel === "WHATSAPP") await verifyServiceAccess(context, "AUTOMATION", "AUTOMATION_MANAGE");
    response.json(success(await service.share(context.organizationId, context.userId, String(request.params.id), input), "Quotation sharing prepared."));
  },
);
quotationRouter.post(
  "/:id/follow-up",
  requirePermission("DEAL_MANAGE"),
  validateBody(quotationFollowUpSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.scheduleFollowUp(
            context.organizationId,
            context.userId,
            String(request.params.id),
            request.body as QuotationFollowUpInput,
          ),
          "Quotation follow-up scheduled.",
        ),
      );
  },
);
quotationRouter.post(
  "/:id/convert",
  requireEnabledService("FINANCE"),
  requirePermission("FINANCE_MANAGE"),
  validateBody(quotationConversionSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.convert(
            context.organizationId,
            context.userId,
            String(request.params.id),
            request.body as QuotationConversionInput,
          ),
          "Invoice created from quotation.",
        ),
      );
  },
);
quotationRouter.delete(
  "/:id",
  requirePermission("DEAL_MANAGE"),
  async (request, response) => {
    const context = auth(request);
    await service.archive(
      context.organizationId,
      context.userId,
      String(request.params.id),
    );
    response.json(success(null, "Quotation archived."));
  },
);
