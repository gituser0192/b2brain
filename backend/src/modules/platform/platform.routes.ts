import { Router } from "express";
import { requireActiveContext, requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { assignOrganizationPlan, createServicePlan, inviteOrganization, platformOverview, recordSubscriptionPayment, removeOrganization, revokeOrganizationInvitation, setOrganizationAccess, setOrganizationService, updateServicePlan } from "./platform.controller.js";
import { createPlatformInvitationSchema, organizationAccessSchema, organizationPlanAssignmentSchema, organizationServiceAssignmentSchema, servicePlanSchema, subscriptionPaymentSchema } from "./platform.validation.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireActiveContext, requirePlatformAdmin);
platformRouter.get("/overview", platformOverview);
platformRouter.post("/plans", validateBody(servicePlanSchema), createServicePlan);
platformRouter.put("/plans/:id", validateBody(servicePlanSchema), updateServicePlan);
platformRouter.post("/invitations", validateBody(createPlatformInvitationSchema), inviteOrganization);
platformRouter.delete("/invitations/:id", revokeOrganizationInvitation);
platformRouter.patch("/organizations/:organizationId/access", validateBody(organizationAccessSchema), setOrganizationAccess);
platformRouter.delete("/organizations/:organizationId", removeOrganization);
platformRouter.put("/organizations/:organizationId/services/:serviceId", validateBody(organizationServiceAssignmentSchema), setOrganizationService);
platformRouter.put("/organizations/:organizationId/plan", validateBody(organizationPlanAssignmentSchema), assignOrganizationPlan);
platformRouter.post("/organizations/:organizationId/subscription-payments", validateBody(subscriptionPaymentSchema), recordSubscriptionPayment);
