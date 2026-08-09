import { Router } from "express";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { approveVoiceCall, cancelVoiceCall, createVoiceCall, listVoiceCalls } from "./voice-call.controller.js";
import { createVoiceCallSchema } from "./voice-call.validation.js";

export const voiceCallRouter = Router();
voiceCallRouter.use(requireAuth, requireActiveContext, requireEnabledService("CRM"), requireEnabledService("AUTOMATION"));
voiceCallRouter.get("/", requirePermission("AUTOMATION_VIEW"), listVoiceCalls);
voiceCallRouter.post("/", requirePermission("AUTOMATION_MANAGE"), validateBody(createVoiceCallSchema), createVoiceCall);
voiceCallRouter.post("/:id/approve", requirePermission("AUTOMATION_MANAGE"), approveVoiceCall);
voiceCallRouter.post("/:id/cancel", requirePermission("AUTOMATION_MANAGE"), cancelVoiceCall);
