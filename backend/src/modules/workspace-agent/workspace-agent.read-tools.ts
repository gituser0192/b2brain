import { z, type ZodType } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import { AnalysisService } from "../analysis/analysis.service.js";
import type { RegisteredServiceKey } from "../services/service-maturity.js";
import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";

export type AgentReadAvailability = "VERIFIED" | "NO_DATA" | "UNAVAILABLE" | "FORBIDDEN" | "FAILED";
export type AgentReadRecord = { type: string; id: string; label: string; status?: string; date?: string | null; amount?: number; currency?: string; reason?: string; href?: string };
export type AgentToolResult = {
  toolName: string; service: RegisteredServiceKey; provenance: "ORGANIZATION_DATA" | "CALCULATION" | "INFERENCE";
  retrievedAt: string; availability: AgentReadAvailability; resultCount: number; totalCount?: number; appliedFilters: Record<string, string | number | boolean>;
  period?: string; currency?: string; truncated: boolean; durationMs?: number; summary?: Record<string, number | string | null>; records: AgentReadRecord[];
};

type AgentReadTool = {
  name: string; service: RegisteredServiceKey; permissions: string[]; mode: "READ"; risk: "LOW" | "SENSITIVE"; confirmation: "NONE"; externalEffect: false;
  inputSchema: ZodType; maxResults: number; timeoutMs: number; provenance: AgentToolResult["provenance"]; description: string;
};

const listInput = z.object({ query: z.string().trim().min(1).max(120).optional(), limit: z.number().int().min(1).max(20).default(5), id: z.string().uuid().optional(), period: z.enum(["THIS_MONTH"]).optional() }).strict();
const noInput = z.object({ limit: z.number().int().min(1).max(20).default(5) }).strict();
const searchInput = z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(5).default(5) }).strict();
const detailInput = z.object({ id: z.string().uuid(), limit: z.literal(1).default(1) }).strict();
const define = (name: string, service: RegisteredServiceKey, permissions: string[], description: string, inputSchema?: ZodType, provenance: AgentToolResult["provenance"] = "ORGANIZATION_DATA"): AgentReadTool => ({ name, service, permissions, mode: "READ", risk: name.endsWith(".detail") ? "SENSITIVE" : "LOW", confirmation: "NONE", externalEffect: false, inputSchema: inputSchema ?? (name.includes("search") ? searchInput : name.endsWith(".detail") ? detailInput : listInput), maxResults: name.includes("search") ? 5 : name.endsWith(".detail") ? 1 : 20, timeoutMs: 5_000, provenance, description });

