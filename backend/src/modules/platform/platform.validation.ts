import { z } from "zod";

export const organizationServiceAssignmentSchema = z.object({ enabled: z.boolean() }).strict();

export const createPlatformInvitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  organizationName: z.string().trim().min(1, "Organization name is required.").max(120),
}).strict();

export type CreatePlatformInvitationInput = z.infer<typeof createPlatformInvitationSchema>;

export const organizationAccessSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();
export type OrganizationAccessInput = z.infer<typeof organizationAccessSchema>;
