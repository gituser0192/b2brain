import { test as base, expect, type Page, type Route } from "@playwright/test";

const NOW = "2026-09-02T09:00:00.000Z";
const PERMISSIONS = ["ORGANIZATION_UPDATE", "MEMBERSHIP_VIEW", "ROLE_VIEW", "APPROVAL_VIEW", "CRM_VIEW", "CRM_CREATE", "CRM_UPDATE", "CRM_ARCHIVE", "CRM_DELETE", "CRM_ACTIVITY_VIEW", "CRM_FOLLOWUP_MANAGE", "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_UPDATE", "PROJECT_ARCHIVE", "PROJECT_TASK_MANAGE", "FINANCE_VIEW", "FINANCE_MANAGE", "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "EMPLOYEE_VIEW"];
const SERVICES = ["B2BRAIN_AGENT", "ACTION_CENTRE", "GOVERNANCE", "CRM", "LEADS", "FINANCE", "PROJECTS", "PEOPLE", "AUTOMATION"];
export const ownerSession = {
  user: { id: "usr-e2e-owner", firstName: "Aarav", lastName: "Sharma", email: "owner.e2e@example.test", status: "ACTIVE", isPlatformAdmin: false },
  organization: { id: "org-e2e-safe", name: "E2E Safety Works", slug: "e2e-safety-works", status: "ACTIVE", timezone: "Asia/Kolkata", currency: "INR", isServiceProvider: false, onboardingCompleted: true },
  membership: { id: "mem-e2e-owner", role: { code: "ORGANIZATION_OWNER", name: "Organization Owner" }, permissions: PERMISSIONS },
};
export const employeeSession = { ...ownerSession, user: { ...ownerSession.user, id: "usr-e2e-employee", firstName: "Mira", email: "employee.e2e@example.test" }, membership: { id: "mem-e2e-employee", role: { code: "MEMBER", name: "Read-only Member" }, permissions: ["CRM_VIEW", "PROJECT_VIEW", "FINANCE_VIEW"] } };
const customer = { id: "cus-e2e-001", type: "COMPANY", displayName: "Synthetic Retail Co", firstName: null, lastName: null, companyName: "Synthetic Retail Co", email: "hello@example.test", phone: "+919999900001", website: "https://example.test", addressLine1: "Test Road", addressLine2: null, city: "Delhi", state: "Delhi", postalCode: "110001", country: "India", status: "ACTIVE", notes: "Synthetic Playwright fixture", createdAt: NOW, updatedAt: NOW, deletedAt: null };
const project = { id: "prj-e2e-001", name: "Synthetic Store Launch", code: "E2E-001", description: "Controlled browser-test project", status: "ACTIVE", priority: "HIGH", startDate: NOW, dueDate: "2026-09-30T00:00:00.000Z", deletedAt: null, customer: { id: customer.id, displayName: customer.displayName }, _count: { tasks: 1 } };
const task = { id: "tsk-e2e-001", title: "Review launch checklist", description: null, status: "TODO", priority: "HIGH", dueDate: "2026-09-10T00:00:00.000Z" };
const overdueTask = { id: "tsk-e2e-002", title: "Resolve blocked supplier handoff", description: null, status: "BLOCKED", priority: "URGENT", dueDate: "2026-08-28T00:00:00.000Z" };
const payment = { id: "pay-e2e-001", receiptNumber: "E2E-RCT-001", amount: "10000", refundedAmount: "0", paidAt: NOW };
const invoice = { id: "inv-e2e-001", invoiceNumber: "E2E-INV-001", status: "ISSUED", total: "25000", dueDate: "2026-09-15T00:00:00.000Z", paid: 10000, outstanding: 15000, daysOverdue: 0, currency: "INR", customer: { id: customer.id, displayName: customer.displayName }, payments: [payment], collectionFollowUps: [] };
const expense = { id: "exp-e2e-001", title: "Synthetic ad spend", category: "MARKETING", amount: "5000", expenseDate: "2026-09-01T00:00:00.000Z", vendor: "Example Ads", notes: "Fixture only", status: "RECORDED" };
const ledger = { records: [{ id: payment.id, type: "REVENUE", date: NOW, description: invoice.invoiceNumber, category: "INVOICE_PAYMENT", method: "BANK_TRANSFER", amount: 10000, currency: "INR" }, { id: expense.id, type: "EXPENSE", date: expense.expenseDate, description: expense.title, category: expense.category, method: null, amount: 5000, currency: "INR" }], metrics: { revenue: 10000, expenses: 5000, profit: 5000 }, monthly: [{ month: "2026-08", revenue: 8000, expenses: 3500, profit: 4500 }, { month: "2026-09", revenue: 10000, expenses: 5000, profit: 5000 }], categories: ["MARKETING"] };
const collection = { accounts: [{ id: "acc-e2e-001", name: "Synthetic Current Account", type: "BANK", identifier: "ending 001", isActive: true }], transactions: [{ id: "txn-e2e-001", externalReference: "UTR-E2E-001", payerName: "Synthetic Retail Co", amount: "10000", currency: "INR", receivedAt: NOW, status: "MATCHED", paymentAccount: { name: "Synthetic Current Account" }, payment: { receiptNumber: payment.receiptNumber, invoice: { invoiceNumber: invoice.invoiceNumber } } }], refunds: [], metrics: { activeAccounts: 1, unmatchedCount: 0, unmatchedValue: 0, matchedValue: 10000, pendingRefunds: 0 } };
const followUp = { id: "fup-e2e-001", title: "Confirm annual plan", description: "Synthetic follow-up fixture", status: "PENDING", dueAt: "2026-09-01T09:00:00.000Z", customer: { id: customer.id, displayName: customer.displayName, email: customer.email, phone: customer.phone }, assignedTo: { id: ownerSession.user.id, firstName: ownerSession.user.firstName, lastName: ownerSession.user.lastName } };
const automationConnector = { id: "con-e2e-whatsapp", name: "Synthetic WhatsApp Simulator", type: "WHATSAPP", provider: "B2BRAIN_SIMULATOR", status: "ACTIVE", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-webhook", lastReceivedAt: null, credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } };
function json(route: Route, data: unknown, status = 200) { return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) }); }

