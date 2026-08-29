import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { EnquiryAgentService } from "./enquiry-agent.service.js";
import {
  agentDraftDecisionSchema,
  humanTakeoverSchema,
  normalizedInboundMessageSchema,
  type AgentDraftDecision,
  type HumanTakeoverInput,
  type NormalizedInboundMessage,
} from "./enquiry-agent.validation.js";

const router = Router(),
  service = new EnquiryAgentService();
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many agent requests. Try again shortly.",
    code: "RATE_LIMITED",
  },
});
const context = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};
router.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("AUTOMATION"),
);
router.get(
  "/status",
  requirePermission("AUTOMATION_VIEW"),
  (_request, response) => response.json(success(service.status())),
);
router.post(
  "/messages",
  limiter,
  requireEnabledService("LEADS"),
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(normalizedInboundMessageSchema),
  async (request, response) => {
    const auth = context(request);
    response
      .status(202)
      .json(
        success(
          await service.process(
            auth.organizationId,
            auth.userId,
            request.body as NormalizedInboundMessage,
          ),
          "Agent message processed.",
        ),
      );
  },
);
router.get(
  "/conversations",
  requirePermission("AUTOMATION_VIEW"),
  async (request, response) =>
    response.json(
      success(await service.conversations(context(request).organizationId)),
    ),
);
router.get(
  "/conversations/:id",
  requirePermission("AUTOMATION_VIEW"),
  async (request, response) =>
    response.json(
      success(
        await service.history(
          context(request).organizationId,
          String(request.params.id),
        ),
      ),
    ),
);
router.put(
  "/conversations/:id/read",
  requirePermission("AUTOMATION_VIEW"),
  async (request, response) => {
    const auth = context(request);
    response.json(
      success(
        await service.markConversationRead(
          auth.organizationId,
          auth.userId,
          String(request.params.id),
        ),
      ),
    );
  },
);
router.post(
  "/drafts/:id/decision",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(agentDraftDecisionSchema),
  async (request, response) => {
    const auth = context(request);
    response.json(
      success(
        await service.decideDraft(
          auth.organizationId,
          auth.userId,
          String(request.params.id),
          request.body as AgentDraftDecision,
        ),
        "Draft decision recorded.",
      ),
    );
  },
);
router.put(
  "/takeover",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(humanTakeoverSchema),
  async (request, response) => {
    const auth = context(request);
    response.json(
      success(
        await service.takeover(
          auth.organizationId,
          auth.userId,
          request.body as HumanTakeoverInput,
        ),
        "Conversation control updated.",
      ),
    );
  },
);
export { router as enquiryAgentRouter };
