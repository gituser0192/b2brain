import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { EngagementService } from "./engagement.service.js";
import { listFollowUpsQuerySchema, type CreateActivityInput, type CreateFollowUpInput, type UpdateFollowUpStatusInput } from "./engagement.validation.js";

const service = new EngagementService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid record ID is required.", "INVALID_RECORD_ID"); return value; }
export const timeline: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.timeline(context.organizationId, id(request.params.customerId)))); };
export const followUpCenter: RequestHandler = async (request, response) => { const context = auth(request); const query = listFollowUpsQuerySchema.parse(request.query); response.json(success(await service.followUpCenter(context.organizationId, context.userId, query))); };
export const createActivity: RequestHandler = async (request, response) => { const context = auth(request); response.status(201).json(success(await service.createActivity(context.organizationId, id(request.params.customerId), context.userId, request.body as CreateActivityInput), "Activity logged.")); };
export const archiveActivity: RequestHandler = async (request, response) => { const context = auth(request); await service.archiveActivity(context.organizationId, id(request.params.customerId), context.userId, id(request.params.activityId)); response.json(success({}, "Activity archived.")); };
export const createFollowUp: RequestHandler = async (request, response) => { const context = auth(request); response.status(201).json(success(await service.createFollowUp(context.organizationId, id(request.params.customerId), context.userId, request.body as CreateFollowUpInput), "Follow-up scheduled.")); };
export const updateFollowUpStatus: RequestHandler = async (request, response) => { const context = auth(request); await service.updateFollowUpStatus(context.organizationId, id(request.params.customerId), context.userId, id(request.params.followUpId), request.body as UpdateFollowUpStatusInput); response.json(success({}, "Follow-up updated.")); };
export const archiveFollowUp: RequestHandler = async (request, response) => { const context = auth(request); await service.archiveFollowUp(context.organizationId, id(request.params.customerId), context.userId, id(request.params.followUpId)); response.json(success({}, "Follow-up archived.")); };
