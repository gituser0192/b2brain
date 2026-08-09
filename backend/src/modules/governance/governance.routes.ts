import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js"; import { success } from "../../shared/responses/api-response.js";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js"; import { validateBody } from "../../middleware/validate.js";
import { GovernanceService } from "./governance.service.js"; import { approvalQuerySchema, auditQuerySchema, decisionSchema, type DecisionInput } from "./governance.validation.js";
const service=new GovernanceService(); function auth(request:Parameters<RequestHandler>[0]){if(!request.auth)throw new AppError(401,"Authentication is required.","UNAUTHENTICATED");return request.auth}
export const governanceRouter=Router(); governanceRouter.use(requireAuth,requireActiveContext,requireEnabledService("GOVERNANCE"));
governanceRouter.get("/approvals",requirePermission("APPROVAL_VIEW"),async(request,response)=>{const context=auth(request);response.json(success(await service.approvals(context.organizationId,approvalQuerySchema.parse(request.query))))});
governanceRouter.post("/approvals/:id/decision",requirePermission("APPROVAL_DECIDE"),validateBody(decisionSchema),async(request,response)=>{const context=auth(request);response.json(success(await service.decide(context.organizationId,context.userId,String(request.params.id),request.body as DecisionInput),"Approval decision recorded."))});
governanceRouter.get("/audit",requirePermission("AUDIT_VIEW"),async(request,response)=>{const context=auth(request);response.json(success(await service.audit(context.organizationId,auditQuerySchema.parse(request.query))))});
