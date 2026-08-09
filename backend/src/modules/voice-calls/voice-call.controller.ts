import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { VoiceCallService } from "./voice-call.service.js";
import type { CreateVoiceCallInput } from "./voice-call.validation.js";

const service = new VoiceCallService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid record ID is required.", "INVALID_RECORD_ID"); return value; }
export const listVoiceCalls: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.list(context.organizationId))); };
export const createVoiceCall: RequestHandler = async (request, response) => { const context = auth(request); response.status(201).json(success(await service.create(context.organizationId, context.userId, request.body as CreateVoiceCallInput), "Voice call prepared for approval.")); };
export const cancelVoiceCall: RequestHandler = async (request, response) => { const context = auth(request); await service.cancel(context.organizationId, context.userId, id(request.params.id)); response.json(success({}, "Voice call canceled.")); };
