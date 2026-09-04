import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "Behavior journeys run once; responsive rendering is covered by all viewport projects."));

test("invitation registration and sign-in use controlled synthetic data", async ({ page }) => {
  await installSyntheticApi(page, { authenticated: false });
  await page.goto("/signup?token=e2e-invitation-token");
  await expect(page.getByText("Synthetic New Business")).toBeVisible();
  await page.getByLabel("First name").fill("Nisha");
  await page.getByLabel(/Last name/).fill("Test");
  await page.locator('input[type="password"]').fill("Synthetic123!");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page.getByRole("heading", { name: "Registration submitted" })).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner.e2e@example.test");
  await page.locator('input[type="password"]').fill("Synthetic123!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("dashboard navigation, history, refresh, CRM details, projects and tasks", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aarav/ })).toBeVisible();
  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page).toHaveURL(/\/crm$/);
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
  await page.getByText("Synthetic Retail Co").first().click();
  await expect(page).toHaveURL(/\/crm\/customers\/cus-e2e-001$/);
  await expect(page.getByRole("heading", { name: "Synthetic Retail Co" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/crm\/customers\/cus-e2e-001$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/crm$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/crm$/);
  await page.getByRole("link", { name: /Projects$/ }).click();
  await expect(page.getByText("Synthetic Store Launch").first()).toBeVisible();
  await page.getByText("Synthetic Store Launch").first().click();
  await expect(page).toHaveURL(/\/projects\/prj-e2e-001$/);
  await expect(page.getByText("Review launch checklist")).toBeVisible();
});

test("finance, automation, operating agent and settings load", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard?view=finance");
  await expect(page.getByRole("heading", { name: "Accounts receivable" })).toBeVisible();
  await expect(page.getByText("E2E-INV-001", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/finance$/);
  await page.getByRole("link", { name: /Automation$/ }).click();
  await expect(page.getByRole("heading", { name: "Build intelligence on a controlled frame." })).toBeVisible();
  await page.getByRole("link", { name: "Business Agent" }).click();
  await expect(page.getByText("Business Operating Agent").first()).toBeVisible();
  await page.getByRole("link", { name: /Settings$/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Business name" })).toHaveValue("E2E Safety Works");
});

test("restricted employee cannot see owner controls or mutate CRM", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true });
  await page.goto("/dashboard?view=crm");
  await expect(page.getByRole("button", { name: "Access & Team" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add customer/i })).toHaveCount(0);
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
});

test("CRM search, status filter and row actions remain operable", async ({ syntheticPage: page }) => {
  await page.goto("/crm");
  const search = page.getByPlaceholder("Search name, email, phone or company");
  await search.fill("Synthetic");
  await expect(search).toHaveValue("Synthetic");
  await page.getByRole("combobox").selectOption("ACTIVE");
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919999900001");
  await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:hello@example.test");
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Retail Co" })).toBeVisible();
});

test("sign-out clears the session and protected routes redirect", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard?view=settings");
  await page.getByRole("button", { name: "Sign out this browser" }).click();
  await expect(page).toHaveURL(/\/login/);
  const anonymous = await page.context().newPage();
  await installSyntheticApi(anonymous, { authenticated: false });
  await anonymous.goto("/dashboard?view=crm");
  await expect(anonymous).toHaveURL(/\/login/);
});

test("migrated deep links, legacy links, active state and auth restoration remain stable", async ({ page }) => {
  let refreshRequests = 0;
  await installSyntheticApi(page);
  page.on("request", (request) => { if (request.url().endsWith("/auth/refresh")) refreshRequests += 1; });
  for (const [route, heading] of [["/crm", "Customers"], ["/projects", "Projects & tasks"], ["/finance", "Accounts receivable"], ["/automation", "Build intelligence on a controlled frame."], ["/agent", "Ask B² Brain"], ["/settings", "Settings"]] as const) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
  await page.goto("/dashboard?view=crm");
  await expect(page).toHaveURL(/\/crm$/);
  await expect(page.getByRole("link", { name: "Customers" })).toHaveClass(/active/);
  await page.goto("/dashboard?view=projects");
  await expect(page).toHaveURL(/\/projects$/);
  expect(refreshRequests).toBe(14);
});

test("direct restricted route shows the safe access experience", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true });
  await page.goto("/automation");
  await expect(page.getByText("Access unavailable", { exact: true })).toBeVisible();
});

test("primary client navigation preserves the shell and does not repeat auth restoration", async ({ page }) => {
  const counts = new Map<string, number>();
  await installSyntheticApi(page);
  page.on("request", (request) => { const path = new URL(request.url()).pathname; if (path.startsWith("/api/v1/")) counts.set(path, (counts.get(path) ?? 0) + 1); });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aarav/ })).toBeVisible();
  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await page.getByRole("link", { name: /Projects$/ }).click();
  await expect(page.getByRole("heading", { name: "Projects & tasks" })).toBeVisible();
  expect(counts.get("/api/v1/auth/refresh")).toBe(1);
  expect(counts.get("/api/v1/services/enabled")).toBe(1);
  expect(counts.get("/api/v1/projects")).toBe(1);
});
