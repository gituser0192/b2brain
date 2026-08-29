import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { WorkspaceAgentService } from "./workspace-agent.service.js";
import {
  workspaceAgentMessageSchema,
  type WorkspaceAgentMessage,
} from "./workspace-agent.validation.js";

const router = Router(),
  service = new WorkspaceAgentService();
const auth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};
router.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("B2BRAIN_AGENT"),
);
router.post(
  "/messages",
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  validateBody(workspaceAgentMessageSchema),
  async (request, response) =>
    response
      .status(202)
      .json(
        success(
          await service.message(
            auth(request),
            request.body as WorkspaceAgentMessage,
          ),
        ),
      ),
);
router.get("/conversations/:id", async (request, response) =>
  response.json(
    success(await service.history(auth(request), String(request.params.id))),
  ),
);
export { router as workspaceAgentRouter };
