import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import {
  messageDraftSchema,
  whatsappCredentialsSchema,
  whatsappEscalationSchema,
  whatsappTemplateDraftSchema,
  type MessageDraftInput,
  type WhatsappCredentialsInput,
  type WhatsappEscalationInput,
  type WhatsappTemplateDraftInput,
} from "./bridge.validation.js";
import { WhatsappService } from "./whatsapp.service.js";

const service = new WhatsappService();
const auth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};
const inquiryAccess = [requireEnabledService("LEADS"), requirePermission("INQUIRY_VIEW"), requireEnabledService("AUTOMATION")] as const;

export const whatsappWebhookRouter = Router();
whatsappWebhookRouter.get("/:webhookKey", async (request, response) => {
  const challenge = await service.verify(String(request.params.webhookKey), request.query["hub.mode"], request.query["hub.verify_token"], request.query["hub.challenge"]);
  response.status(200).type("text/plain").send(challenge);
});
whatsappWebhookRouter.post("/:webhookKey", async (request, response) => {
  const raw = (request as typeof request & { rawBody?: Buffer }).rawBody;
  const data = await service.receive(String(request.params.webhookKey), raw, request.header("x-hub-signature-256"), request.body as object);
  response.status(200).json(success(data, "Webhook accepted."));
});

export const whatsappAdminRouter = Router();
whatsappAdminRouter.use(requireAuth, requireActiveContext, requireEnabledService("AUTOMATION"));
whatsappAdminRouter.put("/connectors/:id/whatsapp-credentials", requirePermission("AUTOMATION_MANAGE"), validateBody(whatsappCredentialsSchema), async (request, response) => {
  const context = auth(request);
  response.json(success(await service.credentials(context.organizationId, context.userId, String(request.params.id), request.body as WhatsappCredentialsInput), "WhatsApp credentials encrypted and saved."));
});
whatsappAdminRouter.get("/message-drafts", requirePermission("AUTOMATION_VIEW"), async (request, response) =>
  response.json(success(await service.drafts(auth(request).organizationId))));
whatsappAdminRouter.get("/whatsapp-workspace", ...inquiryAccess, requirePermission("AUTOMATION_VIEW"), async (request, response) =>
  response.json(success(await service.workspace(auth(request).organizationId))));
whatsappAdminRouter.post("/connectors/:id/message-drafts", requirePermission("AUTOMATION_MANAGE"), validateBody(messageDraftSchema), async (request, response) => {
  const context = auth(request);
  response.status(201).json(success(await service.draft(context.organizationId, context.userId, String(request.params.id), request.body as MessageDraftInput), "Reply draft created for approval."));
});
whatsappAdminRouter.post("/whatsapp-template-drafts", ...inquiryAccess, requirePermission("AUTOMATION_MANAGE"), validateBody(whatsappTemplateDraftSchema), async (request, response) => {
  const context = auth(request);
  response.status(201).json(success(await service.templateDraft(context.organizationId, context.userId, request.body as WhatsappTemplateDraftInput), "WhatsApp template draft created for approval."));
});
whatsappAdminRouter.post("/whatsapp-escalations", ...inquiryAccess, requirePermission("AUTOMATION_MANAGE"), validateBody(whatsappEscalationSchema), async (request, response) => {
  const context = auth(request);
  response.status(201).json(success(await service.escalate(context.organizationId, context.userId, request.body as WhatsappEscalationInput), "Conversation escalated to a human."));
});
whatsappAdminRouter.post("/message-drafts/:id/approve-send", requirePermission("AUTOMATION_MANAGE"), async (request, response) => {
  const context = auth(request);
  response.json(success(await service.approveAndSend(context.organizationId, context.userId, String(request.params.id)), "WhatsApp reply sent."));
});
