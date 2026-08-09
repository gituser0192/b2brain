import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { RoleService } from "./role.service.js";
import type { CreateRoleInput, UpdateRoleInput } from "./role.validation.js";

const service = new RoleService();
function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  return request.auth;
}
function id(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }

export const listRoles: RequestHandler = async (request, response) => {
  response.json(success(await service.list(context(request).organizationId)));
};
export const createRole: RequestHandler = async (request, response) => {
  const auth = context(request);
  response.status(201).json(success(await service.create(auth.organizationId, auth.permissions, request.body as CreateRoleInput), "Role created."));
};
export const updateRole: RequestHandler = async (request, response) => {
  const auth = context(request);
  response.json(success(await service.update(auth.organizationId, auth.permissions, id(request.params.id), request.body as UpdateRoleInput), "Role updated."));
};
export const deleteRole: RequestHandler = async (request, response) => {
  await service.remove(context(request).organizationId, id(request.params.id));
  response.json(success({}, "Role deleted."));
};
