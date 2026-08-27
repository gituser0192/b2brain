import { Router } from "express";
import { requireActiveContext, requireAuth, requireOrganizationOwner, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { completeOnboarding, currentOrganization, updateCurrentOrganization } from "./organization.controller.js";
import { completeOnboardingSchema, updateOrganizationSchema } from "./organization.validation.js";

export const organizationRouter = Router();
organizationRouter.use(requireAuth, requireActiveContext);
organizationRouter.get("/current", requirePermission("ORGANIZATION_VIEW"), currentOrganization);
organizationRouter.patch("/current", requireOrganizationOwner, requirePermission("ORGANIZATION_UPDATE"), validateBody(updateOrganizationSchema), updateCurrentOrganization);
organizationRouter.post("/current/onboarding", requireOrganizationOwner, validateBody(completeOnboardingSchema), completeOnboarding);
