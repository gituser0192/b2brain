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
  await page.locator('nav button').filter({ hasText: "CRM" }).click();
  await expect(page).toHaveURL(/view=crm/);
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
  await page.getByText("Synthetic Retail Co").first().click();
  await expect(page.getByRole("heading", { name: "Synthetic Retail Co" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/view=crm/);
  await page.locator('nav button').filter({ hasText: "Projects" }).click();
  await expect(page.getByText("Synthetic Store Launch").first()).toBeVisible();
  await page.getByText("Synthetic Store Launch").first().click();
  await expect(page.getByText("Review launch checklist")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/view=crm/);
  await page.goForward();
  await expect(page).toHaveURL(/view=projects/);
});

test("finance, automation, operating agent and settings load", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard?view=finance");
  await expect(page.getByRole("heading", { name: "Accounts receivable" })).toBeVisible();
  await expect(page.getByText("E2E-INV-001", { exact: true })).toBeVisible();
  await page.locator('nav button').filter({ hasText: "Automation" }).click();
  await expect(page.getByRole("heading", { name: "Build intelligence on a controlled frame." })).toBeVisible();
  await page.locator('nav button').filter({ hasText: "Ask B² Brain" }).click();
  await expect(page.getByText("Business Operating Agent").first()).toBeVisible();
  await page.locator('nav button').filter({ hasText: "Settings" }).click();
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

test("sign-out clears the session and protected routes redirect", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard?view=settings");
  await page.getByRole("button", { name: "Sign out this browser" }).click();
  await expect(page).toHaveURL(/\/login/);
  const anonymous = await page.context().newPage();
  await installSyntheticApi(anonymous, { authenticated: false });
  await anonymous.goto("/dashboard?view=crm");
  await expect(anonymous).toHaveURL(/\/login/);
});
