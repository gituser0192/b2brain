import { z } from "zod";

export const organizationServiceAssignmentSchema = z.object({ enabled: z.boolean() }).strict();

export const createPlatformInvitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  organizationName: z.string().trim().min(1, "Organization name is required.").max(120),
}).strict();

export type CreatePlatformInvitationInput = z.infer<typeof createPlatformInvitationSchema>;

export const organizationAccessSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();
export type OrganizationAccessInput = z.infer<typeof organizationAccessSchema>;

export const servicePlanSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable().transform((value) => value || null),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  serviceIds: z.array(z.string().uuid()).max(100),
}).strict();
export type ServicePlanInput = z.infer<typeof servicePlanSchema>;

export const organizationPlanAssignmentSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(["TRIAL", "ACTIVE", "CANCELED"]),
  startsAt: z.string().datetime().transform((value) => new Date(value)),
  trialEndsAt: z.string().datetime().optional().nullable().transform((value) => value ? new Date(value) : null),
  expiresAt: z.string().datetime().optional().nullable().transform((value) => value ? new Date(value) : null),
  additionalServiceIds: z.array(z.string().uuid()).max(100).default([]),
  removedServiceIds: z.array(z.string().uuid()).max(100).default([]),
}).strict().superRefine((value, context) => {
  if (value.status === "TRIAL" && !value.trialEndsAt) context.addIssue({ code: "custom", path: ["trialEndsAt"], message: "Trial end date is required." });
  if (value.trialEndsAt && value.trialEndsAt <= value.startsAt) context.addIssue({ code: "custom", path: ["trialEndsAt"], message: "Trial end date must be after the start date." });
  if (value.expiresAt && value.expiresAt <= value.startsAt) context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry date must be after the start date." });
  const removed = new Set(value.removedServiceIds);
  if (value.additionalServiceIds.some((id) => removed.has(id))) context.addIssue({ code: "custom", path: ["additionalServiceIds"], message: "A service cannot be both added and removed." });
});
export type OrganizationPlanAssignmentInput = z.infer<typeof organizationPlanAssignmentSchema>;
