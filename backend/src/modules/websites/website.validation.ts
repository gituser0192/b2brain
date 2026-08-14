import { z } from "zod";
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);
const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null);
const date = z
  .string()
  .datetime()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));
export const websiteSchema = z
  .object({
    customerId: z.string().uuid().optional().nullable(),
    assignedEmployeeId: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2).max(160),
    domain: z
      .string()
      .trim()
      .min(3)
      .max(253)
      .transform((value) =>
        value
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, ""),
      ),
    platform: z.enum(["WORDPRESS", "SHOPIFY", "WIX", "CUSTOM", "OTHER"]),
    status: z.enum(["ACTIVE", "MAINTENANCE", "PAUSED", "DISCONNECTED"]),
    adminUrl: optionalUrl,
    repositoryUrl: optionalUrl,
    hostingProvider: optional(120),
    notes: optional(4000),
  })
  .strict();
export const requestSchema = z
  .object({
    websiteId: z.string().uuid(),
    projectId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(2).max(10000),
    type: z.enum([
      "BANNER",
      "CONTENT",
      "PRODUCT",
      "BUG_FIX",
      "SEO",
      "NEW_PAGE",
      "DESIGN",
      "OTHER",
    ]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    status: z.enum([
      "REQUESTED",
      "CLARIFICATION",
      "PLANNED",
      "IN_PROGRESS",
      "AWAITING_APPROVAL",
      "REJECTED",
      "CANCELED",
    ]),
    deadline: date,
  })
  .strict();
export const approvalSchema = z
  .object({ approved: z.boolean(), notes: optional(2000) })
  .strict();
export const providerSubmissionSchema = z
  .object({ confirmation: z.literal(true) })
  .strict();
export const deploymentSchema = z
  .object({
    requestId: z.string().uuid(),
    environment: z.enum(["PREVIEW", "STAGING", "PRODUCTION"]),
    status: z.enum([
      "PLANNED",
      "IN_PROGRESS",
      "SUCCEEDED",
      "FAILED",
      "ROLLED_BACK",
    ]),
    version: optional(100),
    deploymentUrl: optionalUrl,
    summary: z.string().trim().min(2).max(4000),
    verification: optional(4000),
    rollbackPlan: optional(4000),
    failureReason: optional(4000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "FAILED" && !value.failureReason)
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "Add a failure reason.",
      });
    if (value.environment === "PRODUCTION" && !value.rollbackPlan)
      context.addIssue({
        code: "custom",
        path: ["rollbackPlan"],
        message: "Production deployments require a rollback plan.",
      });
  });
export type WebsiteInput = z.infer<typeof websiteSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type DeploymentInput = z.infer<typeof deploymentSchema>;
