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