function fixture(path: string, method: string, session: typeof ownerSession) {
  const clean = path.split("?")[0];
  if (clean === "/auth/refresh" || clean === "/auth/login") return { success: true, data: { ...session, accessToken: "e2e-access-token" } };
  if (clean === "/auth/logout") return { success: true, data: null };
  if (clean === "/auth/me") return { success: true, data: session };
  if (clean.startsWith("/auth/registration-invitations/")) return { success: true, data: { email: "new.owner@example.test", organizationName: "Synthetic New Business", expiresAt: "2026-09-09T00:00:00.000Z", type: "NEW_ORGANIZATION" } };
  if (clean === "/auth/register") return { success: true, data: { user: { id: "usr-new", email: "new.owner@example.test" }, organization: { id: "org-new", name: "Synthetic New Business", status: "PENDING_APPROVAL" }, pendingApproval: true } };
  if (clean === "/services/enabled") return { success: true, data: SERVICES.map((code) => ({ code, name: code })) };
  if (clean === "/dashboard/summary") return { success: true, data: { periodDays: 30, enabledServices: SERVICES, currency: "INR", timezone: "Asia/Kolkata", metrics: { customers: 1, leads: 0, activeCustomers: 1, overdueFollowUps: 0, openDeals: 2, pipelineValue: 120000, weightedForecast: 70000, wonRevenue: 40000, activeProjects: 1, pendingTasks: 1, overdueTasks: 0, activeEmployees: 2, openInquiries: 1, invoiced: 25000, received: 10000, outstanding: 15000, expenses: 5000, netCash: 5000, currentMonthRevenue: 10000, currentMonthExpenses: 5000, currentMonthProfit: 5000, orders: 0, activeOrders: 0, orderValue: 0, stockOnHand: 0, stockReserved: 0, lowStock: 0, activeCampaigns: 0, marketingSpend: 0, marketingLeads: 0, conversions: 0, attributedRevenue: 0, returnOnSpend: 0, openTickets: 0, overdueTickets: 0 }, alerts: [], monthlyCash: ["04", "05", "06", "07", "08", "09"].map((month, index) => ({ month: `2026-${month}`, revenue: index * 2000, expenses: index * 800, profit: index * 1200 })), recent: { customers: [{ id: customer.id, displayName: customer.displayName, status: customer.status, createdAt: NOW }], projects: [{ id: project.id, name: project.name, code: project.code, status: project.status, updatedAt: NOW }], activities: [] } } };
  if (clean.endsWith("/engagement")) return { success: true, data: { activities: [], followUps: [] } };
  if (clean === `/customers/${customer.id}`) return { success: true, data: customer };
  if (clean === "/customers") return { success: true, data: { customers: [customer], pagination: { page: 1, pageSize: 50, total: 1, pages: 1 } } };
  if (clean === "/crm/follow-ups") return { success: true, data: { items: [followUp], metrics: { pending: 1, overdue: 1, dueToday: 0, completed: 0 } } };
  if (clean === "/projects" && method === "GET") return { success: true, data: [project] };
  if (clean === `/projects/${project.id}/tasks`) return { success: true, data: [task, overdueTask] };
  if (clean === `/projects/${project.id}/members`) return { success: true, data: [] };
  if (clean.startsWith("/projects")) return { success: true, data: project };
  if (clean === "/finance") return { success: true, data: { invoices: [invoice], expenses: [expense], metrics: { invoiced: 25000, received: 10000, outstanding: 15000, overdue: 0, expenses: 5000, netCash: 5000 } } };
  if (clean === "/finance/ledger") return { success: true, data: { records: [], metrics: { revenue: 10000, expenses: 5000, profit: 5000 }, monthly: [], categories: ["MARKETING"] } };
  if (clean === "/payment-collection") return { success: true, data: { accounts: [], transactions: [], refunds: [], metrics: { activeAccounts: 0, unmatchedCount: 0, unmatchedValue: 0, matchedValue: 10000, pendingRefunds: 0 } } };
  if (clean === "/settings") return { success: true, data: { user: session.user, organization: { ...session.organization, industry: "Retail", phone: "+919999900000", businessSize: "2_TO_10", monthlyRevenueRange: "5_TO_25_LAKH", primaryBusinessGoal: "GROW_SALES" }, membership: { ...session.membership, status: "ACTIVE", services: [] }, canManageBusiness: session.membership.role.code === "ORGANIZATION_OWNER" } };
  if (clean === "/workspace-agent/brief") return { success: true, data: { calculatedAt: NOW, period: "Last 30 days", meaningful: true, health: { score: 72, change: 4, missingData: [] }, finance: { revenue: 10000, expenses: 5000, profit: 5000, previousRevenue: 8000, previousExpenses: 4500, previousProfit: 3500 }, activity: { newCustomers: 1, newLeads: 0, overdueFollowUps: 0, overdueTasks: 0, atRiskProjects: 0, importantServiceRequests: 0 }, alerts: [], recommendations: [{ title: "Follow up on the active project", reason: "One task is pending", view: "projects" }] } };
  if (clean === "/workspace-agent/goals" || clean.startsWith("/workspace-agent/conversations/")) return { success: true, data: [] };
  if (clean === "/agents") return { success: true, data: [] };
  if (clean === "/agents/runs/centre") return { success: true, data: { items: [], metrics: { total: 0, awaitingApproval: 0, completed: 0, failed: 0, safeRuns: 0 } } };
  if (clean === "/business-knowledge") return { success: true, data: [] };
  if (clean === "/follow-up-automation") return { success: true, data: { sequences: [], enrollments: [], dueExecutions: [], inquiries: [], customers: [], metrics: { activeSequences: 0, activeEnrollments: 0, due: 0, awaitingApproval: 0 } } };
  if (clean === "/automation-policies") return { success: true, data: { policies: [], executions: [], metrics: {} } };
  if (clean === "/automation-bridge/email-deliveries") return { success: true, data: { smtpConfigured: false, connectors: [], ready: [], deliveries: [] } };
  if (clean === "/automation-bridge/whatsapp-workspace") return { success: true, data: { connectors: [], inquiries: [], conversations: [] } };
  if (clean === "/automation-bridge/message-drafts") return { success: true, data: [] };
  if (clean === "/automation-bridge") return { success: true, data: { connectors: [], events: [], metrics: { received: 0, processed: 0, failed: 0, quarantined: 0 } } };
  return { success: true, data: method === "GET" ? [] : { id: "synthetic-result" } };
}

