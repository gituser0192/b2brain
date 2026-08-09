import { Router, type RequestHandler } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { ActionCentreService } from "./action-centre.service.js";
import { recommendationDecisionSchema, type RecommendationDecisionInput } from "./action-centre.validation.js";

const service = new ActionCentreService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
export const actionCentreRouter = Router();
actionCentreRouter.use(requireAuth, requireActiveContext);
actionCentreRouter.get("/", requirePermission("APPROVAL_VIEW"), async (request, response) => { const context = auth(request); response.json(success(await service.list(context.organizationId, context.permissions))); });
actionCentreRouter.post("/:id/decision", requirePermission("APPROVAL_DECIDE"), validateBody(recommendationDecisionSchema), async (request, response) => { const context = auth(request); response.json(success(await service.decide(context.organizationId, context.userId, context.permissions, String(request.params.id), request.body as RecommendationDecisionInput), "Recommendation decision recorded.")); });
