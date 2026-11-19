import { z, type ZodType } from "zod";
import { prisma } from "../../database/prisma.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { CustomerService } from "../customers/customer.service.js";
import { EngagementService } from "../customer-engagement/engagement.service.js";
import { LeadAssignmentService } from "../inquiries/lead-assignment.service.js";
import { ProjectService } from "../projects/project.service.js";
import { FinanceService } from "../finance/finance.service.js";
import type { RegisteredServiceKey } from "../services/service-maturity.js";
import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";

export type AgentWriteToolName = "crm.customer_create" | "crm.follow_up_create" | "projects.task_create" | "leads.assign" | "finance.invoice_create" | "finance.invoice_issue" | "finance.payment_record" | "finance.expense_create";
export type AgentWritePreview = { toolName: AgentWriteToolName; service: RegisteredServiceKey; targetLabel: string; changes: Record<string, string>; consequence: string; externalEffect: false; href: string; targetVersion?: string };
type Tool = { name: AgentWriteToolName; service: RegisteredServiceKey; permission: string; mode: "WRITE"; risk: "LOW" | "SENSITIVE"; confirmation: "REQUIRED"; externalEffect: false; inputSchema: ZodType };
type WriteInput = { displayName?: string; phone?: string; customerId?: string; customerName?: string; invoiceNumber?: string; issueDate?: string; dueDate?: string; currency?: string; quantity?: number; unitPrice?: number; projectId?: string | null; inquiryId?: string; employeeId?: string; assignedMembershipId?: string; title?: string; category?: string; vendor?: string; amount?: number; amountMode?: "HALF" | "FULL"; balanceAtPreview?: number; method?: "CASH" | "BANK_TRANSFER" | "CARD" | "UPI" | "CHEQUE" | "OTHER"; reference?: string; paidAt?: string; invoiceId?: string; expenseDate?: string; description?: string; dueAt?: string; targetVersion?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; responseTimeMinutes?: number; reason?: string; replyLanguage?: "en" | "hi" };

