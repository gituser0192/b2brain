import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { PlatformService } from "./platform.service.js";
import type { CreatePlatformInvitationInput } from "./platform.validation.js";
import type { OrganizationAccessInput } from "./platform.validation.js";

const service = new PlatformService();
function id(value: string | string[] | undefined) {
  if (typeof value !== "string") throw new AppError(400, "A valid record ID is required.", "INVALID_RECORD_ID");
  return value;
}

export const platformOverview: RequestHandler = async (_request, response) => {
  response.json(success(await service.overview()));
};

export const setOrganizationService: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  const result = await service.setOrganizationService(id(request.params.organizationId), id(request.params.serviceId), (request.body as { enabled: boolean }).enabled, request.auth.userId);
  response.json(success(result, result.enabled ? "Service enabled for organization." : "Service disabled for organization."));
};

export const inviteOrganization: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.status(201).json(success(await service.inviteOrganization(request.body as CreatePlatformInvitationInput, request.auth.userId), "Organization invitation created."));
};

export const revokeOrganizationInvitation: RequestHandler = async (request, response) => {
  await service.revokeInvitation(id(request.params.id));
  response.json(success({}, "Organization invitation revoked."));
};

export const setOrganizationAccess: RequestHandler = async (request, response) => {
  const result = await service.setOrganizationAccess(id(request.params.organizationId), request.body as OrganizationAccessInput);
  response.json(success(result, result.status === "ACTIVE" ? "Organization login approved." : "Organization access suspended."));
};

export const removeOrganization: RequestHandler = async (request, response) => {
  await service.removeOrganization(id(request.params.organizationId));
  response.json(success({}, "Organization account removed."));
};
