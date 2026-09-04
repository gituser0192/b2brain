import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const services = ["CRM", "FINANCE", "PROJECTS", "BUSINESS_ANALYSIS", "B2BRAIN_AGENT"];
const permissions = ["CRM_VIEW", "FINANCE_VIEW", "PROJECT_VIEW", "TASK_VIEW", "ANALYSIS_VIEW"];

test("verified health is organization-scoped, cached and makes no AI or mutation request", async ({ page }) => {
  const requests: { method: string; path: string }[] = [];
  await installSyntheticApi(page, { enabledServices: services, permissions });
  page.on("request", (request) => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await page.goto("/dashboard");
  await expect(page.getByLabel("Business health score 74 out of 100")).toBeVisible();
  await expect(page.getByText("Cash health")).toBeVisible();
  await expect(page.getByText("10000 received, 5000 spent, 15000 outstanding.")).toBeVisible();
  expect(requests.filter((item) => item.path.endsWith("/analysis"))).toHaveLength(1);
  expect(requests.some((item) => item.path.includes("workspace-agent") || (!item.path.includes("/auth/") && item.method !== "GET"))).toBe(false);
});

test("disabled and permission-denied health states do not request analysis", async ({ page }) => {
  let analysisRequests = 0;
  await installSyntheticApi(page, { enabledServices: ["CRM", "FINANCE"], permissions });
  page.on("request", (request) => { if (new URL(request.url()).pathname.endsWith("/analysis")) analysisRequests += 1; });
  await page.goto("/dashboard");
  await expect(page.getByText("Business Analysis is not enabled for this workspace.")).toBeVisible();
  expect(analysisRequests).toBe(0);

  await installSyntheticApi(page, { enabledServices: services, permissions: ["FINANCE_VIEW"] });
  await page.reload();
  await expect(page.getByText("You do not have permission to view Business Analysis.")).toBeVisible();
  expect(analysisRequests).toBe(0);
});

test("insufficient and partial health data never fabricates missing values", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions });
  await page.route("**/api/v1/analysis**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { period: { days: 30, currentStart: "2026-08-03T09:00:00.000Z", currentEnd: "2026-09-02T09:00:00.000Z" }, dataStatus: "LIMITED", recordCount: 2, overallScore: 61, scoreLabel: "Stable", components: [{ key: "cash", label: "Cash health", score: 61, evidence: "Two verified finance records.", view: "finance" }, { key: "sales", label: "Sales health", score: null, evidence: "No sales activity.", view: "sales" }], recommendations: [] } }) }));
  await page.goto("/dashboard");
  await expect(page.getByLabel("Business health score 61 out of 100")).toBeVisible();
  await expect(page.getByText("Cash health")).toBeVisible();
  await expect(page.getByText("Sales health")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recommendations" })).toHaveCount(0);
});

test("insufficient, failed and stale calculations are labelled honestly", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions });
  await page.route("**/api/v1/analysis**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { period: { days: 30, currentStart: "2025-01-01T00:00:00.000Z", currentEnd: "2025-02-01T00:00:00.000Z" }, dataStatus: "INSUFFICIENT", recordCount: 0, overallScore: null, scoreLabel: "Insufficient data", components: [], recommendations: [] } }) }));
  await page.goto("/dashboard");
  await expect(page.getByText("There is not enough verified activity to calculate a health score.")).toBeVisible();
  await expect(page.getByText("0/100")).toHaveCount(0);

  await page.unroute("**/api/v1/analysis**");
  await page.route("**/api/v1/analysis**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Synthetic health failure." }) }));
  await page.reload();
  await expect(page.getByText("The verified health calculation is temporarily unavailable.")).toBeVisible();
});

test("stale verified health is visibly marked at every viewport", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions });
  await page.goto("/dashboard");
  await expect(page.getByText("Stale calculation — refresh required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Business Analysis" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
