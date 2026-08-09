import { Router } from "express";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { archiveActivity, archiveFollowUp, createActivity, createFollowUp, followUpCenter, timeline, updateFollowUpStatus } from "./engagement.controller.js";
import { createActivitySchema, createFollowUpSchema, updateFollowUpStatusSchema } from "./engagement.validation.js";

export const engagementRouter = Router({ mergeParams: true });
engagementRouter.use(requireAuth, requireActiveContext, requireEnabledService("CRM"));
engagementRouter.get("/", requirePermission("CRM_ACTIVITY_VIEW"), timeline);
engagementRouter.post("/activities", requirePermission("CRM_ACTIVITY_MANAGE"), validateBody(createActivitySchema), createActivity);
engagementRouter.delete("/activities/:activityId", requirePermission("CRM_ACTIVITY_MANAGE"), archiveActivity);
engagementRouter.post("/follow-ups", requirePermission("CRM_FOLLOWUP_MANAGE"), validateBody(createFollowUpSchema), createFollowUp);
engagementRouter.patch("/follow-ups/:followUpId", requirePermission("CRM_FOLLOWUP_MANAGE"), validateBody(updateFollowUpStatusSchema), updateFollowUpStatus);
engagementRouter.delete("/follow-ups/:followUpId", requirePermission("CRM_FOLLOWUP_MANAGE"), archiveFollowUp);

export const crmEngagementRouter = Router();
crmEngagementRouter.use(requireAuth, requireActiveContext, requireEnabledService("CRM"));
crmEngagementRouter.get("/follow-ups", requirePermission("CRM_ACTIVITY_VIEW"), followUpCenter);
