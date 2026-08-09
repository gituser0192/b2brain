import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { AgentService } from "./agent.service.js";
import type { AgentInput } from "./agent.validation.js";
const service = new AgentService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid agent ID is required.", "INVALID_AGENT_ID"); return value; }
export const listAgents: RequestHandler = async (request, response) => { response.json(success(await service.list(auth(request).organizationId))); };
export const getAgent: RequestHandler = async (request, response) => { response.json(success(await service.get(auth(request).organizationId, id(request.params.id)))); };
export const createAgent: RequestHandler = async (request, response) => { const context = auth(request); response.status(201).json(success(await service.create(context.organizationId, context.userId, request.body as AgentInput), "Agent created.")); };
export const updateAgent: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.update(context.organizationId, context.userId, id(request.params.id), request.body as AgentInput), "Agent updated.")); };
export const archiveAgent: RequestHandler = async (request, response) => { const context = auth(request); await service.archive(context.organizationId, context.userId, id(request.params.id)); response.json(success({}, "Agent archived.")); };
export const listAgentRuns: RequestHandler = async (request, response) => { response.json(success(await service.runs(auth(request).organizationId, id(request.params.id)))); };
