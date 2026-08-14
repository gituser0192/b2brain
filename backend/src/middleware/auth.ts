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
  if (request.auth.serviceAccessMode === "READ_ONLY" && !permission.endsWith("_VIEW")) return next(new AppError(403, "This service is assigned as read only.", "MEMBER_SERVICE_READ_ONLY"));
  next();
};

export const requirePlatformAdmin: RequestHandler = (request, _response, next) => {
  if (!request.auth?.isPlatformAdmin) return next(new AppError(403, "Platform administrator access is required.", "PLATFORM_ADMIN_REQUIRED"));
  next();
};

export const requireProviderPermission = (permission: string): RequestHandler => async (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  if (request.auth.isPlatformAdmin) return next();
  const provider = await prisma.organization.findFirst({ where: { id: request.auth.organizationId, isServiceProvider: true, status: "ACTIVE", deletedAt: null }, select: { id: true } });
  if (!provider || !request.auth.permissions.includes(permission)) return next(new AppError(403, "B² Brain service-desk access is required.", "PROVIDER_ACCESS_REQUIRED"));
  next();
};

export const requireProviderSensitiveCompletion: RequestHandler = (request, _response, next) => {
  const body = request.body as { status?: unknown };
  if (body.status !== "COMPLETED" || request.auth?.isPlatformAdmin || request.auth?.permissions.includes("PROVIDER_SENSITIVE_APPROVE")) return next();
  next(new AppError(403, "Sensitive completion requires B² Brain approval authority.", "PROVIDER_APPROVAL_REQUIRED"));
};

export const requireOrganizationOwner: RequestHandler = (request, _response, next) => {
  if (request.auth?.roleCode !== "ORGANIZATION_OWNER") return next(new AppError(403, "Organization owner access is required.", "ORGANIZATION_OWNER_REQUIRED"));
  next();
};

export async function verifyServiceAccess(context: NonNullable<Express.Request["auth"]>, serviceCode: string, permission?: string) {
  const plan = await prisma.organizationPlan.findUnique({ where: { organizationId: context.organizationId } });
  if (plan) {
    const expired = plan.status === "PAST_DUE" || plan.status === "CANCELED" || plan.status === "EXPIRED" || (plan.status === "TRIAL" && Boolean(plan.trialEndsAt && plan.trialEndsAt <= new Date())) || Boolean(plan.expiresAt && plan.expiresAt <= new Date());
    if (expired) throw new AppError(403, "This organization's service plan has expired.", "SERVICE_PLAN_EXPIRED");
  }
  const enabled = await prisma.organizationService.findFirst({ where: { organizationId: context.organizationId, status: "ENABLED", deletedAt: null, service: { code: serviceCode, status: "ACTIVE", archivedAt: null } }, select: { id: true } });
  if (!enabled) throw new AppError(403, `${serviceCode} is not enabled for this organization.`, "SERVICE_NOT_ENABLED");
  if (permission && !context.permissions.includes(permission)) throw new AppError(403, "You do not have permission to perform this action.", "FORBIDDEN");
  if (context.roleCode === "ORGANIZATION_OWNER") return "READ_WRITE" as const;
  const assigned = await prisma.membershipServiceAccess.findFirst({ where: { organizationId: context.organizationId, membershipId: context.membershipId, service: { code: serviceCode } }, select: { accessMode: true } });
  if (!assigned) throw new AppError(403, `${serviceCode} is not assigned to your account.`, "MEMBER_SERVICE_NOT_ASSIGNED");
  if (permission && assigned.accessMode === "READ_ONLY" && !permission.endsWith("_VIEW")) throw new AppError(403, "This service is assigned as read only.", "MEMBER_SERVICE_READ_ONLY");
  return assigned.accessMode;
}

export const requireEnabledService = (serviceCode: string): RequestHandler => async (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
  try { request.auth.serviceAccessMode = await verifyServiceAccess(request.auth, serviceCode); next(); }
  catch (error) { next(error); }
};
