import { Router, type RequestHandler } from "express";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { AutomationPolicyService } from "./automation-policy.service.js";
import { automationPolicySchema, simulatePolicySchema, type AutomationPolicyInput, type SimulatePolicyInput } from "./automation-policy.validation.js";

const service = new AutomationPolicyService();
const auth = (request: Parameters<RequestHandler>[0]) => { if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED"); return request.auth; };
export const automationPolicyRouter = Router();
automationPolicyRouter.use(requireAuth, requireActiveContext, requireEnabledService("AUTOMATION"));
automationPolicyRouter.get("/", requirePermission("AUTOMATION_VIEW"), async (request, response) => response.json(success(await service.overview(auth(request).organizationId))));
automationPolicyRouter.post("/", requirePermission("AUTOMATION_MANAGE"), validateBody(automationPolicySchema), async (request, response) => { const context = auth(request); response.status(201).json(success(await service.save(context.organizationId, context.userId, null, request.body as AutomationPolicyInput), "Automation policy created.")); });
automationPolicyRouter.put("/:id", requirePermission("AUTOMATION_MANAGE"), validateBody(automationPolicySchema), async (request, response) => { const context = auth(request); response.json(success(await service.save(context.organizationId, context.userId, String(request.params.id), request.body as AutomationPolicyInput), "Automation policy updated.")); });
automationPolicyRouter.delete("/:id", requirePermission("AUTOMATION_MANAGE"), async (request, response) => { const context = auth(request); await service.archive(context.organizationId, context.userId, String(request.params.id)); response.json(success({}, "Automation policy archived.")); });
automationPolicyRouter.post("/simulate/event", requirePermission("AUTOMATION_MANAGE"), validateBody(simulatePolicySchema), async (request, response) => { const context = auth(request); response.json(success(await service.evaluate(context.organizationId, context.userId, request.body as SimulatePolicyInput), "Policy simulation completed.")); });
