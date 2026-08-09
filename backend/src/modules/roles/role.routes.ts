import { Router } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { createRole, deleteRole, listRoles, updateRole } from "./role.controller.js";
import { createRoleSchema, updateRoleSchema } from "./role.validation.js";

export const roleRouter = Router();
roleRouter.use(requireAuth, requireActiveContext);
roleRouter.get("/", requirePermission("ROLE_VIEW"), listRoles);
roleRouter.post("/", requirePermission("ROLE_MANAGE"), validateBody(createRoleSchema), createRole);
roleRouter.patch("/:id", requirePermission("ROLE_MANAGE"), validateBody(updateRoleSchema), updateRole);
roleRouter.delete("/:id", requirePermission("ROLE_MANAGE"), deleteRole);
