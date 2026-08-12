import { Router } from "express";
import { requireActiveContext, requireAuth, requireOrganizationOwner, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { acceptInvitation, inviteMember, listMemberships, removeMembership, revokeInvitation, updateMembership, updateMemberServices } from "./membership.controller.js";
import { acceptInvitationSchema, inviteMemberSchema, updateMembershipSchema, updateMemberServicesSchema } from "./membership.validation.js";

export const membershipRouter = Router();

membershipRouter.post("/invitations/accept", validateBody(acceptInvitationSchema), acceptInvitation);
membershipRouter.use(requireAuth, requireActiveContext);
membershipRouter.get("/", requireOrganizationOwner, requirePermission("MEMBERSHIP_VIEW"), listMemberships);
membershipRouter.post("/invitations", requireOrganizationOwner, requirePermission("MEMBERSHIP_MANAGE"), validateBody(inviteMemberSchema), inviteMember);
membershipRouter.delete("/invitations/:id", requireOrganizationOwner, requirePermission("MEMBERSHIP_MANAGE"), revokeInvitation);
membershipRouter.patch("/:id", requireOrganizationOwner, requirePermission("MEMBERSHIP_MANAGE"), validateBody(updateMembershipSchema), updateMembership);
membershipRouter.put("/:id/services", requireOrganizationOwner, requirePermission("MEMBERSHIP_MANAGE"), validateBody(updateMemberServicesSchema), updateMemberServices);
membershipRouter.delete("/:id", requireOrganizationOwner, requirePermission("MEMBERSHIP_MANAGE"), removeMembership);