const customer = z.object({ displayName: z.string().trim().min(2).max(80), phone: z.string().regex(/^\d{7,17}$/) }).strict();
const followUp = z.object({ customerId: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(4000).optional(), dueAt: z.string().datetime(), targetVersion: z.string().datetime().optional() }).strict();
const task = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(2).max(200), description: z.string().trim().max(4000).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"), dueAt: z.string().datetime().optional(), assignedMembershipId: z.string().uuid().optional(), targetVersion: z.string().datetime().optional() }).strict();
const assignment = z.object({ inquiryId: z.string().uuid(), employeeId: z.string().uuid(), responseTimeMinutes: z.number().int().min(5).max(10080).default(1440), reason: z.string().trim().min(2).max(500), targetVersion: z.string().datetime().optional() }).strict();
const invoice = z.object({ customerName: z.string().trim().min(2).max(160), customerId: z.string().uuid().optional(), invoiceNumber: z.string().trim().min(1).max(40), issueDate: z.string().datetime(), dueDate: z.string().datetime(), currency: z.string().length(3), description: z.string().trim().min(1).max(300), quantity: z.number().positive().max(1_000_000), unitPrice: z.number().min(0).max(1_000_000_000), replyLanguage: z.enum(["en", "hi"]).optional() }).strict();
const issueInvoice = z.object({ invoiceNumber: z.string().trim().min(1).max(40), invoiceId: z.string().uuid().optional(), targetVersion: z.string().datetime().optional(), replyLanguage: z.enum(["en", "hi"]).optional() }).strict();
const payment = z.object({ invoiceNumber: z.string().trim().min(1).max(40), invoiceId: z.string().uuid().optional(), currency: z.string().length(3).optional(), amount: z.number().positive().max(1_000_000_000).optional(), amountMode: z.enum(["HALF", "FULL"]).optional(), balanceAtPreview: z.number().positive().optional(), method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE", "OTHER"]).default("OTHER"), reference: z.string().trim().max(120).optional(), paidAt: z.string().datetime(), targetVersion: z.string().datetime().optional(), replyLanguage: z.enum(["en", "hi"]).optional() }).strict().refine((value) => (value.amount !== undefined) !== (value.amountMode !== undefined), { message: "Choose one exact amount or HALF/FULL." });
const expense = z.object({ title: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(100), vendor: z.string().trim().max(160).optional(), amount: z.number().positive().max(1_000_000_000), currency: z.string().length(3), expenseDate: z.string().datetime(), replyLanguage: z.enum(["en", "hi"]).optional() }).strict();
const define = (name: AgentWriteToolName, service: RegisteredServiceKey, permission: string, inputSchema: ZodType, risk: Tool["risk"] = "LOW"): Tool => ({ name, service, permission, inputSchema, mode: "WRITE", risk, confirmation: "REQUIRED", externalEffect: false });
export const workspaceAgentWriteTools = {
  "crm.customer_create": define("crm.customer_create", "CRM", "CRM_CREATE", customer),
  "crm.follow_up_create": define("crm.follow_up_create", "CRM", "CRM_FOLLOWUP_MANAGE", followUp),
  "projects.task_create": define("projects.task_create", "PROJECTS", "TASK_MANAGE", task),
  "leads.assign": define("leads.assign", "LEADS", "INQUIRY_MANAGE", assignment, "SENSITIVE"),
  "finance.invoice_create": define("finance.invoice_create", "FINANCE", "FINANCE_MANAGE", invoice, "SENSITIVE"),
  "finance.invoice_issue": define("finance.invoice_issue", "FINANCE", "FINANCE_MANAGE", issueInvoice, "SENSITIVE"),
  "finance.payment_record": define("finance.payment_record", "FINANCE", "FINANCE_MANAGE", payment, "SENSITIVE"),
  "finance.expense_create": define("finance.expense_create", "FINANCE", "FINANCE_MANAGE", expense, "SENSITIVE"),
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
  if (name === "finance.invoice_create") {
    const subtotal = Number(input.quantity) * Number(input.unitPrice);
    const hindi = input.replyLanguage === "hi";
    const matches = await prisma.customer.findMany({ where: { organizationId: context.organizationId, deletedAt: null, displayName: { equals: String(input.customerName).trim(), mode: "insensitive" } }, select: { id: true, displayName: true }, take: 2 });
    if (matches.length > 1) throw new AppError(409, "More than one CRM customer has this name. Use a more specific name before creating the invoice.", "AGENT_CUSTOMER_MATCH_AMBIGUOUS");
    if (matches[0]) input.customerId = matches[0].id;
    const dueDate = new Date(String(input.dueDate)).toISOString().slice(0, 10), issueDate = new Date(String(input.issueDate)).toISOString().slice(0, 10);
    const customerName = matches[0]?.displayName ?? String(input.customerName);
    return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: customerName, changes: hindi ? { "इनवॉइस नंबर": String(input.invoiceNumber), "ग्राहक मिलान": matches[0] ? "मौजूदा CRM कस्टमर" : "फाइनेंस में अलग नाम", "स्थिति": "सिर्फ़ ड्राफ़्ट", "आइटम": `${String(input.description)} · ${input.quantity} × ${String(input.currency).toUpperCase()} ${Number(input.unitPrice).toFixed(2)}`, "कुल": `${String(input.currency).toUpperCase()} ${subtotal.toFixed(2)}`, "जारी तारीख": issueDate, "देय तारीख": dueDate } : { invoiceNumber: String(input.invoiceNumber), customerMatch: matches[0] ? "Existing CRM customer" : "Finance-only name", status: "Draft only", item: `${String(input.description)} · ${input.quantity} × ${String(input.currency).toUpperCase()} ${Number(input.unitPrice).toFixed(2)}`, total: `${String(input.currency).toUpperCase()} ${subtotal.toFixed(2)}`, issueDate, dueDate }, consequence: hindi ? "इससे एक ड्राफ़्ट इनवॉइस बनेगा। मौजूदा ग्राहक होने पर उससे लिंक होगा; नया CRM ग्राहक नहीं बनेगा। जारी या ईमेल करने के लिए अलग पुष्टि चाहिए।" : "This creates one draft invoice. If an exact existing CRM name matches, it will link to that customer; it will not create a CRM customer. Issuing or emailing requires a separate action.", externalEffect: false, href: "/finance?tab=invoices" } };
  }
  if (name === "finance.invoice_issue") {
    const record = await prisma.invoice.findFirst({ where: { organizationId: context.organizationId, invoiceNumber: String(input.invoiceNumber).trim().toUpperCase(), deletedAt: null }, select: { id: true, invoiceNumber: true, customerName: true, customer: { select: { displayName: true } }, status: true, total: true, currency: true, dueDate: true, updatedAt: true } });
    if (!record) throw new AppError(404, "Invoice was not found in this organization.", "INVOICE_NOT_FOUND");
    if (record.status !== "DRAFT") throw new AppError(409, "Only a draft invoice can be issued.", "INVOICE_NOT_DRAFT");
    input.invoiceId = record.id; input.targetVersion = record.updatedAt.toISOString();
    const hindi = input.replyLanguage === "hi";
    return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: record.customer?.displayName ?? record.customerName ?? record.invoiceNumber, changes: hindi ? { "इनवॉइस नंबर": record.invoiceNumber, "कुल": `${record.currency} ${Number(record.total).toFixed(2)}`, "स्थिति": "ड्राफ़्ट से जारी" } : { invoiceNumber: record.invoiceNumber, total: `${record.currency} ${Number(record.total).toFixed(2)}`, status: "Draft → Issued" }, consequence: hindi ? "यह इनवॉइस को फाइनेंस में जारी योग्य बनाएगा। कोई ईमेल या पेमेंट नहीं भेजा जाएगा।" : "This marks the invoice as issued in Finance so received payments can be recorded. No email or payment will be sent.", externalEffect: false, href: "/finance?tab=invoices", targetVersion: input.targetVersion } };
  }
  if (name === "finance.payment_record") {
    const record = await prisma.invoice.findFirst({ where: { organizationId: context.organizationId, invoiceNumber: String(input.invoiceNumber).trim().toUpperCase(), deletedAt: null }, select: { id: true, invoiceNumber: true, customerId: true, customerName: true, customer: { select: { displayName: true } }, status: true, total: true, currency: true, dueDate: true, updatedAt: true, payments: { where: { deletedAt: null }, select: { amount: true, refundedAmount: true } } } });
    if (!record) throw new AppError(404, "Invoice was not found in this organization.", "INVOICE_NOT_FOUND");
    if (["DRAFT", "CANCELED"].includes(record.status)) throw new AppError(409, "Issue the draft invoice in Finance before recording a received payment.", "INVOICE_NOT_ISSUED");
    const balance = Math.max(0, Number(record.total) - record.payments.reduce((sum, item) => sum + Number(item.amount) - Number(item.refundedAmount), 0));
    if (balance <= 0.001) throw new AppError(409, "This invoice is already fully paid.", "INVOICE_ALREADY_PAID");
    const amount = input.amountMode === "FULL" ? balance : input.amountMode === "HALF" ? Math.round(balance * 50) / 100 : Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance + 0.001 || Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-8) throw new AppError(400, "Payment amount must be positive, at most two decimal places, and no more than the current balance.", "PAYMENT_AMOUNT_INVALID");
    input.amount = amount; input.invoiceId = record.id; input.invoiceNumber = record.invoiceNumber; input.targetVersion = record.updatedAt.toISOString(); input.balanceAtPreview = balance; input.currency = record.currency; delete input.amountMode;
    const remaining = Math.max(0, Math.round((balance - amount) * 100) / 100), hindi = input.replyLanguage === "hi";
    return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: `${record.invoiceNumber} · ${record.customer?.displayName ?? record.customerName ?? "Unlinked counterparty"}`, changes: hindi ? { "प्राप्त रकम": `${record.currency} ${amount.toFixed(2)}`, "बाकी": `${record.currency} ${remaining.toFixed(2)}`, "तरीका": String(input.method), "तारीख": new Date(String(input.paidAt)).toISOString().slice(0, 10), "स्थिति": remaining <= 0.001 ? "पूरा भुगतान" : "आंशिक भुगतान" } : { receivedAmount: `${record.currency} ${amount.toFixed(2)}`, remainingBalance: `${record.currency} ${remaining.toFixed(2)}`, method: String(input.method), paidDate: new Date(String(input.paidAt)).toISOString().slice(0, 10), status: remaining <= 0.001 ? "Fully paid" : "Partially paid" }, consequence: hindi ? "यह उस पेमेंट को दर्ज करेगा जो आपको पहले से मिल चुका है। यह पेमेंट भेजेगा या कलेक्ट नहीं करेगा। पुष्टि से पहले इनवॉइस बैलेंस दोबारा जाँचा जाएगा।" : "This records funds you say were already received. It will not send or collect a payment. The invoice balance will be rechecked before saving.", externalEffect: false, href: "/finance?tab=invoices", targetVersion: input.targetVersion } };
  }
  if (name === "finance.expense_create") { const hindi = input.replyLanguage === "hi", date = new Date(String(input.expenseDate)).toISOString().slice(0, 10); return { arguments: input, preview: { toolName: name, service: tool.service, targetLabel: String(input.title), changes: hindi ? { "कैटेगरी": String(input.category), "रकम": `${String(input.currency).toUpperCase()} ${Number(input.amount).toFixed(2)}`, "विक्रेता": input.vendor ? String(input.vendor) : "नहीं दिया", "तारीख": date, "स्थिति": "दर्ज होगा" } : { category: String(input.category), amount: `${String(input.currency).toUpperCase()} ${Number(input.amount).toFixed(2)}`, vendor: input.vendor ? String(input.vendor) : "Not specified", date, status: "Recorded" }, consequence: hindi ? "यह एक आंतरिक खर्च दर्ज करेगा। कोई पेमेंट या बाहरी संदेश नहीं भेजा जाएगा और CRM कस्टमर नहीं बनेगा।" : "This records one internal expense with an optional free-text vendor. No payment will be made and no CRM customer will be created.", externalEffect: false, href: "/finance?tab=expenses" } }; }
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
  if (name === "finance.invoice_create") {
    if (input.customerId && !(await prisma.customer.findFirst({ where: { id: String(input.customerId), organizationId: context.organizationId, deletedAt: null }, select: { id: true } }))) throw new AppError(409, "The matched CRM customer changed. Review the invoice again.", "AGENT_ACTION_STALE");
    const record = await new FinanceService().createInvoice(context.organizationId, context.userId, { ...(input.customerId ? { customerId: input.customerId } : {}), customerName: input.customerId ? undefined : String(input.customerName), projectId: null, invoiceNumber: String(input.invoiceNumber), status: "DRAFT", issueDate: new Date(String(input.issueDate)), dueDate: new Date(String(input.dueDate)), currency: String(input.currency), discount: 0, tax: 0, notes: null, items: [{ description: String(input.description), quantity: Number(input.quantity), unitPrice: Number(input.unitPrice) }] });
    return { alreadyCompleted: false, id: record.id, label: record.invoiceNumber, href: "/finance?tab=invoices" };
  }
  if (name === "finance.invoice_issue") {
    if (!input.invoiceId || !input.targetVersion) throw new AppError(400, "Review the invoice before issuing it.", "AGENT_ACTION_STALE");
    const record = await new FinanceService().issueInvoice(context.organizationId, context.userId, input.invoiceId, new Date(input.targetVersion));
    return { alreadyCompleted: false, id: record.id, label: record.invoiceNumber, href: "/finance?tab=invoices", status: record.status };
  }
  if (name === "finance.payment_record") {
    if (!input.invoiceId || !input.targetVersion || input.amount === undefined || input.balanceAtPreview === undefined) throw new AppError(400, "Review the invoice balance before recording payment.", "AGENT_ACTION_STALE");
    const paymentResult = await new FinanceService().pay(context.organizationId, context.userId, input.invoiceId, { amount: input.amount, method: input.method as "CASH" | "BANK_TRANSFER" | "CARD" | "UPI" | "CHEQUE" | "OTHER", reference: input.reference || null, paidAt: new Date(String(input.paidAt)) }, new Date(input.targetVersion));
    const remaining = Math.max(0, Math.round((input.balanceAtPreview - input.amount) * 100) / 100);
    return { alreadyCompleted: false, id: paymentResult.id, label: String(input.invoiceNumber), href: "/finance?tab=invoices", amount: input.amount, remaining, fullyPaid: remaining <= 0.001 };
  }
  if (name === "finance.expense_create") {
    const record = await new FinanceService().expense(context.organizationId, context.userId, { projectId: null, title: String(input.title), category: String(input.category), vendor: input.vendor ? String(input.vendor) : null, amount: Number(input.amount), currency: String(input.currency), expenseDate: new Date(String(input.expenseDate)), status: "RECORDED", notes: null });
    return { alreadyCompleted: false, id: record.id, label: record.title, href: "/finance?tab=expenses" };
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
