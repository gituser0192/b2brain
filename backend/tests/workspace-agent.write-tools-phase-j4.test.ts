import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({ customer: vi.fn(), customerMatches: vi.fn(), invoice: vi.fn(), project: vi.fn(), inquiry: vi.fn(), employee: vi.fn(), membership: vi.fn() }));
const mutations = vi.hoisted(() => ({ customer: vi.fn(), followUp: vi.fn(), task: vi.fn(), assignment: vi.fn(), invoice: vi.fn(), expense: vi.fn(), issue: vi.fn(), pay: vi.fn() }));
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: access }));
vi.mock("../src/database/prisma.js", () => ({ prisma: { customer: { findFirst: db.customer, findMany: db.customerMatches }, invoice: { findFirst: db.invoice }, project: { findFirst: db.project }, inquiry: { findFirst: db.inquiry }, employee: { findFirst: db.employee }, organizationMembership: { findFirst: db.membership } } }));
vi.mock("../src/modules/customers/customer.service.js", () => ({ CustomerService: class { create = mutations.customer; } }));
vi.mock("../src/modules/customer-engagement/engagement.service.js", () => ({ EngagementService: class { createFollowUp = mutations.followUp; } }));
vi.mock("../src/modules/projects/project.service.js", () => ({ ProjectService: class { createTask = mutations.task; } }));
vi.mock("../src/modules/inquiries/lead-assignment.service.js", () => ({ LeadAssignmentService: class { manualAssign = mutations.assignment; } }));
vi.mock("../src/modules/finance/finance.service.js", () => ({ FinanceService: class { createInvoice = mutations.invoice; expense = mutations.expense; issueInvoice = mutations.issue; pay = mutations.pay; } }));
import { executeWorkspaceAgentWriteTool, previewWorkspaceAgentWriteTool, workspaceAgentWriteTools } from "../src/modules/workspace-agent/workspace-agent.write-tools.js";

