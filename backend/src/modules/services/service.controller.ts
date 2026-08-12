import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { ServiceCatalogueService } from "./service.service.js";

const service = new ServiceCatalogueService();

export const serviceContext: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.json(success(await service.context(request.auth.organizationId)));
};

export const enabledServices: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.json(success(await service.enabled(request.auth.organizationId, request.auth.membershipId, request.auth.roleCode)));
};