const tools = [
  define("leads.summary", "LEADS", ["INQUIRY_VIEW"], "Summarize verified leads.", noInput),
  define("leads.list", "LEADS", ["INQUIRY_VIEW"], "List recent leads."),
  define("leads.needing_follow_up", "LEADS", ["INQUIRY_VIEW"], "List leads requiring follow-up."),
  define("leads.search", "LEADS", ["INQUIRY_VIEW"], "Search leads by safe display fields."),
  define("leads.detail", "LEADS", ["INQUIRY_VIEW"], "Read one authorized lead."),
  define("crm.customer_summary", "CRM", ["CRM_VIEW"], "Summarize CRM customers.", noInput),
  define("crm.customer_list", "CRM", ["CRM_VIEW"], "List recent CRM customers."),
  define("crm.customer_search", "CRM", ["CRM_VIEW"], "Search CRM customers."),
  define("crm.customer_detail", "CRM", ["CRM_VIEW"], "Read one authorized CRM customer."),
  define("crm.follow_up_summary", "CRM", ["CRM_ACTIVITY_VIEW"], "Summarize customer follow-ups.", noInput),
  define("crm.follow_ups_due", "CRM", ["CRM_ACTIVITY_VIEW"], "List due customer follow-ups."),
  define("sales.pipeline_summary", "SALES", ["DEAL_VIEW"], "Summarize the sales pipeline.", noInput),
  define("sales.deal_list", "SALES", ["DEAL_VIEW"], "List active sales deals."),
  define("sales.deal_search", "SALES", ["DEAL_VIEW"], "Search sales deals."),
  define("sales.deal_detail", "SALES", ["DEAL_VIEW"], "Read one authorized sales deal."),
  define("sales.deals_at_risk", "SALES", ["DEAL_VIEW"], "List delayed or stale deals."),
  define("projects.summary", "PROJECTS", ["PROJECT_VIEW"], "Summarize projects.", noInput),
  define("projects.list", "PROJECTS", ["PROJECT_VIEW"], "List projects."),
  define("projects.search", "PROJECTS", ["PROJECT_VIEW"], "Search projects."),
  define("projects.detail", "PROJECTS", ["PROJECT_VIEW"], "Read one authorized project."),
  define("projects.overdue_tasks", "PROJECTS", ["TASK_VIEW"], "List overdue project tasks."),
  define("projects.tasks_due", "PROJECTS", ["TASK_VIEW"], "List tasks due soon."),
  define("projects.at_risk", "PROJECTS", ["PROJECT_VIEW"], "List delayed projects."),
  define("finance.summary", "FINANCE", ["FINANCE_VIEW"], "Summarize verified finance records.", noInput, "CALCULATION"),
  define("finance.invoice_list", "FINANCE", ["FINANCE_VIEW"], "List invoices."),
  define("finance.invoice_search", "FINANCE", ["FINANCE_VIEW"], "Search invoices."),
  define("finance.invoice_detail", "FINANCE", ["FINANCE_VIEW"], "Read one authorized invoice."),
  define("finance.overdue_invoices", "FINANCE", ["FINANCE_VIEW"], "List overdue invoices."),
  define("finance.payment_summary", "FINANCE", ["FINANCE_VIEW"], "Summarize verified payments.", noInput, "CALCULATION"),
  define("finance.expense_summary", "FINANCE", ["FINANCE_VIEW"], "Summarize verified expenses.", noInput, "CALCULATION"),
  define("finance.cash_position", "FINANCE", ["FINANCE_VIEW"], "Calculate the verified cash position.", noInput, "CALCULATION"),
  define("analysis.latest", "BUSINESS_ANALYSIS", ["ANALYSIS_VIEW"], "Read the latest authoritative Business Analysis.", noInput, "CALCULATION"),
  define("analysis.health", "BUSINESS_ANALYSIS", ["ANALYSIS_VIEW"], "Read the authoritative health assessment.", noInput, "CALCULATION"),
  define("analysis.risks", "BUSINESS_ANALYSIS", ["ANALYSIS_VIEW"], "Read verified business risks.", noInput, "CALCULATION"),
  define("analysis.recommendations", "BUSINESS_ANALYSIS", ["ANALYSIS_VIEW"], "Read Business Analysis recommendations.", noInput, "CALCULATION"),
  define("actions.summary", "ACTION_CENTRE", ["APPROVAL_VIEW"], "Summarize stored Action Centre recommendations.", noInput),
  define("actions.open", "ACTION_CENTRE", ["APPROVAL_VIEW"], "List open Action Centre recommendations."),
  define("actions.priority", "ACTION_CENTRE", ["APPROVAL_VIEW"], "List high-priority Action Centre recommendations."),
  define("actions.detail", "ACTION_CENTRE", ["APPROVAL_VIEW"], "Read one stored Action Centre recommendation."),
] as const;

export const workspaceAgentReadTools = Object.fromEntries(tools.map((tool) => [tool.name, tool])) as Record<string, AgentReadTool>;
export type WorkspaceAgentReadToolName = (typeof tools)[number]["name"];

const href = (service: RegisteredServiceKey, id?: string) => {
  const links: Partial<Record<RegisteredServiceKey, string>> = { LEADS: "/dashboard?view=inquiries", CRM: id ? `/crm/customers/${id}` : "/crm", SALES: "/dashboard?view=sales", PROJECTS: id ? `/projects/${id}` : "/projects", FINANCE: "/finance", BUSINESS_ANALYSIS: "/dashboard?view=analysis", ACTION_CENTRE: "/dashboard?view=governance" };
  return links[service] ?? "/dashboard";
};
const record = (type: string, value: { id: string; label: string; status?: string; date?: Date | null; amount?: number; currency?: string; reason?: string | undefined }, service: RegisteredServiceKey): AgentReadRecord => {
  const { date, reason, ...safe } = value;
  return { ...safe, ...(reason === undefined ? {} : { reason }), type, date: date?.toISOString() ?? null, href: href(service, value.id) };
};

