import { z, type ZodType } from "zod";
import { prisma } from "../../database/prisma.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { CustomerService } from "../customers/customer.service.js";
import { EngagementService } from "../customer-engagement/engagement.service.js";
import { LeadAssignmentService } from "../inquiries/lead-assignment.service.js";
import { ProjectService } from "../projects/project.service.js";
import type { RegisteredServiceKey } from "../services/service-maturity.js";
import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";

export type AgentWriteToolName = "crm.customer_create" | "crm.follow_up_create" | "projects.task_create" | "leads.assign";
export type AgentWritePreview = { toolName: AgentWriteToolName; service: RegisteredServiceKey; targetLabel: string; changes: Record<string, string>; consequence: string; externalEffect: false; href: string; targetVersion?: string };
type Tool = { name: AgentWriteToolName; service: RegisteredServiceKey; permission: string; mode: "WRITE"; risk: "LOW" | "SENSITIVE"; confirmation: "REQUIRED"; externalEffect: false; inputSchema: ZodType };
type WriteInput = { displayName?: string; phone?: string; customerId?: string; projectId?: string; inquiryId?: string; employeeId?: string; assignedMembershipId?: string; title?: string; description?: string; dueAt?: string; targetVersion?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; responseTimeMinutes?: number; reason?: string };

const customer = z.object({ displayName: z.string().trim().min(2).max(80), phone: z.string().regex(/^\d{7,17}$/) }).strict();
const followUp = z.object({ customerId: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(4000).optional(), dueAt: z.string().datetime(), targetVersion: z.string().datetime().optional() }).strict();
const task = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(2).max(200), description: z.string().trim().max(4000).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"), dueAt: z.string().datetime().optional(), assignedMembershipId: z.string().uuid().optional(), targetVersion: z.string().datetime().optional() }).strict();
const assignment = z.object({ inquiryId: z.string().uuid(), employeeId: z.string().uuid(), responseTimeMinutes: z.number().int().min(5).max(10080).default(1440), reason: z.string().trim().min(2).max(500), targetVersion: z.string().datetime().optional() }).strict();
const define = (name: AgentWriteToolName, service: RegisteredServiceKey, permission: string, inputSchema: ZodType, risk: Tool["risk"] = "LOW"): Tool => ({ name, service, permission, inputSchema, mode: "WRITE", risk, confirmation: "REQUIRED", externalEffect: false });
export const workspaceAgentWriteTools = {
  "crm.customer_create": define("crm.customer_create", "CRM", "CRM_CREATE", customer),
  "crm.follow_up_create": define("crm.follow_up_create", "CRM", "CRM_FOLLOWUP_MANAGE", followUp),
  "projects.task_create": define("projects.task_create", "PROJECTS", "TASK_MANAGE", task),
  "leads.assign": define("leads.assign", "LEADS", "INQUIRY_MANAGE", assignment, "SENSITIVE"),
} satisfies Record<AgentWriteToolName, Tool>;

const access = async (context: WorkspaceAgentContext, tool: Tool) => {
  const auth = { ...context, isPlatformAdmin: context.isPlatformAdmin ?? false };
  await verifyServiceAccess(auth, "B2BRAIN_AGENT");
  await verifyServiceAccess(auth, tool.service, tool.permission);
};
const changed = (actual: Date, expected?: string) => expected && actual.toISOString() !== expected;

export async function previewWorkspaceAgentWriteTool(context: WorkspaceAgentContext, name: AgentWriteToolName, raw: unknown): Promise<{ arguments: Record<string, unknown>; preview: AgentWritePreview }> {
  const tool = workspaceAgentWriteTools[name]; await access(context, tool);
  const input = tool.inputSchema.parse(raw) as WriteInput;
  if (name === "crm.customer_create") return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: String(input.displayName), changes: { status: "Lead", phoneEnding: String(input.phone).slice(-4) }, consequence: "This will add one CRM customer. No message will be sent.", externalEffect: false, href: "/crm" } };
  if ("dueAt" in input && input.dueAt && new Date(String(input.dueAt)) <= new Date()) throw new AppError(400, "Choose a future date and time.", "AGENT_ACTION_DATE_PAST");
  if (name === "crm.follow_up_create") {
    if (new Date(String(input.dueAt)) <= new Date()) throw new AppError(409, "The follow-up time is no longer in the future. Review the action again.", "AGENT_ACTION_STALE");
    const record = await prisma.customer.findFirst({ where: { id: String(input.customerId), organizationId: context.organizationId, deletedAt: null }, select: { displayName: true, updatedAt: true } });
    if (!record) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    input.targetVersion = record.updatedAt.toISOString();
    return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: record.displayName, changes: { title: String(input.title), dueAt: String(input.dueAt) }, consequence: "This will add one CRM follow-up. No message will be sent.", externalEffect: false, href: `/crm/customers/${String(input.customerId)}`, targetVersion: String(input.targetVersion) } };
  }
  if (name === "projects.task_create") {
    if (input.dueAt && new Date(String(input.dueAt)) <= new Date()) throw new AppError(409, "The task due date is no longer in the future. Review the action again.", "AGENT_ACTION_STALE");
    const project = await prisma.project.findFirst({ where: { id: String(input.projectId), organizationId: context.organizationId, deletedAt: null }, select: { name: true, updatedAt: true } });
    const member = input.assignedMembershipId ? await prisma.organizationMembership.findFirst({ where: { id: String(input.assignedMembershipId), organizationId: context.organizationId, status: "ACTIVE" }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }) : null;
    if (!project) throw new AppError(404, "Project was not found.", "PROJECT_NOT_FOUND");
    if (input.assignedMembershipId && !member) throw new AppError(404, "Active organization member was not found.", "MEMBER_NOT_FOUND");
    input.targetVersion = project.updatedAt.toISOString();
    const assignee = member ? `${member.user.firstName} ${member.user.lastName ?? ""}`.trim() : "You";
    return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: project.name, changes: { title: String(input.title), assignedTo: assignee, ...(input.dueAt ? { dueAt: String(input.dueAt) } : {}) }, consequence: "This will create one internal project task. No external action will occur.", externalEffect: false, href: `/projects/${String(input.projectId)}`, targetVersion: String(input.targetVersion) } };
  }
  const [inquiry, employee] = await Promise.all([prisma.inquiry.findFirst({ where: { id: String(input.inquiryId), organizationId: context.organizationId, deletedAt: null }, select: { subject: true, updatedAt: true } }), prisma.employee.findFirst({ where: { id: String(input.employeeId), organizationId: context.organizationId, status: "ACTIVE", deletedAt: null }, select: { firstName: true, lastName: true } })]);
  if (!inquiry) throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
  if (!employee) throw new AppError(404, "Active employee was not found.", "EMPLOYEE_NOT_FOUND");
  input.targetVersion = inquiry.updatedAt.toISOString();
  return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: inquiry.subject, changes: { assignedTo: `${employee.firstName} ${employee.lastName ?? ""}`.trim() }, consequence: "This will assign one inquiry. No message will be sent.", externalEffect: false, href: "/dashboard?view=inquiries", targetVersion: String(input.targetVersion) } };
}

