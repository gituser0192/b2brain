import { Router } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { currentOrganization, updateCurrentOrganization } from "./organization.controller.js";
import { updateOrganizationSchema } from "./organization.validation.js";

export const organizationRouter = Router();
organizationRouter.use(requireAuth, requireActiveContext);
organizationRouter.get("/current", requirePermission("ORGANIZATION_VIEW"), currentOrganization);
organizationRouter.patch("/current", requirePermission("ORGANIZATION_UPDATE"), validateBody(updateOrganizationSchema), updateCurrentOrganization);