async function query(tool: AgentReadTool, context: WorkspaceAgentContext, input: { query?: string; limit: number; id?: string; period?: "THIS_MONTH" }): Promise<Omit<AgentToolResult, "toolName" | "service" | "provenance" | "retrievedAt">> {
  const organizationId = context.organizationId;
  const limit = Math.min(input.limit, tool.maxResults), now = new Date(), q = input.query;
  if (tool.name.startsWith("leads.")) {
    const where: Prisma.InquiryWhereInput = { organizationId, deletedAt: null, ...(input.id ? { id: input.id } : {}), ...(q ? { OR: [{ contactName: { contains: q, mode: "insensitive" as const } }, { subject: { contains: q, mode: "insensitive" as const } }, { companyName: { contains: q, mode: "insensitive" as const } }] } : {}), ...(tool.name === "leads.needing_follow_up" ? { status: { in: ["NEW", "REVIEWING", "QUALIFIED"] }, OR: [{ responseDueAt: { lte: now }, firstRespondedAt: null }, { nextFollowUpAt: { lte: now }, followUpCompletedAt: null }] } : {}) };
    const [items, total] = await Promise.all([prisma.inquiry.findMany({ where, select: { id: true, contactName: true, subject: true, status: true, priority: true, createdAt: true, nextFollowUpAt: true }, orderBy: { createdAt: "desc" }, take: limit }), prisma.inquiry.count({ where })]);
    const records = items.map((item) => record("LEAD", { id: item.id, label: item.contactName || item.subject, status: item.status, date: item.nextFollowUpAt ?? item.createdAt, reason: tool.name === "leads.needing_follow_up" ? "Response or follow-up is due" : item.subject }, "LEADS"));
    return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: q ? { query: q } : {}, truncated: total > records.length, summary: { total }, records };
  }
  if (tool.name.startsWith("crm.customer")) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const where: Prisma.CustomerWhereInput = { organizationId, deletedAt: null, ...(input.id ? { id: input.id } : {}), ...(input.period === "THIS_MONTH" ? { createdAt: { gte: monthStart } } : {}), ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" as const } }, { companyName: { contains: q, mode: "insensitive" as const } }] } : {}) };
    const [items, total] = await Promise.all([prisma.customer.findMany({ where, select: { id: true, displayName: true, status: true, createdAt: true, city: true, country: true }, orderBy: { createdAt: "desc" }, take: limit }), prisma.customer.count({ where })]);
    const records = items.map((item) => record("CUSTOMER", { id: item.id, label: item.displayName, status: item.status, date: item.createdAt, ...([item.city, item.country].filter(Boolean).length ? { reason: [item.city, item.country].filter(Boolean).join(", ") } : {}) }, "CRM"));
    return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: { ...(q ? { query: q } : {}), ...(input.period ? { period: input.period } : {}) }, ...(input.period ? { period: "Current calendar month" } : {}), truncated: total > records.length, summary: { total }, records };
  }
  if (tool.name.startsWith("crm.follow_")) {
    const where: Prisma.CustomerFollowUpWhereInput = { organizationId, deletedAt: null, status: "PENDING", ...(tool.name === "crm.follow_ups_due" ? { dueAt: { lte: now } } : {}) };
    const [items, total] = await Promise.all([prisma.customerFollowUp.findMany({ where, select: { id: true, title: true, status: true, dueAt: true, customer: { select: { id: true, displayName: true } } }, orderBy: { dueAt: "asc" }, take: limit }), prisma.customerFollowUp.count({ where })]);
    const records = items.map((item) => ({ ...record("FOLLOW_UP", { id: item.id, label: item.title, status: item.status, date: item.dueAt, reason: item.customer.displayName }, "CRM"), href: href("CRM", item.customer.id) }));
    return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: {}, truncated: total > records.length, summary: { pending: total }, records };
  }
  if (tool.name.startsWith("sales.")) {
    const atRisk = tool.name === "sales.deals_at_risk", stalled = new Date(now.getTime() - 14 * 86_400_000);
    const where: Prisma.DealWhereInput = { organizationId, deletedAt: null, ...(input.id ? { id: input.id } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { customer: { displayName: { contains: q, mode: "insensitive" as const } } }] } : {}), ...(atRisk ? { stage: { notIn: ["WON", "LOST"] }, OR: [{ expectedCloseDate: { lt: now } }, { updatedAt: { lt: stalled } }] } : {}) };
    const [items, total] = await Promise.all([prisma.deal.findMany({ where, select: { id: true, name: true, stage: true, amount: true, currency: true, expectedCloseDate: true, updatedAt: true, customer: { select: { displayName: true } } }, orderBy: { updatedAt: "desc" }, take: limit }), prisma.deal.count({ where })]);
    const records = items.map((item) => record("DEAL", { id: item.id, label: item.name, status: item.stage, date: item.expectedCloseDate, amount: Number(item.amount), currency: item.currency, reason: atRisk ? `Review ${item.customer.displayName}'s delayed or stale deal` : item.customer.displayName }, "SALES"));
    const open = items.filter((item) => !["WON", "LOST"].includes(item.stage));
    return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: q ? { query: q } : {}, truncated: total > records.length, summary: { total, open: open.length, pipelineValue: open.reduce((sum, item) => sum + Number(item.amount), 0) }, ...(items[0]?.currency ? { currency: items[0].currency } : {}), records };
  }
  if (tool.name.startsWith("projects.")) {
    if (tool.name.includes("tasks")) {
      const dueSoon = new Date(now.getTime() + 7 * 86_400_000), where: Prisma.ProjectTaskWhereInput = { organizationId, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELED"] }, dueDate: { ...(tool.name === "projects.overdue_tasks" ? { lt: now } : { gte: now, lte: dueSoon }) } };
      const [items, total] = await Promise.all([prisma.projectTask.findMany({ where, select: { id: true, title: true, status: true, priority: true, dueDate: true, project: { select: { id: true, name: true } } }, orderBy: { dueDate: "asc" }, take: limit }), prisma.projectTask.count({ where })]);
      const records = items.map((item) => ({ ...record("TASK", { id: item.id, label: item.title, status: item.status, date: item.dueDate, reason: `${item.project.name} · ${item.priority}` }, "PROJECTS"), href: href("PROJECTS", item.project.id) }));
      return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: { due: tool.name === "projects.overdue_tasks" ? "overdue" : "next 7 days" }, truncated: total > records.length, summary: { total }, records };
    }
    const where: Prisma.ProjectWhereInput = { organizationId, deletedAt: null, ...(input.id ? { id: input.id } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { code: { contains: q, mode: "insensitive" as const } }] } : {}), ...(tool.name === "projects.at_risk" ? { status: { notIn: ["COMPLETED", "CANCELED"] }, dueDate: { lt: now } } : {}) };
    const [items, total] = await Promise.all([prisma.project.findMany({ where, select: { id: true, name: true, code: true, status: true, priority: true, dueDate: true, _count: { select: { tasks: { where: { deletedAt: null } } } } }, orderBy: { updatedAt: "desc" }, take: limit }), prisma.project.count({ where })]);
    const records = items.map((item) => record("PROJECT", { id: item.id, label: item.name, status: item.status, date: item.dueDate, reason: `${item.code} · ${item.priority} · ${item._count.tasks} tasks` }, "PROJECTS"));
    return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: q ? { query: q } : {}, truncated: total > records.length, summary: { total }, records };
  }
  if (tool.name.startsWith("finance.")) {
    const overdue = tool.name === "finance.overdue_invoices";
    const where: Prisma.InvoiceWhereInput = { organizationId, deletedAt: null, ...(input.id ? { id: input.id } : {}), ...(q ? { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" as const } }, { customer: { displayName: { contains: q, mode: "insensitive" as const } } }] } : {}), ...(overdue ? { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } } : {}) };
    const activeInvoices: Prisma.InvoiceWhereInput = { organizationId, deletedAt: null, status: { not: "CANCELED" } };
    const [items, total, invoiceTotals, expenses, payments] = await Promise.all([prisma.invoice.findMany({ where, select: { id: true, invoiceNumber: true, status: true, dueDate: true, total: true, currency: true, customer: { select: { displayName: true } }, payments: { where: { deletedAt: null }, select: { amount: true, refundedAmount: true } } }, orderBy: { issueDate: "desc" }, take: limit }), prisma.invoice.count({ where }), prisma.invoice.aggregate({ where: activeInvoices, _sum: { total: true } }), prisma.expense.aggregate({ where: { organizationId, deletedAt: null, status: "RECORDED" }, _sum: { amount: true } }), prisma.payment.aggregate({ where: { organizationId, deletedAt: null, invoice: activeInvoices }, _sum: { amount: true, refundedAmount: true } })]);
    const records = items.map((item) => { const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount) - Number(payment.refundedAmount), 0), outstanding = Math.max(0, Number(item.total) - paid); return record("INVOICE", { id: item.id, label: item.invoiceNumber, status: outstanding === 0 ? "PAID" : item.status, date: item.dueDate, amount: outstanding, currency: item.currency, reason: item.customer.displayName }, "FINANCE"); });
    const received = Number(payments._sum.amount ?? 0) - Number(payments._sum.refundedAmount ?? 0), outstanding = Math.max(0, Number(invoiceTotals._sum.total ?? 0) - received);
    return { availability: total || Number(expenses._sum.amount ?? 0) || received ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: q ? { query: q } : {}, truncated: total > records.length, summary: { invoices: total, outstanding, received, expenses: Number(expenses._sum.amount ?? 0) }, ...(items[0]?.currency ? { currency: items[0].currency } : {}), records };
  }
  if (tool.name.startsWith("analysis.")) {
    const value = await new AnalysisService().analyze(organizationId, context.permissions, 30);
    const records = tool.name === "analysis.recommendations" || tool.name === "analysis.risks" ? value.recommendations.slice(0, limit).map((item) => record("BUSINESS_RISK", { id: item.key, label: item.title, status: item.priority, reason: item.evidence }, "BUSINESS_ANALYSIS")) : value.components.slice(0, limit).map((item) => record("HEALTH_FACTOR", { id: item.key, label: item.label, status: item.score === null ? "NO_DATA" : `${item.score}/100`, reason: item.evidence }, "BUSINESS_ANALYSIS"));
    return { availability: value.dataStatus === "INSUFFICIENT" ? "NO_DATA" : "VERIFIED", resultCount: records.length, totalCount: records.length, appliedFilters: { days: 30 }, period: `${value.period.currentStart.toISOString()} – ${value.period.currentEnd.toISOString()}`, currency: value.currency, truncated: false, summary: { healthScore: value.overallScore, status: value.scoreLabel, recordCount: value.recordCount }, records };
  }
  const where: Prisma.BusinessRecommendationWhereInput = { organizationId, status: "OPEN", ...(input.id ? { id: input.id } : {}), ...(tool.name === "actions.priority" ? { priority: { in: ["CRITICAL", "HIGH"] } } : {}) };
  const [items, total] = await Promise.all([prisma.businessRecommendation.findMany({ where, select: { id: true, title: true, priority: true, serviceCode: true, explanation: true, createdAt: true }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: limit }), prisma.businessRecommendation.count({ where })]);
  const records = items.map((item) => record("ACTION", { id: item.id, label: item.title, status: item.priority, date: item.createdAt, reason: item.explanation }, "ACTION_CENTRE"));
  return { availability: total ? "VERIFIED" : "NO_DATA", resultCount: records.length, totalCount: total, appliedFilters: {}, truncated: total > records.length, summary: { open: total }, records };
}

