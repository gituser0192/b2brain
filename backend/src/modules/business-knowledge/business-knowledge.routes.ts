import { Router, type RequestHandler } from "express";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { BusinessKnowledgeService } from "./business-knowledge.service.js";
import {
  knowledgeCategories,
  knowledgeInputSchema,
  type KnowledgeInput,
} from "./business-knowledge.validation.js";

const service = new BusinessKnowledgeService();
const auth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};
const statuses = ["DRAFT", "APPROVED", "ARCHIVED"];
export const businessKnowledgeRouter = Router();
businessKnowledgeRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("AUTOMATION"),
);
businessKnowledgeRouter.get(
  "/",
  requirePermission("AUTOMATION_VIEW"),
  async (request, response) =>
    response.json(
      success(
        await service.list(auth(request).organizationId, {
          ...(typeof request.query.status === "string" &&
          statuses.includes(request.query.status)
            ? { status: request.query.status }
            : {}),
          ...(typeof request.query.category === "string" &&
          knowledgeCategories.includes(
            request.query.category as (typeof knowledgeCategories)[number],
          )
            ? { category: request.query.category }
            : {}),
          ...(typeof request.query.search === "string"
            ? { search: request.query.search.trim().slice(0, 120) }
            : {}),
        }),
      ),
    ),
);
businessKnowledgeRouter.post(
  "/",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(knowledgeInputSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.create(
            context.organizationId,
            context.userId,
            request.body as KnowledgeInput,
          ),
          "Knowledge draft created.",
        ),
      );
  },
);
businessKnowledgeRouter.put(
  "/:id",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(knowledgeInputSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.update(
          context.organizationId,
          context.userId,
          String(request.params.id),
          request.body as KnowledgeInput,
        ),
        "Knowledge draft saved.",
      ),
    );
  },
);
businessKnowledgeRouter.post(
  "/:id/approve",
  requirePermission("AUTOMATION_MANAGE"),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.approve(
          context.organizationId,
          context.userId,
          String(request.params.id),
        ),
        "Knowledge approved.",
      ),
    );
  },
);
businessKnowledgeRouter.delete(
  "/:id",
  requirePermission("AUTOMATION_MANAGE"),
  async (request, response) => {
    const context = auth(request);
    await service.archive(
      context.organizationId,
      context.userId,
      String(request.params.id),
    );
    response.json(success({}, "Knowledge archived."));
  },
);