const context = { organizationId: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000002", membershipId: "00000000-0000-4000-8000-000000000003", roleCode: "ORGANIZATION_OWNER", permissions: ["CRM_FOLLOWUP_MANAGE", "TASK_MANAGE", "INQUIRY_MANAGE", "FINANCE_MANAGE"] };
const version = "2026-09-15T10:00:00.000Z";

describe("workspace Agent controlled write tools", () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockResolvedValue("READ_WRITE"); db.customerMatches.mockResolvedValue([]); });
  it("registers only confirmation-gated internal writes", () => {
    expect(Object.keys(workspaceAgentWriteTools)).toEqual(["crm.customer_create", "crm.follow_up_create", "projects.task_create", "leads.assign", "finance.invoice_create", "finance.invoice_issue", "finance.payment_record", "finance.expense_create"]);
    for (const tool of Object.values(workspaceAgentWriteTools)) expect(tool).toMatchObject({ mode: "WRITE", confirmation: "REQUIRED", externalEffect: false });
  });
  it("previews a follow-up without mutating and binds the current version", async () => {
    db.customer.mockResolvedValue({ displayName: "Synthetic Customer", updatedAt: new Date(version) });
    const result = await previewWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-12-20T10:00:00.000Z" });
    expect(result.preview).toMatchObject({ targetLabel: "Synthetic Customer", externalEffect: false, targetVersion: version });
    expect(Object.values(mutations).every((mutation) => mutation.mock.calls.length === 0)).toBe(true);
    expect(access).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: context.organizationId }), "B2BRAIN_AGENT");
    expect(access).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: context.organizationId }), "CRM", "CRM_FOLLOWUP_MANAGE");
  });
  it("executes through the authoritative follow-up service after reauthorization", async () => {
    db.customer.mockResolvedValue({ updatedAt: new Date(version) }); mutations.followUp.mockResolvedValue({ id: "follow-up", title: "Call customer" });
    await expect(executeWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-12-20T10:00:00.000Z", targetVersion: version })).resolves.toMatchObject({ id: "follow-up", alreadyCompleted: false });
    expect(mutations.followUp).toHaveBeenCalledTimes(1);
  });
  it("refuses a stale target", async () => {
    db.customer.mockResolvedValue({ updatedAt: new Date("2026-09-15T11:00:00.000Z") });
    await expect(executeWorkspaceAgentWriteTool(context, "crm.follow_up_create", { customerId: "00000000-0000-4000-8000-000000000010", title: "Call customer", dueAt: "2026-12-20T10:00:00.000Z", targetVersion: version })).rejects.toMatchObject({ code: "AGENT_ACTION_STALE" });
    expect(mutations.followUp).not.toHaveBeenCalled();
  });
  it("previews an unlinked draft invoice using Finance permission without creating a CRM customer", async () => {
    db.customerMatches.mockResolvedValue([]);
    const result = await previewWorkspaceAgentWriteTool(context, "finance.invoice_create", { customerName: "Walk-in customer", invoiceNumber: "INV-TEST-1", issueDate: "2026-11-18T00:00:00.000Z", dueDate: "2026-12-18T00:00:00.000Z", currency: "INR", description: "Repair", quantity: 1, unitPrice: 250 });
    expect(result.preview).toMatchObject({ targetLabel: "Walk-in customer", externalEffect: false, changes: { status: "Draft only", total: "INR 250.00" } });
    expect(access).toHaveBeenNthCalledWith(2, expect.anything(), "FINANCE", "FINANCE_MANAGE");
    expect(mutations.customer).not.toHaveBeenCalled();
    expect(mutations.invoice).not.toHaveBeenCalled();
  });
  it("requires Finance manage access and persists only a confirmed draft invoice", async () => {
    access.mockResolvedValueOnce("READ_WRITE").mockRejectedValueOnce(new Error("forbidden"));
    await expect(previewWorkspaceAgentWriteTool({ ...context, permissions: [] }, "finance.expense_create", { title: "Office supplies", category: "Office", amount: 500, currency: "INR", expenseDate: "2026-11-18T00:00:00.000Z" })).rejects.toThrow("forbidden");
    mutations.invoice.mockResolvedValue({ id: "invoice-1", invoiceNumber: "INV-TEST-1" });
    await expect(executeWorkspaceAgentWriteTool(context, "finance.invoice_create", { customerName: "Walk-in customer", invoiceNumber: "INV-TEST-1", issueDate: "2026-11-18T00:00:00.000Z", dueDate: "2026-12-18T00:00:00.000Z", currency: "INR", description: "Repair", quantity: 1, unitPrice: 250, replyLanguage: "hi" })).resolves.toMatchObject({ id: "invoice-1", label: "INV-TEST-1", alreadyCompleted: false });
    expect(mutations.invoice).toHaveBeenCalledWith(context.organizationId, context.userId, expect.objectContaining({ customerName: "Walk-in customer", status: "DRAFT" }));
    expect(mutations.invoice.mock.calls[0]?.[2]).not.toHaveProperty("customerId");
    expect(mutations.customer).not.toHaveBeenCalled();
  });
  it("records a confirmed expense through Finance only and never creates a CRM customer", async () => {
    mutations.expense.mockResolvedValue({ id: "expense-1", title: "Office supplies" });
    await expect(executeWorkspaceAgentWriteTool(context, "finance.expense_create", { title: "Office supplies", category: "Office", amount: 500, currency: "INR", expenseDate: "2026-11-18T00:00:00.000Z", vendor: "Local shop" })).resolves.toMatchObject({ id: "expense-1", alreadyCompleted: false });
    expect(mutations.expense).toHaveBeenCalledWith(context.organizationId, context.userId, expect.objectContaining({ vendor: "Local shop", status: "RECORDED" }));
    expect(mutations.customer).not.toHaveBeenCalled();
  });
  it("links an exact existing CRM customer to the draft invoice without creating a duplicate", async () => {
    db.customerMatches.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000020", displayName: "Neha Sharma" }]);
    const prepared = await previewWorkspaceAgentWriteTool(context, "finance.invoice_create", { customerName: "neha sharma", invoiceNumber: "INV-TEST-2", issueDate: "2026-11-18T00:00:00.000Z", dueDate: "2026-12-18T00:00:00.000Z", currency: "INR", description: "Consultation", quantity: 1, unitPrice: 250 });
    expect(prepared.preview).toMatchObject({ targetLabel: "Neha Sharma", changes: { customerMatch: "Existing CRM customer" } });
    mutations.invoice.mockResolvedValue({ id: "invoice-linked", invoiceNumber: "INV-TEST-2" });
    await executeWorkspaceAgentWriteTool(context, "finance.invoice_create", prepared.arguments);
    expect(mutations.invoice).toHaveBeenCalledWith(context.organizationId, context.userId, expect.objectContaining({ customerId: "00000000-0000-4000-8000-000000000020", customerName: undefined }));
    expect(mutations.customer).not.toHaveBeenCalled();
  });
  it("refuses ambiguous same-name invoice matches instead of guessing", async () => {
    db.customerMatches.mockResolvedValue([{ id: "one", displayName: "Neha Sharma" }, { id: "two", displayName: "Neha Sharma" }]);
    await expect(previewWorkspaceAgentWriteTool(context, "finance.invoice_create", { customerName: "Neha Sharma", invoiceNumber: "INV-TEST-3", issueDate: "2026-11-18T00:00:00.000Z", dueDate: "2026-12-18T00:00:00.000Z", currency: "INR", description: "Consultation", quantity: 1, unitPrice: 250 })).rejects.toMatchObject({ code: "AGENT_CUSTOMER_MATCH_AMBIGUOUS" });
  });
  it("previews half payment against an issued finance-only invoice and records it through Finance", async () => {
    db.invoice.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000030", invoiceNumber: "INV-TEST-4", customerId: null, customerName: "Walk-in", customer: null, status: "ISSUED", total: "2500.00", currency: "INR", dueDate: new Date("2026-12-18T00:00:00.000Z"), updatedAt: new Date(version), payments: [] });
    const prepared = await previewWorkspaceAgentWriteTool(context, "finance.payment_record", { invoiceNumber: "inv-test-4", amountMode: "HALF", method: "CASH", paidAt: "2026-11-20T00:00:00.000Z", replyLanguage: "en" });
    expect(prepared.preview).toMatchObject({ targetLabel: "INV-TEST-4 · Walk-in", changes: { receivedAmount: "INR 1250.00", remainingBalance: "INR 1250.00", status: "Partially paid" }, externalEffect: false });
    expect(prepared.arguments).toMatchObject({ invoiceId: "00000000-0000-4000-8000-000000000030", amount: 1250, balanceAtPreview: 2500, targetVersion: version });
    mutations.pay.mockResolvedValue({ id: "payment-1" });
    await expect(executeWorkspaceAgentWriteTool(context, "finance.payment_record", prepared.arguments)).resolves.toMatchObject({ id: "payment-1", label: "INV-TEST-4", amount: 1250, remaining: 1250, fullyPaid: false });
    expect(mutations.pay).toHaveBeenCalledWith(context.organizationId, context.userId, "00000000-0000-4000-8000-000000000030", { amount: 1250, method: "CASH", reference: null, paidAt: new Date("2026-11-20T00:00:00.000Z") }, new Date(version));
  });
  it("uses the remaining balance for full payment and rejects draft or excessive amounts", async () => {
    const invoiceRecord = { id: "00000000-0000-4000-8000-000000000031", invoiceNumber: "004", customerId: null, customerName: "Walk-in", customer: null, status: "PARTIALLY_PAID", total: "2500.00", currency: "INR", dueDate: new Date("2026-12-18T00:00:00.000Z"), updatedAt: new Date(version), payments: [{ amount: "1000.00", refundedAmount: "0.00" }] };
    db.invoice.mockResolvedValue(invoiceRecord);
    const full = await previewWorkspaceAgentWriteTool(context, "finance.payment_record", { invoiceNumber: "004", amountMode: "FULL", paidAt: "2026-11-20T00:00:00.000Z" });
    expect(full.preview.changes).toMatchObject({ receivedAmount: "INR 1500.00", remainingBalance: "INR 0.00", status: "Fully paid" });
    await expect(previewWorkspaceAgentWriteTool(context, "finance.payment_record", { invoiceNumber: "004", amount: 1501, paidAt: "2026-11-20T00:00:00.000Z" })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_INVALID" });
    db.invoice.mockResolvedValue({ ...invoiceRecord, status: "DRAFT" });
    await expect(previewWorkspaceAgentWriteTool(context, "finance.payment_record", { invoiceNumber: "004", amountMode: "FULL", paidAt: "2026-11-20T00:00:00.000Z" })).rejects.toMatchObject({ code: "INVOICE_NOT_ISSUED" });
  });
  it("issues a draft only after an organization-scoped preview and version check", async () => {
    db.invoice.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000032", invoiceNumber: "INV-DRAFT", customerName: "Walk-in", customer: null, status: "DRAFT", total: "500.00", currency: "INR", dueDate: new Date("2026-12-18T00:00:00.000Z"), updatedAt: new Date(version) });
    const prepared = await previewWorkspaceAgentWriteTool(context, "finance.invoice_issue", { invoiceNumber: "inv-draft", replyLanguage: "hi" });
    expect(prepared.preview).toMatchObject({ changes: { "स्थिति": "ड्राफ़्ट से जारी" }, targetVersion: version });
    mutations.issue.mockResolvedValue({ id: "invoice-issued", invoiceNumber: "INV-DRAFT", status: "ISSUED" });
    await expect(executeWorkspaceAgentWriteTool(context, "finance.invoice_issue", prepared.arguments)).resolves.toMatchObject({ id: "invoice-issued", status: "ISSUED" });
    expect(mutations.issue).toHaveBeenCalledWith(context.organizationId, context.userId, "00000000-0000-4000-8000-000000000032", new Date(version));
  });
});
