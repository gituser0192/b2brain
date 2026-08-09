import { Router } from "express";
import { requireActiveContext, requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { inviteOrganization, platformOverview, removeOrganization, revokeOrganizationInvitation, setOrganizationAccess, setOrganizationService } from "./platform.controller.js";
import { createPlatformInvitationSchema, organizationAccessSchema, organizationServiceAssignmentSchema } from "./platform.validation.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireActiveContext, requirePlatformAdmin);
platformRouter.get("/overview", platformOverview);
platformRouter.post("/invitations", validateBody(createPlatformInvitationSchema), inviteOrganization);
platformRouter.delete("/invitations/:id", revokeOrganizationInvitation);
platformRouter.patch("/organizations/:organizationId/access", validateBody(organizationAccessSchema), setOrganizationAccess);
platformRouter.delete("/organizations/:organizationId", removeOrganization);
platformRouter.put("/organizations/:organizationId/services/:serviceId", validateBody(organizationServiceAssignmentSchema), setOrganizationService);
