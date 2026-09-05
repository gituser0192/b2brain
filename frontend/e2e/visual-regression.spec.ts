import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

for (const item of [
  { name: "login", url: "/login", heading: "Sign in to your workspace" },
  { name: "dashboard", url: "/dashboard", heading: /Good (morning|afternoon|evening), Aarav/ },
  { name: "crm-list", url: "/dashboard?view=crm", heading: "Customers" },
  { name: "projects", url: "/dashboard?view=projects", heading: "Projects & tasks" },
  { name: "finance", url: "/dashboard?view=finance", heading: "Accounts receivable" },
  { name: "automation", url: "/dashboard?view=automation", heading: "Build intelligence on a controlled frame." },
  { name: "business-agent", url: "/dashboard?view=b2agent", heading: "Ask B² Brain" },
  { name: "settings", url: "/dashboard?view=settings", heading: "Settings" },
] as const) {
  test(`${item.name} visual baseline`, async ({ page }) => {
    await installSyntheticApi(page, { authenticated: item.name !== "login" });
    await page.goto(item.url);
    const content = item.name === "login" ? page : page.locator(".dashboard-main > :not(.dashboard-header)");
    await expect(content.getByRole("heading", { name: item.heading }).first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${item.name}.png`, { mask: [page.locator(".dashboard-date")] });
  });
}

test("customer details visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard?view=crm");
  await page.getByText("Synthetic Retail Co").first().click();
  await expect(page.getByRole("heading", { name: "Synthetic Retail Co" })).toBeVisible();
  await expect(page).toHaveScreenshot("customer-details.png");
});

test("important customer form modal visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard?view=crm");
  await page.getByRole("button", { name: /Add customer/i }).click();
  await expect(page.getByRole("heading", { name: "Add a customer" })).toBeVisible();
  await expect(page).toHaveScreenshot("customer-form-modal.png");
});

test("CRM follow-up centre visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/crm");
  await page.getByRole("button", { name: "Follow-up due" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up center" })).toBeVisible();
  await expect(page.getByText("Confirm annual plan")).toBeVisible();
  await expect(page).toHaveScreenshot("crm-follow-up-centre.png");
});

test("CRM empty state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { emptyCustomers: true });
  await page.goto("/crm");
  await expect(page.getByRole("heading", { name: "Your CRM is ready" })).toBeVisible();
  await expect(page).toHaveScreenshot("crm-empty.png");
});

test("CRM loading state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { delayCustomers: 1200 });
  await page.goto("/crm");
  await expect(page.getByText("Loading customers…")).toBeVisible();
  await expect(page).toHaveScreenshot("crm-loading.png");
});

test("CRM error state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { failCustomers: true });
  await page.goto("/crm");
  await expect(page.getByText("Synthetic CRM failure.")).toBeVisible();
  await expect(page).toHaveScreenshot("crm-error.png");
});

test("new project modal visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page.getByRole("heading", { name: "Create project" })).toBeVisible();
  await expect(page).toHaveScreenshot("project-form-modal.png");
});

test("project details and tasks visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/projects/prj-e2e-001");
  await expect(page.getByRole("heading", { name: "Synthetic Store Launch" }).first()).toBeVisible();
  await expect(page.getByText("Resolve blocked supplier handoff")).toBeVisible();
  await expect(page).toHaveScreenshot("project-details-tasks.png");
});

test("projects empty state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { emptyProjects: true });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await expect(page).toHaveScreenshot("projects-empty.png");
});

test("projects delayed-load characterization baseline", async ({ page }) => {
  await installSyntheticApi(page, { delayProjects: 1200 });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await expect(page).toHaveScreenshot("projects-delayed-load.png");
});

test("projects error state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { failProjects: true });
  await page.goto("/projects");
  await expect(page.getByText("Synthetic projects failure.")).toBeVisible();
  await expect(page).toHaveScreenshot("projects-error.png");
});

test("Finance populated ledger and payment collection visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { richFinance: true });
  await page.goto("/finance");
  await expect(page.getByText("UTR-E2E-001")).toBeVisible();
  await expect(page.getByText("E2E-RCT-001", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("finance-populated.png", { mask: [page.locator(".dashboard-date")] });
});

test("Finance invoice form visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/finance");
  await page.getByRole("button", { name: "+ Invoice" }).click();
  await expect(page.getByRole("heading", { name: "Create invoice" })).toBeVisible();
  await expect(page).toHaveScreenshot("finance-invoice-form.png");
});

test("Finance expense edit form visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/finance");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Record expense" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update expense" })).toBeVisible();
  await expect(page).toHaveScreenshot("finance-expense-edit-form.png");
});

test("Finance payment form and status visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/finance");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("heading", { name: /Record payment · E2E-INV-001/ })).toBeVisible();
  await expect(page).toHaveScreenshot("finance-payment-form.png");
});

test("Finance empty state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { emptyFinance: true });
  await page.goto("/finance");
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await expect(page.getByText("No expenses yet")).toBeVisible();
  await expect(page).toHaveScreenshot("finance-empty.png", { mask: [page.locator(".dashboard-date")] });
});

test("Finance delayed-load characterization baseline", async ({ page }) => {
  await installSyntheticApi(page, { delayFinance: 1200 });
  await page.goto("/finance");
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await expect(page).toHaveScreenshot("finance-delayed-load.png", { mask: [page.locator(".dashboard-date")] });
});

test("Finance error state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { failFinance: true });
  await page.goto("/finance");
  await expect(page.getByText(/Synthetic finance failure.|Unable to load finance records./).first()).toBeVisible();
  await expect(page).toHaveScreenshot("finance-error.png", { mask: [page.locator(".dashboard-date")] });
});

test("Automation bridge and connector configuration visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/automation");
  await expect(page.getByRole("heading", { name: "B² Automation Bridge" })).toBeVisible();
  await page.getByRole("button", { name: "New connector" }).click();
  await expect(page.getByRole("heading", { name: "Create connector" })).toBeVisible();
  await expect(page).toHaveScreenshot("automation-connector-dialog.png", { mask: [page.locator(".dashboard-date")] });
});

test("Automation WhatsApp simulator configuration visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { richAutomation: true });
  await page.goto("/automation");
  await page.getByRole("button", { name: "Simulate WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "WhatsApp CRM Intake Simulator" })).toBeVisible();
  await expect(page.locator(".agent-dialog")).toHaveScreenshot("automation-whatsapp-simulator-dialog.png", { mask: [page.getByLabel("External WhatsApp message ID")] });
});

test("Automation follow-up and policy empty states visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/automation");
  const followUps = page.locator(".follow-up-automation");
  const policies = page.locator(".policy-manager");
  await expect(followUps.getByText("No sequences configured")).toBeVisible();
  await expect(policies.getByText("No automation policies yet")).toBeVisible();
  await expect(followUps).toHaveScreenshot("automation-follow-up-empty.png");
  await expect(policies).toHaveScreenshot("automation-policy-empty.png");
});

test("Automation collection schedule empty state visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/automation");
  const schedule = page.locator(".collection-schedule-manager");
  await expect(schedule.getByText("No Finance agent found")).toBeVisible();
  await expect(schedule).toHaveScreenshot("automation-collection-schedule-empty.png");
});

test("Automation loading state visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/agents/runs/centre", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { items: [], metrics: { total: 0, awaitingApproval: 0, completed: 0, failed: 0, safeRuns: 0 } } }) });
  });
  await page.goto("/automation");
  const runCentre = page.locator(".agent-run-centre");
  await expect(runCentre.getByText("Loading verified agent history…")).toBeVisible();
  await expect(runCentre).toHaveScreenshot("automation-loading.png");
});

test("Automation error state visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/automation-policies", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Synthetic automation failure." }) }));
  await page.goto("/automation");
  const policies = page.locator(".policy-manager");
  await expect(policies.getByText("Unable to load automation policies.")).toBeVisible();
  await expect(policies).toHaveScreenshot("automation-error.png");
});

test("Business Operating Agent floating drawer visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  await expect(page.locator(".workspace-agent-drawer")).toBeVisible();
  await expect(page.locator(".workspace-agent-drawer").getByRole("heading", { name: "Start a new conversation" })).toBeVisible();
  await expect(page).toHaveScreenshot("workspace-agent-drawer.png", { mask: [page.locator(".dashboard-date")] });
});

test("Business Operating Agent goals visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/goals", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [{ id: "goal-e2e-001", type: "MONTHLY_REVENUE", title: "Reach the monthly revenue target", targetValue: 200000, currentValue: 125000, progress: 62.5, requiredPace: 2500, risk: "ON_TRACK", periodEnd: "2026-09-30T23:59:59.999Z" }] }) }));
  await page.goto("/agent");
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await expect(page.getByText("Reach the monthly revenue target")).toBeVisible();
  await expect(page).toHaveScreenshot("workspace-agent-goals.png", { mask: [page.locator(".dashboard-date")] });
});

test("Business Operating Agent rich conversation visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  const output = { answer: "Revenue is improving, but two overdue actions need attention.", metrics: [{ label: "New customers", value: 8 }, { label: "Open follow-ups", value: 2 }], health: { overall: 76, components: [{ name: "Financial health", score: 82, evidence: "Profit remained positive for the selected period." }, { name: "Execution health", score: 68, evidence: "Two follow-ups are overdue." }], warnings: [], recommendations: ["Complete overdue follow-ups today."] }, finance: { currency: "INR", current: { revenue: 125000, expenses: 70000, profit: 55000 }, margin: 44, score: 82 }, forecast: { method: "Recent monthly run rate", dateRange: "Sep 2026", confidence: "MEDIUM", assumptions: ["Current conversion rate remains stable"] }, warnings: ["Two follow-ups require attention."], records: [{ type: "CUSTOMER", id: "cus-e2e-001", label: "Synthetic Retail Co" }], escalation: { id: "req-e2e-001", requestNumber: "B2-E2E-001", status: "OPEN" }, reasoning: { source: "DETERMINISTIC_FALLBACK", confidence: "MEDIUM", evidence: [{ id: "revenue", label: "Current revenue", value: 125000, period: "Sep 2026" }], conclusions: ["Revenue exceeds recorded expenses."], recommendations: [{ action: "Contact overdue customers", reason: "Two follow-ups are overdue", expectedImpact: "Improve collections" }], assumptions: ["Recorded transactions are complete"], missingData: [], proposedToolActions: ["CREATE_FOLLOW_UP"], requiresConfirmation: true, requiresHumanEscalation: true } };
  const items = Array.from({ length: 4 }, (_, index) => ({ id: `agent-item-${index}`, createdAt: "2026-09-02T09:00:00.000Z", message: index ? `Review business performance update ${index + 1}` : "Review business health, finances and next actions", output }));
  await page.route("**/api/v1/workspace-agent/conversations/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: items }) }));
  await page.goto("/agent");
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(page.getByText("Revenue is improving, but two overdue actions need attention.").first()).toBeVisible();
  await page.locator(".workspace-agent-answer details").first().evaluate((element: HTMLDetailsElement) => { element.open = true; });
  await expect(page.locator(".workspace-agent-thread")).toHaveScreenshot("workspace-agent-rich-conversation.png");
});

test("Business Operating Agent alert visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/brief", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { calculatedAt: "2026-09-02T09:00:00.000Z", period: "Last 30 days", meaningful: true, health: { score: 64, change: -4, missingData: ["Expense categorization is incomplete."] }, finance: { revenue: 100000, expenses: 72000, profit: 28000, previousRevenue: 110000, previousExpenses: 68000, previousProfit: 42000 }, activity: { newCustomers: 3, newLeads: 5, overdueFollowUps: 2, overdueTasks: 1, atRiskProjects: 1, importantServiceRequests: 1 }, alerts: [{ code: "OVERDUE_FOLLOWUPS", title: "Customer follow-ups are overdue", why: "Delayed responses can reduce conversion.", evidence: "2 follow-ups are overdue", period: "Today", severity: "HIGH", action: "Review follow-ups", view: "crm" }], recommendations: [{ title: "Review overdue follow-ups", reason: "Two customer actions are waiting", view: "crm" }] } }) }));
  await page.goto("/agent");
  await expect(page.getByText("Customer follow-ups are overdue")).toBeVisible();
  await expect(page).toHaveScreenshot("workspace-agent-alerts.png", { mask: [page.locator(".dashboard-date")] });
});

test("Business Operating Agent loading visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/conversations/**", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1200)); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) }); });
  await page.goto("/agent");
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(page.getByText("Ask B² Brain is checking permitted data…")).toBeVisible();
  await expect(page.locator(".workspace-agent")).toHaveScreenshot("workspace-agent-loading.png");
});

test("Business Operating Agent error visual baseline", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/brief", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Synthetic agent failure." }) }));
  await page.goto("/agent");
  await expect(page.getByText("Synthetic agent failure.")).toBeVisible();
  await expect(page.locator(".workspace-agent")).toHaveScreenshot("workspace-agent-error.png");
});

test("sidebar and mobile drawer visual baseline", async ({ page }, testInfo) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog", { name: "More destinations" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  }
  await expect(page).toHaveScreenshot("sidebar-expanded.png");
});

test("loading state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { delayDashboard: 1200 });
  await page.goto("/dashboard");
  await expect(page.getByText("Calculating your business…")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-loading.png");
});

test("error state visual baseline", async ({ page }) => {
  await installSyntheticApi(page, { failDashboard: true });
  await page.goto("/dashboard");
  await expect(page.getByText("Synthetic dashboard failure.")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-error.png");
});
