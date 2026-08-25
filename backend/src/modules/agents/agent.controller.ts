import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { AgentService } from "./agent.service.js";
import type { AgentInput, AgentScheduleInput, LeadAgentPreviewInput } from "./agent.validation.js";
interface BenchmarkBody { iterations: number }
interface CollectionBody { invoiceId: string | null }
import { AgentScheduleService } from "./agent-schedule.service.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
const service = new AgentService();
const schedules = new AgentScheduleService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid agent ID is required.", "INVALID_AGENT_ID"); return value; }
export const listAgents: RequestHandler = async (request, response) => { response.json(success(await service.list(auth(request).organizationId))); };
export const getAgent: RequestHandler = async (request, response) => { response.json(success(await service.get(auth(request).organizationId, id(request.params.id)))); };
export const createAgent: RequestHandler = async (request, response) => { const context = auth(request); response.status(201).json(success(await service.create(context.organizationId, context.userId, request.body as AgentInput), "Agent created.")); };
export const updateAgent: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.update(context.organizationId, context.userId, id(request.params.id), request.body as AgentInput), "Agent updated.")); };
export const archiveAgent: RequestHandler = async (request, response) => { const context = auth(request); await service.archive(context.organizationId, context.userId, id(request.params.id)); response.json(success({}, "Agent archived.")); };
export const listAgentRuns: RequestHandler = async (request, response) => { response.json(success(await service.runs(auth(request).organizationId, id(request.params.id)))); };
export const listAgentRunCentre: RequestHandler = async (request, response) => { response.json(success(await service.runCentre(auth(request).organizationId))); };
export const previewLeadAgent: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.previewLead(context.organizationId, context.userId, id(request.params.id), request.body as LeadAgentPreviewInput), "Agent preview completed without external delivery.")); };
export const benchmarkAgent: RequestHandler = async (request, response) => { const context = auth(request), body = request.body as BenchmarkBody; response.json(success(await service.benchmark(context.organizationId, id(request.params.id), body.iterations), "Agent benchmark completed.")); };
export const previewCollectionAgent: RequestHandler = async (request, response) => { const context = auth(request), body = request.body as CollectionBody; response.json(success(await service.previewCollection(context.organizationId, context.userId, id(request.params.id), String(body.invoiceId)), "Collection preview completed without contact or payment changes.")); };
export const runCollectionAgent: RequestHandler = async (request, response) => { const context = auth(request), body = request.body as CollectionBody; await verifyServiceAccess(context, "FINANCE", "FINANCE_MANAGE"); response.json(success(await service.runCollection(context.organizationId, context.userId, id(request.params.id), body.invoiceId), "Collection agent run completed safely.")); };
export const getAgentSchedule: RequestHandler = async (request, response) => { const context = auth(request); await verifyServiceAccess(context, "FINANCE", "FINANCE_VIEW"); response.json(success(await schedules.get(context.organizationId, id(request.params.id)))); };
export const saveAgentSchedule: RequestHandler = async (request, response) => { const context = auth(request); await verifyServiceAccess(context, "FINANCE", "FINANCE_MANAGE"); response.json(success(await schedules.save(context.organizationId, context.userId, id(request.params.id), request.body as AgentScheduleInput), "Collection schedule saved.")); };