export async function executeWorkspaceAgentReadTool(context: WorkspaceAgentContext, name: string, rawInput: unknown): Promise<AgentToolResult> {
  const tool = workspaceAgentReadTools[name];
  if (!tool) throw new AppError(400, "This Agent read tool is not supported.", "AGENT_TOOL_NOT_SUPPORTED");
  const input = tool.inputSchema.parse(rawInput) as { query?: string; limit: number; id?: string; period?: "THIS_MONTH" };
  const started = Date.now();
  try {
    await verifyServiceAccess({ ...context, isPlatformAdmin: context.isPlatformAdmin ?? false }, "B2BRAIN_AGENT");
    for (const permission of tool.permissions) await verifyServiceAccess({ ...context, isPlatformAdmin: context.isPlatformAdmin ?? false }, tool.service, permission);
    const result = await Promise.race([query(tool, context, input), new Promise<never>((_, reject) => setTimeout(() => reject(new AppError(504, "The business data check timed out.", "AGENT_TOOL_TIMEOUT")), tool.timeoutMs))]);
    return { toolName: tool.name, service: tool.service, provenance: tool.provenance, retrievedAt: new Date().toISOString(), durationMs: Date.now() - started, ...result };
  } catch (error) {
    const availability: AgentReadAvailability = error instanceof AppError && error.statusCode === 403 ? error.code === "FORBIDDEN" || error.code === "MEMBER_SERVICE_READ_ONLY" ? "FORBIDDEN" : "UNAVAILABLE" : "FAILED";
    return { toolName: tool.name, service: tool.service, provenance: tool.provenance, retrievedAt: new Date().toISOString(), durationMs: Date.now() - started, availability, resultCount: 0, appliedFilters: {}, truncated: false, records: [] };
  }
}
