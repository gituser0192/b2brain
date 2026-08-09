import { Router } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { acceptInvitation, inviteMember, listMemberships, removeMembership, revokeInvitation, updateMembership } from "./membership.controller.js";
import { acceptInvitationSchema, inviteMemberSchema, updateMembershipSchema } from "./membership.validation.js";

export const membershipRouter = Router();

membershipRouter.post("/invitations/accept", validateBody(acceptInvitationSchema), acceptInvitation);
membershipRouter.use(requireAuth, requireActiveContext);
membershipRouter.get("/", requirePermission("MEMBERSHIP_VIEW"), listMemberships);
membershipRouter.post("/invitations", requirePermission("MEMBERSHIP_MANAGE"), validateBody(inviteMemberSchema), inviteMember);
membershipRouter.delete("/invitations/:id", requirePermission("MEMBERSHIP_MANAGE"), revokeInvitation);
membershipRouter.patch("/:id", requirePermission("MEMBERSHIP_MANAGE"), validateBody(updateMembershipSchema), updateMembership);
membershipRouter.delete("/:id", requirePermission("MEMBERSHIP_MANAGE"), removeMembership);
