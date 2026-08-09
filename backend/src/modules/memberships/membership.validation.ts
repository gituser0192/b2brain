import { z } from "zod";

const assignableRoleCode = z.string().trim().min(1).max(80).regex(/^[A-Z][A-Z0-9_]*$/).refine((value) => value !== "ORGANIZATION_OWNER", "The owner role cannot be assigned.");

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  roleCode: assignableRoleCode,
}).strict();

export const acceptInvitationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().max(80).optional().transform((value) => value || undefined),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/, "Password must include a letter.").regex(/\d/, "Password must include a number."),
}).strict();

export const updateMembershipSchema = z.object({
  roleCode: assignableRoleCode.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a role or status.");

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
