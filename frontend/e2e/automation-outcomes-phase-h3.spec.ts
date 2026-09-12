import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const agents = [
  { id: "lead-agent", name: "Lead Qualification Agent", purpose: "Prepare lead qualification", instructions: null, supportedService: "LEADS", status: "ACTIVE", requiresApproval: true, allowedActions: [], dailyRunLimit: 10, dailyContactLimit: 0, _count: { runs: 2 } },
  { id: "finance-agent", name: "Finance Collection Agent", purpose: "Prepare collection work", instructions: null, supportedService: "FINANCE", status: "PAUSED", requiresApproval: true, allowedActions: [], dailyRunLimit: 10, dailyContactLimit: 0, _count: { runs: 1 } },
];
const followUps = { sequences: [{ id: "sequence-1", name: "Warm lead follow-up", description: "Follow up with qualified leads", isActive: true, stopOnResponse: true, stopOnWonDeal: true, steps: [], _count: { enrollments: 3 } }], enrollments: [], dueExecutions: [], inquiries: [], customers: [], metrics: { activeSequences: 1, activeEnrollments: 3, due: 0, awaitingApproval: 1 } };

async function installOutcomes(page: Parameters<typeof installSyntheticApi>[0], permissions = ["AUTOMATION_VIEW", "AUTOMATION_MANAGE"]) {
  await installSyntheticApi(page, { permissions });
  await page.route("**/api/v1/agents", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: agents }) }));
  await page.route("**/api/v1/follow-up-automation", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: followUps }) }));
  await page.route("**/api/v1/agents/runs/centre", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { items: [], metrics: {} } }) }));
  await page.route("**/api/v1/agents/*/schedule", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: null }) }));
}

test("Automations shows truthful business outcomes without mutating", async ({ page }, testInfo) => {
  let writes = 0;
  page.on("request", (request) => { if (request.url().includes("/api/v1/") && request.method() !== "GET" && !request.url().includes("/auth/refresh")) writes += 1; });
  await installOutcomes(page);
  await page.goto("/automation?section=automations");
  await expect(page.getByRole("heading", { name: "Lead handling" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invoice collection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer follow-ups" })).toBeVisible();
  await expect(page.getByText("Configured", { exact: true })).toBeVisible();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await expect(page.locator(".automation-outcome-grid i", { hasText: "Active" })).toBeVisible();
  expect(writes).toBe(0);
  await expect(page.locator(".automation-section")).toHaveScreenshot(`automation-outcomes-${testInfo.project.name}.png`);
});

for (const workflow of ["leads", "collections", "follow-ups"] as const) {
  test(`${workflow} workflow is URL-backed and refresh-safe`, async ({ page }, testInfo) => {
    await installOutcomes(page);
    await page.goto(`/automation?section=automations&workflow=${workflow}`);
    await expect(page.getByRole("link", { name: "All automations" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`workflow=${workflow}`));
    await expect(page.locator(".automation-workflow-detail")).toBeVisible();
    if (testInfo.project.name === "desktop") await expect(page.locator(".automation-section")).toHaveScreenshot(`automation-workflow-${workflow}-desktop.png`);
  });
}

test("workflow history and invalid URLs behave safely", async ({ page }) => {
  await installOutcomes(page);
  await page.goto("/automation?section=automations");
  await page.getByRole("link", { name: "Open workflow" }).first().click();
  await expect(page).toHaveURL(/workflow=leads/);
  await page.goBack();
  await expect(page.locator(".automation-outcome-grid")).toBeVisible();
  await page.goForward();
  await expect(page.locator(".automation-workflow-detail")).toBeVisible();
  await page.goto("/automation?section=automations&workflow=unknown");
  await expect(page.locator(".automation-outcome-grid")).toBeVisible();
});

test("read-only users see status but no management controls", async ({ page }) => {
  await installOutcomes(page, ["AUTOMATION_VIEW"]);
  await page.goto("/automation?section=automations");
  await expect(page.getByText(/Management controls require/)).toBeVisible();
  await expect(page.getByText("Advanced automation controls")).toHaveCount(0);
  await page.goto("/automation?section=automations&workflow=collections");
  await expect(page.getByText(/requires Automation management permission/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save schedule" })).toHaveCount(0);
});

test("advanced controls load only after an authorized user opens them", async ({ page }) => {
  await installOutcomes(page);
  await page.goto("/automation?section=automations");
  await expect(page.getByRole("heading", { name: "Agent definitions & evaluation" })).toHaveCount(0);
  await page.getByText("Advanced automation controls").click();
  await expect(page.getByRole("heading", { name: "Agent definitions & evaluation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Automation policies" })).toBeVisible();
  await expect(page.getByText("Business Knowledge supports Business Agent responses.")).toBeVisible();
  await expect(page.getByText("It is reference information, not an automation.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business knowledge" })).toBeVisible();
});

test("Automation overview counts only verified running sequences", async ({ page }) => {
  await installOutcomes(page);
  await page.goto("/automation");
  await expect(page.getByText("Running automations").first()).toBeVisible();
  await expect(page.getByLabel("Automation summary").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText(/active agent definition.*configured/)).toBeVisible();
});
