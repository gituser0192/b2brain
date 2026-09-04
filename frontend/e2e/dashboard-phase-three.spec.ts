import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("dashboard command centre uses one summary request and routes verified priorities", async ({ page }) => {
  let summaries = 0;
  await installSyntheticApi(page, { dashboardAlerts: [{ type: "FOLLOW_UP", count: 2, label: "Overdue CRM follow-ups", view: "crm" }] });
  page.on("request", (request) => { if (new URL(request.url()).pathname.endsWith("/dashboard/summary")) summaries += 1; });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "What needs attention" })).toBeVisible();
  await expect(page.getByText("₹10,000").first()).toBeVisible();
  expect(summaries).toBe(1);
  await page.getByRole("button", { name: /Overdue CRM follow-ups/ }).click();
  await expect(page).toHaveURL(/\/crm$/);
});

test("reporting period refetches once while current-month metrics stay explicit", async ({ page }) => {
  let summaries = 0;
  await installSyntheticApi(page);
  page.on("request", (request) => { if (new URL(request.url()).pathname.endsWith("/dashboard/summary")) summaries += 1; });
  await page.goto("/dashboard");
  await expect(page.getByText("Current month · received payments")).toBeVisible();
  await page.getByLabel("Reporting period").selectOption("90");
  await expect.poll(() => summaries).toBe(2);
});

test("finance without sales avoids an empty sales panel", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: ["CRM", "LEADS", "FINANCE", "B2BRAIN_AGENT"] });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Revenue, expenses and profit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lead pipeline" })).toHaveCount(0);
});

test("disabled Projects and Business Analysis collapse unsupported content", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: ["CRM", "LEADS", "FINANCE"] });
  await page.goto("/dashboard");
  await expect(page.getByText("Enable Business Analysis to calculate health")).toBeVisible();
  await expect(page.getByText("Pending tasks")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask Business Agent" })).toHaveCount(0);
});

test("empty dashboard stays compact and honest", async ({ page }) => {
  await installSyntheticApi(page, { emptyDashboard: true });
  await page.goto("/dashboard");
  await expect(page.getByText("No urgent priorities")).toBeVisible();
  await expect(page.getByText("No recent permitted business records yet.")).toBeVisible();
  await expect(page.getByText("No received payments or expenses were recorded in the last six months.")).toBeVisible();
});

test("long workspace identity does not create horizontal overflow", async ({ page }) => {
  await installSyntheticApi(page, { longIdentity: true });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Aarav-With-An-Intentionally-Long-Name/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("dashboard metric links, refresh, history and mobile shell remain functional", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Revenue ₹10,000/ }).click();
  await expect(page).toHaveURL(/\/finance$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aarav/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "What needs attention" })).toBeVisible();
  const main = page.locator(".dashboard-main");
  await expect(main).toHaveCSS("overflow-y", "auto");
  if ((await page.viewportSize())!.width < 700) await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
});
