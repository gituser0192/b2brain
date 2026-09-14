import { AppError } from "../../shared/errors/app-error.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import type { RegisteredServiceKey } from "../services/service-maturity.js";

export type WorkspaceAgentContext = Omit<NonNullable<Express.Request["auth"]>, "isPlatformAdmin"> & { isPlatformAdmin?: boolean };
export type AgentAvailability = "VERIFIED" | "NO_DATA" | "UNAVAILABLE" | "FORBIDDEN" | "FAILED";
type WorkspaceAgentCapabilityPolicy = { service: RegisteredServiceKey; permission: string; mode: "READ" | "WRITE"; confirmation: boolean; externalEffect: boolean };

export const workspaceAgentCapabilities = {
  CUSTOMER_COUNT: { service: "CRM", permission: "CRM_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  CUSTOMER_CREATE: { service: "CRM", permission: "CRM_CREATE", mode: "WRITE", confirmation: true, externalEffect: false },
  CRM_FOLLOW_UPS: { service: "CRM", permission: "CRM_ACTIVITY_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  NEW_CUSTOMERS: { service: "CRM", permission: "CRM_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  NEW_LEADS: { service: "LEADS", permission: "INQUIRY_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  SALES_RECOMMENDATIONS: { service: "SALES", permission: "DEAL_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  PROJECTS: { service: "PROJECTS", permission: "PROJECT_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  TASKS: { service: "PROJECTS", permission: "TASK_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  FINANCE: { service: "FINANCE", permission: "FINANCE_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  ACTION_CENTRE: { service: "ACTION_CENTRE", permission: "APPROVAL_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  SUPPORT_SUMMARY: { service: "SUPPORT", permission: "SUPPORT_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  SUPPORT_ESCALATION: { service: "SUPPORT", permission: "SUPPORT_MANAGE", mode: "WRITE", confirmation: true, externalEffect: false },
  FINANCE_GOAL_VIEW: { service: "FINANCE", permission: "FINANCE_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  LEADS_GOAL_VIEW: { service: "LEADS", permission: "INQUIRY_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  CRM_GOAL_VIEW: { service: "CRM", permission: "CRM_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  FOLLOW_UP_GOAL_VIEW: { service: "CRM", permission: "CRM_ACTIVITY_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  PROJECT_GOAL_VIEW: { service: "PROJECTS", permission: "PROJECT_VIEW", mode: "READ", confirmation: false, externalEffect: false },
  FINANCE_GOAL: { service: "FINANCE", permission: "FINANCE_MANAGE", mode: "WRITE", confirmation: false, externalEffect: false },
  LEADS_GOAL: { service: "LEADS", permission: "INQUIRY_MANAGE", mode: "WRITE", confirmation: false, externalEffect: false },
  CRM_GOAL: { service: "CRM", permission: "CRM_UPDATE", mode: "WRITE", confirmation: false, externalEffect: false },
  FOLLOW_UP_GOAL: { service: "CRM", permission: "CRM_FOLLOWUP_MANAGE", mode: "WRITE", confirmation: false, externalEffect: false },
  PROJECT_GOAL: { service: "PROJECTS", permission: "PROJECT_MANAGE", mode: "WRITE", confirmation: false, externalEffect: false },
} as const satisfies Record<string, WorkspaceAgentCapabilityPolicy>;

export type WorkspaceAgentCapability = keyof typeof workspaceAgentCapabilities;

export async function requireWorkspaceAgentCapability(context: WorkspaceAgentContext, capability: WorkspaceAgentCapability) {
  const policy = workspaceAgentCapabilities[capability];
  return verifyServiceAccess({ ...context, isPlatformAdmin: context.isPlatformAdmin ?? false }, policy.service, policy.permission);
}

export async function workspaceAgentCapabilityAvailability(context: WorkspaceAgentContext, capability: WorkspaceAgentCapability): Promise<AgentAvailability> {
  try {
    await requireWorkspaceAgentCapability(context, capability);
    return "VERIFIED";
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 403) throw error;
    return error.code === "FORBIDDEN" || error.code === "MEMBER_SERVICE_READ_ONLY" ? "FORBIDDEN" : "UNAVAILABLE";
  }
}