export async function executeWorkspaceAgentWriteTool(context: WorkspaceAgentContext, name: AgentWriteToolName, raw: unknown) {
  const tool = workspaceAgentWriteTools[name]; await access(context, tool);
  const input = tool.inputSchema.parse(raw) as WriteInput;
  if (name === "crm.customer_create") {
    const existing = await prisma.customer.findFirst({ where: { organizationId: context.organizationId, phone: String(input.phone), deletedAt: null }, select: { id: true, displayName: true } });
    if (existing) return { alreadyCompleted: true, id: existing.id, label: existing.displayName, href: `/crm/customers/${existing.id}` };
    const created = await new CustomerService().create(context.organizationId, context.userId, { type: "PERSON", firstName: String(input.displayName), lastName: null, companyName: null, email: null, phone: String(input.phone), website: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, country: null, status: "LEAD", notes: null });
    return { alreadyCompleted: false, id: created.id, label: created.displayName, href: `/crm/customers/${created.id}` };
  }
  if (name === "crm.follow_up_create") {
    const target = await prisma.customer.findFirst({ where: { id: String(input.customerId), organizationId: context.organizationId, deletedAt: null }, select: { updatedAt: true } });
    if (!target) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    if (changed(target.updatedAt, String(input.targetVersion))) throw new AppError(409, "The customer changed after preview. Review the action again.", "AGENT_ACTION_STALE");
    const created = await new EngagementService().createFollowUp(context.organizationId, String(input.customerId), context.userId, { title: String(input.title), description: input.description ? String(input.description) : null, dueAt: new Date(String(input.dueAt)) });
    return { alreadyCompleted: false, id: created.id, label: created.title, href: `/crm/customers/${String(input.customerId)}` };
  }
  if (name === "projects.task_create") {
    const target = await prisma.project.findFirst({ where: { id: String(input.projectId), organizationId: context.organizationId, deletedAt: null }, select: { updatedAt: true } });
    if (!target) throw new AppError(404, "Project was not found.", "PROJECT_NOT_FOUND");
    if (changed(target.updatedAt, String(input.targetVersion))) throw new AppError(409, "The project changed after preview. Review the action again.", "AGENT_ACTION_STALE");
    const created = await new ProjectService().createTask(context.organizationId, context.userId, String(input.projectId), { title: String(input.title), description: input.description ? String(input.description) : null, status: "TODO", priority: input.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT", dueDate: input.dueAt ? new Date(String(input.dueAt)) : null, assignedMembershipId: input.assignedMembershipId ? String(input.assignedMembershipId) : null });
    return { alreadyCompleted: false, id: created.id, label: created.title, href: `/projects/${String(input.projectId)}` };
  }
  const target = await prisma.inquiry.findFirst({ where: { id: String(input.inquiryId), organizationId: context.organizationId, deletedAt: null }, select: { updatedAt: true } });
  if (!target) throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
  if (changed(target.updatedAt, String(input.targetVersion))) throw new AppError(409, "The inquiry changed after preview. Review the action again.", "AGENT_ACTION_STALE");
  await new LeadAssignmentService().manualAssign(context.organizationId, context.userId, String(input.inquiryId), { employeeId: String(input.employeeId), responseTimeMinutes: Number(input.responseTimeMinutes), reason: String(input.reason) });
  return { alreadyCompleted: false, id: String(input.inquiryId), label: "Inquiry assignment", href: "/dashboard?view=inquiries" };
}
