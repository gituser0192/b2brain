import { Router } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { enabledServices, serviceContext } from "./service.controller.js";

export const serviceRouter = Router();
serviceRouter.use(requireAuth, requireActiveContext);
serviceRouter.get("/context", requirePermission("SERVICE_CATALOG_VIEW"), serviceContext);
serviceRouter.get("/enabled", requirePermission("ORGANIZATION_VIEW"), enabledServices);