export async function installSyntheticApi(page: Page, options: { authenticated?: boolean; restricted?: boolean; delayDashboard?: number; failDashboard?: boolean; delayCustomers?: number; failCustomers?: boolean; emptyCustomers?: boolean; delayProjects?: number; failProjects?: boolean; emptyProjects?: boolean; delayFinance?: number; failFinance?: boolean; emptyFinance?: boolean; richFinance?: boolean; richAutomation?: boolean } = {}) {
  const authenticated = options.authenticated ?? true;
  const session = options.restricted ? employeeSession : ownerSession;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}`;
    const clean = path.split("?")[0];
    if (clean === "/auth/refresh" && !authenticated) return json(route, { message: "Authentication required." }, 401);
    if (clean === "/dashboard/summary" && options.delayDashboard) await new Promise((resolve) => setTimeout(resolve, options.delayDashboard));
    if (clean === "/dashboard/summary" && options.failDashboard) return json(route, { message: "Synthetic dashboard failure." }, 503);
    if (clean === "/customers" && options.delayCustomers) await new Promise((resolve) => setTimeout(resolve, options.delayCustomers));
    if (clean === "/customers" && options.failCustomers) return json(route, { message: "Synthetic CRM failure." }, 503);
    if (clean === "/customers" && options.emptyCustomers) return json(route, { success: true, data: { customers: [], pagination: { page: 1, pageSize: 50, total: 0, pages: 0 } } });
    if (clean === "/projects" && options.delayProjects) await new Promise((resolve) => setTimeout(resolve, options.delayProjects));
    if (clean === "/projects" && options.failProjects) return json(route, { message: "Synthetic projects failure." }, 503);
    if (clean === "/projects" && options.emptyProjects) return json(route, { success: true, data: [] });
    if (["/finance", "/finance/ledger", "/payment-collection"].includes(clean) && options.delayFinance) await new Promise((resolve) => setTimeout(resolve, options.delayFinance));
    if (["/finance", "/finance/ledger", "/payment-collection"].includes(clean) && options.failFinance) return json(route, { message: "Synthetic finance failure." }, 503);
    if (clean === "/finance" && options.emptyFinance) return json(route, { success: true, data: { invoices: [], expenses: [], metrics: { invoiced: 0, received: 0, outstanding: 0, overdue: 0, expenses: 0, netCash: 0 } } });
    if (clean === "/finance/ledger" && options.emptyFinance) return json(route, { success: true, data: { records: [], metrics: { revenue: 0, expenses: 0, profit: 0 }, monthly: [], categories: [] } });
    if (clean === "/payment-collection" && options.emptyFinance) return json(route, { success: true, data: { accounts: [], transactions: [], refunds: [], metrics: { activeAccounts: 0, unmatchedCount: 0, unmatchedValue: 0, matchedValue: 0, pendingRefunds: 0 } } });
    if (clean === "/finance/ledger" && options.richFinance) return json(route, { success: true, data: ledger });
    if (clean === "/payment-collection" && options.richFinance) return json(route, { success: true, data: collection });
    if (clean === "/automation-bridge" && options.richAutomation) return json(route, { success: true, data: { connectors: [automationConnector], events: [], metrics: { received: 0, processed: 0, failed: 0, quarantined: 0 } } });
    return json(route, fixture(path, route.request().method(), session));
  });
}

export const test = base.extend<{ syntheticPage: Page }>({
  syntheticPage: async ({ page }, provide) => {
    await installSyntheticApi(page);
    await provide(page);
  },
});
export { expect };
