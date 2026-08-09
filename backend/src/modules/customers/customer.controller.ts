import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { CustomerService } from "./customer.service.js";
import { listCustomerQuerySchema, type CreateCustomerInput, type UpdateCustomerInput } from "./customer.validation.js";

const service = new CustomerService();
function context(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid customer ID is required.", "INVALID_CUSTOMER_ID"); return value; }

export const listCustomers: RequestHandler = async (request, response) => response.json(success(await service.list(context(request).organizationId, listCustomerQuerySchema.parse(request.query))));
export const getCustomer: RequestHandler = async (request, response) => response.json(success(await service.get(context(request).organizationId, id(request.params.id))));
export const createCustomer: RequestHandler = async (request, response) => { const auth = context(request); response.status(201).json(success(await service.create(auth.organizationId, auth.userId, request.body as CreateCustomerInput), "Customer created.")); };
export const updateCustomer: RequestHandler = async (request, response) => { const auth = context(request); response.json(success(await service.update(auth.organizationId, auth.userId, id(request.params.id), request.body as UpdateCustomerInput), "Customer updated.")); };
export const archiveCustomer: RequestHandler = async (request, response) => { const auth = context(request); await service.archive(auth.organizationId, auth.userId, id(request.params.id)); response.json(success({}, "Customer archived.")); };
export const restoreCustomer: RequestHandler = async (request, response) => { const auth = context(request); await service.restore(auth.organizationId, auth.userId, id(request.params.id)); response.json(success({}, "Customer restored.")); };
export const permanentlyDeleteCustomer: RequestHandler = async (request, response) => { const auth = context(request); await service.permanentlyDelete(auth.organizationId, id(request.params.id)); response.json(success({}, "Customer permanently deleted.")); };
