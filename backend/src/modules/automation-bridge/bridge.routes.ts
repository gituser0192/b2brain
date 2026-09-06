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
  collectionEmailDeliverySchema,
  type CollectionEmailDeliveryInput,
  emailDeliveryPolicySchema,
  type EmailDeliveryPolicyInput,
  websiteOrderCapabilitySchema,
  type WebsiteOrderCapabilityInput,
  metaLeadConnectorSchema,
  type MetaLeadConnectorInput,
} from "./bridge.validation.js";
import { EmailDeliveryService } from "./email-delivery.service.js";
import { MetaLeadConnectionService } from "./meta-lead-connection.service.js";
import { metaConnectionCallbackSchema, metaConnectionStartSchema, metaFormSelectionSchema, metaPageSelectionSchema, type MetaConnectionCallbackInput, type MetaConnectionStartInput, type MetaFormSelectionInput, type MetaPageSelectionInput } from "./meta-lead-connection.validation.js";
import rateLimit from "express-rate-limit";
const service = new BridgeService(),
  emailDelivery = new EmailDeliveryService(),
  metaConnection = new MetaLeadConnectionService(),
  auth = (r: Parameters<RequestHandler>[0]) => {
    if (!r.auth)
      throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
    return r.auth;
  };
export const bridgeRouter = Router();
export const bridgeWebhookRouter = Router();
bridgeWebhookRouter.post(
  "/:webhookKey",
  validateBody(intakeSchema),
  async (request, response) => {
    const result = await service.receiveExternal(
      String(request.params.webhookKey),
      request.header("x-b2brain-secret"),
      request.body as IntakeInput,
    );
    response.status(202).json(success(result, "External event accepted."));
  },
);
bridgeRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("AUTOMATION"),
);
bridgeRouter.get("/", requirePermission("AUTOMATION_VIEW"), async (r, s) =>
  s.json(success(await service.list(auth(r).organizationId))),
);
const metaLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Too many Meta setup requests. Try again later.", code: "RATE_LIMITED" } });
const metaContext = (r: Parameters<RequestHandler>[0]) => { const c = auth(r); return { organizationId: c.organizationId, membershipId: c.membershipId, userId: c.userId }; };
bridgeRouter.get("/connectors/:id/meta/status", requirePermission("AUTOMATION_VIEW"), async (r, s) => s.json(success(await metaConnection.status(metaContext(r), String(r.params.id)))));
bridgeRouter.post("/connectors/:id/meta/authorize", metaLimit, requirePermission("AUTOMATION_MANAGE"), validateBody(metaConnectionStartSchema), async (r, s) => s.json(success(await metaConnection.start(metaContext(r), String(r.params.id), r.body as MetaConnectionStartInput))));
bridgeRouter.post("/connectors/:id/meta/callback", metaLimit, requirePermission("AUTOMATION_MANAGE"), validateBody(metaConnectionCallbackSchema), async (r, s) => s.json(success(await metaConnection.callback(metaContext(r), String(r.params.id), r.body as MetaConnectionCallbackInput))));
bridgeRouter.put("/connectors/:id/meta/page", metaLimit, requirePermission("AUTOMATION_MANAGE"), validateBody(metaPageSelectionSchema), async (r, s) => s.json(success(await metaConnection.selectPage(metaContext(r), String(r.params.id), r.body as MetaPageSelectionInput))));
bridgeRouter.put("/connectors/:id/meta/forms", metaLimit, requirePermission("AUTOMATION_MANAGE"), validateBody(metaFormSelectionSchema), async (r, s) => s.json(success(await metaConnection.selectForms(metaContext(r), String(r.params.id), r.body as MetaFormSelectionInput))));
bridgeRouter.post("/connectors/:id/meta/verify", metaLimit, requirePermission("AUTOMATION_MANAGE"), async (r, s) => s.json(success(await metaConnection.verify(metaContext(r), String(r.params.id)))));
bridgeRouter.post("/connectors/:id/meta/test", metaLimit, requirePermission("AUTOMATION_MANAGE"), async (r, s) => s.json(success(await metaConnection.test(metaContext(r), String(r.params.id)))));
bridgeRouter.post("/connectors/:id/meta/activate", metaLimit, requirePermission("AUTOMATION_MANAGE"), async (r, s) => s.json(success(await metaConnection.activate(metaContext(r), String(r.params.id)))));
bridgeRouter.post("/connectors/:id/meta/reconnect", metaLimit, requirePermission("AUTOMATION_MANAGE"), async (r, s) => s.json(success(await metaConnection.reconnect(metaContext(r), String(r.params.id)))));
bridgeRouter.post("/connectors/:id/meta/disconnect", metaLimit, requirePermission("AUTOMATION_MANAGE"), async (r, s) => s.json(success(await metaConnection.disconnect(metaContext(r), String(r.params.id)))));
bridgeRouter.get("/email-deliveries", requirePermission("AUTOMATION_VIEW"), async (r, s) => {
  s.json(success(await emailDelivery.workspace(auth(r).organizationId)));
});
bridgeRouter.post("/email-deliveries/send", requirePermission("AUTOMATION_MANAGE"), validateBody(collectionEmailDeliverySchema), async (r, s) => {
  const c = auth(r);
  s.json(success(await emailDelivery.deliver(c.organizationId, c.userId, r.body as CollectionEmailDeliveryInput), "Approved reminder sent."));
});
bridgeRouter.put("/connectors/:id/email-policy", requirePermission("AUTOMATION_MANAGE"), validateBody(emailDeliveryPolicySchema), async (r, s) => { const c = auth(r); s.json(success(await emailDelivery.savePolicy(c.organizationId, c.userId, String(r.params.id), r.body as EmailDeliveryPolicyInput), "Email delivery policy saved.")); });
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
bridgeRouter.put("/connectors/:id/website-orders", requirePermission("AUTOMATION_MANAGE"), validateBody(websiteOrderCapabilitySchema), async (r, s) => {
  const c = auth(r), input = r.body as WebsiteOrderCapabilityInput;
  s.json(success(await service.configureWebsiteOrders(c.organizationId, c.userId, String(r.params.id), input.enabled), "Website order capability updated."));
});
bridgeRouter.put("/connectors/:id/meta-lead", requirePermission("AUTOMATION_MANAGE"), validateBody(metaLeadConnectorSchema), async (r, s) => {
  const c = auth(r);
  s.json(success(await service.configureMetaLead(c.organizationId, c.userId, String(r.params.id), r.body as MetaLeadConnectorInput), "Meta Lead connector configuration saved for verification."));
});
bridgeRouter.post(
  "/connectors/:id/website-secret/rotate",
  requirePermission("AUTOMATION_MANAGE"),
  async (r, s) => {
    const c = auth(r);
    s.json(success(await service.rotateWebsiteSecret(c.organizationId, c.userId, String(r.params.id)), "Website signing secret rotated."));
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
    const event = await service.intake(
      c.organizationId,
      c.userId,
      String(r.params.id),
      r.body as IntakeInput,
    );
    s.status(202).json(success(event, event.status === "COMPLETED" ? "Event received and routed automatically." : "Event received for approval."));
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
