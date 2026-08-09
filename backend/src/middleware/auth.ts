import type { RequestHandler } from "express";
import { AppError } from "../shared/errors/app-error.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";
import { AuthRepository } from "../modules/auth/auth.repository.js";
import { prisma } from "../database/prisma.js";

const repository = new AuthRepository();

export const requireAuth: RequestHandler = (request, _response, next) => {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  try { request.auth = verifyAccessToken(token); next(); }
  catch { next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED")); }
};

export const requireActiveContext: RequestHandler = async (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  const membership = await repository.findActiveContextByMembership(request.auth.membershipId);
  if (!membership || membership.userId !== request.auth.userId || membership.organizationId !== request.auth.organizationId) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  request.auth = {
    userId: membership.userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    roleCode: membership.role.code,
    permissions: membership.role.permissions.map((item) => item.permission.code),
    isPlatformAdmin: membership.user.isPlatformAdmin,
  };
  next();
};

export const requireActiveUser = requireActiveContext;
export const requireActiveOrganization = requireActiveContext;

export const requirePermission = (permission: string): RequestHandler => (request, _response, next) => {
  if (!request.auth?.permissions.includes(permission)) return next(new AppError(403, "You do not have permission to perform this action.", "FORBIDDEN"));
  next();
};

export const requirePlatformAdmin: RequestHandler = (request, _response, next) => {
  if (!request.auth?.isPlatformAdmin) return next(new AppError(403, "Platform administrator access is required.", "PLATFORM_ADMIN_REQUIRED"));
  next();
};

export const requireEnabledService = (serviceCode: string): RequestHandler => async (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  const enabled = await prisma.organizationService.findFirst({
    where: {
      organizationId: request.auth.organizationId,
      status: "ENABLED",
      deletedAt: null,
      service: { code: serviceCode, status: "ACTIVE", archivedAt: null },
    },
    select: { id: true },
  });
  if (!enabled) return next(new AppError(403, `${serviceCode} is not enabled for this organization.`, "SERVICE_NOT_ENABLED"));
  next();
};
