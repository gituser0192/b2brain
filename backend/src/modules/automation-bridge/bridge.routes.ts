import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { BridgeService } from "./bridge.service.js";
import {
  connectorSchema,
  eventDecisionSchema,
  intakeSchema,
  type ConnectorInput,
  type EventDecisionInput,
  type IntakeInput,
} from "./bridge.validation.js";
const service = new BridgeService(),
  auth = (r: Parameters<RequestHandler>[0]) => {
    if (!r.auth)
      throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
    return r.auth;
  };
export const bridgeRouter = Router();
bridgeRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("AUTOMATION"),
);
bridgeRouter.get("/", requirePermission("AUTOMATION_VIEW"), async (r, s) =>
  s.json(success(await service.list(auth(r).organizationId))),
);
bridgeRouter.post(
  "/connectors",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(connectorSchema),
  async (r, s) => {
    const c = auth(r);
    s.status(201).json(
      success(
        await service.createConnector(
          c.organizationId,
          c.userId,
          r.body as ConnectorInput,
        ),
        "Connector created.",
      ),
    );
  },
);
bridgeRouter.put(
  "/connectors/:id",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(connectorSchema),
  async (r, s) => {
    const c = auth(r);
    s.json(
      success(
        await service.updateConnector(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as ConnectorInput,
        ),
        "Connector updated.",
      ),
    );
  },
);
bridgeRouter.delete(
  "/connectors/:id",
  requirePermission("AUTOMATION_MANAGE"),
  async (r, s) => {
    const c = auth(r);
    await service.archiveConnector(
      c.organizationId,
      c.userId,
      String(r.params.id),
    );
    s.json(success({}, "Connector archived."));
  },
);
bridgeRouter.post(
  "/connectors/:id/test-events",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(intakeSchema),
  async (r, s) => {
    const c = auth(r);
    s.status(202).json(
      success(
        await service.intake(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as IntakeInput,
        ),
        "Event received without automatic business conversion.",
      ),
    );
  },
);
bridgeRouter.post(
  "/events/:id/decision",
  requirePermission("AUTOMATION_MANAGE"),
  validateBody(eventDecisionSchema),
  async (r, s) => {
    const c = auth(r);
    s.json(
      success(
        await service.decide(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as EventDecisionInput,
        ),
        "Decision recorded.",
      ),
    );
  },
);
bridgeRouter.post(
  "/events/:id/retry",
  requirePermission("AUTOMATION_MANAGE"),
  async (r, s) => {
    const c = auth(r);
    s.json(
      success(
        await service.retry(c.organizationId, c.userId, String(r.params.id)),
        "Retry completed.",
      ),
    );
  },
);
