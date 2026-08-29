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
import { WorkspaceAgentProactiveService } from "./workspace-agent.proactive.service.js";
import {
  businessGoalSchema,
  type BusinessGoalInput,
} from "./workspace-agent.proactive.validation.js";

const router = Router(),
  service = new WorkspaceAgentService(),
  proactive = new WorkspaceAgentProactiveService();
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
  async (request, response) => {
    const context = auth(request),
      input = request.body as WorkspaceAgentMessage;
    try {
      response.status(202).json(success(await service.message(context, input)));
    } catch (error) {
      await service.markFailed(context, input.externalMessageId);
      throw error;
    }
  },
);
router.get("/conversations/:id", async (request, response) =>
  response.json(
    success(await service.history(auth(request), String(request.params.id))),
  ),
);
router.get("/brief", async (request, response) =>
  response.json(success(await proactive.brief(auth(request)))),
);
router.get("/goals", async (request, response) =>
  response.json(success(await proactive.goals(auth(request)))),
);
router.get("/usage", async (request, response) =>
  response.json(success(await service.usage(auth(request)))),
);
router.post(
  "/goals",
  validateBody(businessGoalSchema),
  async (request, response) =>
    response
      .status(201)
      .json(
        success(
          await proactive.createGoal(
            auth(request),
            request.body as BusinessGoalInput,
          ),
          "Goal created.",
        ),
      ),
);
router.delete("/goals/:id", async (request, response) => {
  await proactive.archiveGoal(auth(request), String(request.params.id));
  response.json(success(null, "Goal archived."));
});
export { router as workspaceAgentRouter };
