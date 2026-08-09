import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { OrganizationService } from "./organization.service.js";
import type { UpdateOrganizationInput } from "./organization.validation.js";

const service = new OrganizationService();

export const currentOrganization: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.json(success(await service.current(request.auth.organizationId)));
};

export const updateCurrentOrganization: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.json(success(await service.update(request.auth.organizationId, request.body as UpdateOrganizationInput), "Organization updated."));
};
