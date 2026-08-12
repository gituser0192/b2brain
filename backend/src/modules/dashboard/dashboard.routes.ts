import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { success } from "../../shared/responses/api-response.js";
import { DashboardService } from "./dashboard.service.js";
const service=new DashboardService();function auth(request:Parameters<RequestHandler>[0]){if(!request.auth)throw new AppError(401,"Authentication required.","UNAUTHENTICATED");return request.auth}export const dashboardRouter=Router();dashboardRouter.use(requireAuth,requireActiveContext,requirePermission("ORGANIZATION_VIEW"));dashboardRouter.get("/summary",async(request,response)=>{const context=auth(request);const queryDays=request.query.days;const raw=typeof queryDays==="string"?queryDays:"30";const days=raw==="all"?null:[30,90,365].includes(Number(raw))?Number(raw):30;response.json(success(await service.summary(context.organizationId,context.membershipId,context.roleCode,context.permissions,days)))});
