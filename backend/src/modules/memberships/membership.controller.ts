import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { MembershipService } from "./membership.service.js";
import type { AcceptInvitationInput, InviteMemberInput, UpdateMembershipInput, UpdateMemberServicesInput } from "./membership.validation.js";

const service = new MembershipService();
function auth(request: Parameters<RequestHandler>[0]) {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  return request.auth;
}
function routeId(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }

export const listMemberships: RequestHandler = async (request, response) => {
  response.json(success(await service.list(auth(request).organizationId)));
};
export const inviteMember: RequestHandler = async (request, response) => {
  const context = auth(request);
  response.status(201).json(success(await service.invite(context.organizationId, context.userId, request.body as InviteMemberInput), "Invitation created."));
};
export const acceptInvitation: RequestHandler = async (request, response) => {
  const token = typeof request.query.token === "string" ? request.query.token : "";
  if (!token) throw new AppError(400, "Invitation token is required.", "INVITATION_TOKEN_REQUIRED");
  response.status(201).json(success(await service.accept(token, request.body as AcceptInvitationInput), "Invitation accepted. You can now sign in."));
};
export const updateMembership: RequestHandler = async (request, response) => {
  const context = auth(request);
  response.json(success(await service.update(context.organizationId, context.membershipId, routeId(request.params.id), request.body as UpdateMembershipInput), "Membership updated."));
};
export const removeMembership: RequestHandler = async (request, response) => {
  const context = auth(request);
  await service.remove(context.organizationId, context.membershipId, routeId(request.params.id));
  response.json(success({}, "Member removed."));
};
export const revokeInvitation: RequestHandler = async (request, response) => {
  await service.revokeInvitation(auth(request).organizationId, routeId(request.params.id));
  response.json(success({}, "Invitation revoked."));
};
export const updateMemberServices: RequestHandler = async (request, response) => {
  const context = auth(request);
  response.json(success(await service.updateServices(context.organizationId, context.userId, routeId(request.params.id), request.body as UpdateMemberServicesInput), "Member service access updated."));
};
