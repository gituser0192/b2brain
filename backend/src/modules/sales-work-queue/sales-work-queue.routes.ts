import { Router } from "express";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { validateBody } from "../../middleware/validate.js";
import {
  recommendationDecisionSchema,
  type RecommendationDecisionInput,
} from "../action-centre/action-centre.validation.js";
import { ActionCentreService } from "../action-centre/action-centre.service.js";
import { SalesWorkQueueService } from "./sales-work-queue.service.js";
import { salesQueueQuerySchema } from "./sales-work-queue.validation.js";

const service = new SalesWorkQueueService();
const actionCentre = new ActionCentreService();
const id = (value: string | string[] | undefined) => {
  if (typeof value !== "string")
    throw new AppError(
      400,
      "A valid work item ID is required.",
      "INVALID_WORK_ITEM_ID",
    );
  return value;
};
export const salesWorkQueueRouter = Router();
salesWorkQueueRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("SALES"),
);
salesWorkQueueRouter.post(
  "/pipeline-alerts/:id/decision",
  requirePermission("DEAL_MANAGE"),
  validateBody(recommendationDecisionSchema),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    response.json(
      success(
        await actionCentre.decide(
          request.auth.organizationId,
          request.auth.userId,
          request.auth.permissions,
          id(request.params.id),
          request.body as RecommendationDecisionInput,
        ),
        "Pipeline alert updated.",
      ),
    );
  },
);
salesWorkQueueRouter.get(
  "/",
  requirePermission("DEAL_VIEW"),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    response.json(
      success(
        await service.list(
          request.auth.organizationId,
          request.auth.userId,
          request.auth.roleCode,
          request.auth.permissions,
          salesQueueQuerySchema.parse(request.query),
        ),
      ),
    );
  },
);
salesWorkQueueRouter.patch(
  "/automated-follow-ups/:id/complete",
  requireEnabledService("AUTOMATION"),
  requirePermission("AUTOMATION_MANAGE"),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    await service.completeAutomatedFollowUp(
      request.auth.organizationId,
      request.auth.userId,
      id(request.params.id),
    );
    response.json(success({}, "Automated follow-up completed."));
  },
);
salesWorkQueueRouter.get(
  "/journeys",
  requirePermission("DEAL_VIEW"),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    response.json(
      success(
        await service.journeys(
          request.auth.organizationId,
          request.auth.membershipId,
          request.auth.roleCode,
          request.auth.permissions,
        ),
      ),
    );
  },
);
salesWorkQueueRouter.patch(
  "/crm-follow-ups/:id/complete",
  requireEnabledService("CRM"),
  requirePermission("CRM_FOLLOWUP_MANAGE"),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    await service.completeCrmFollowUp(
      request.auth.organizationId,
      request.auth.userId,
      id(request.params.id),
    );
    response.json(success({}, "CRM follow-up completed."));
  },
);
salesWorkQueueRouter.patch(
  "/inquiries/:id/follow-up/complete",
  requireEnabledService("LEADS"),
  requirePermission("INQUIRY_MANAGE"),
  async (request, response) => {
    if (!request.auth)
      throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
    await service.completeInquiryFollowUp(
      request.auth.organizationId,
      request.auth.userId,
      id(request.params.id),
    );
    response.json(success({}, "Inquiry follow-up completed."));
  },
);
