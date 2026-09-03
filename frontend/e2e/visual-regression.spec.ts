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
    await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible();
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
  await page.getByRole("button", { name: "Follow-ups" }).click();
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

test("sidebar and mobile drawer visual baseline", async ({ page }, testInfo) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Open service menu" }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
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
