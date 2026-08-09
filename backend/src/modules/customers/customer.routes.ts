import { Router } from "express";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { archiveCustomer, createCustomer, getCustomer, listCustomers, permanentlyDeleteCustomer, restoreCustomer, updateCustomer } from "./customer.controller.js";
import { createCustomerSchema, updateCustomerSchema } from "./customer.validation.js";

export const customerRouter = Router();
customerRouter.use(requireAuth, requireActiveContext, requireEnabledService("CRM"));
customerRouter.get("/", requirePermission("CRM_VIEW"), listCustomers);
customerRouter.get("/:id", requirePermission("CRM_VIEW"), getCustomer);
customerRouter.post("/", requirePermission("CRM_CREATE"), validateBody(createCustomerSchema), createCustomer);
customerRouter.put("/:id", requirePermission("CRM_UPDATE"), validateBody(updateCustomerSchema), updateCustomer);
customerRouter.delete("/:id", requirePermission("CRM_ARCHIVE"), archiveCustomer);
customerRouter.post("/:id/restore", requirePermission("CRM_ARCHIVE"), restoreCustomer);
customerRouter.delete("/:id/permanent", requirePermission("CRM_DELETE"), permanentlyDeleteCustomer);
