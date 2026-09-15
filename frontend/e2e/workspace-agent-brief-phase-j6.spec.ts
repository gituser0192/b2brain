import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

const brief = { generatedAt: "2026-09-15T04:30:00.000Z", comparisonPeriod: "2026-09-13T18:30:00.000Z to 2026-09-14T18:30:00.000Z (Asia/Kolkata)", complete: false, ruleVersion: "j6-v1", executiveSummary: "2 verified priorities need review.", priorities: [{ key: "FINANCE:INVOICE:1", title: "INV-TEST-1", reason: "Payment is overdue", service: "FINANCE", severity: "HIGH", value: 25000, currency: "INR", date: "2026-09-10T00:00:00.000Z", evidence: "OVERDUE", href: "/finance", provenance: "ORGANIZATION_DATA", retrievedAt: "2026-09-15T04:30:00.000Z" }, { key: "PROJECTS:TASK:1", title: "Confirm launch", reason: "Delivery task is overdue", service: "PROJECTS", severity: "MEDIUM", date: "2026-09-12T00:00:00.000Z", evidence: "OVERDUE", href: "/projects", provenance: "ORGANIZATION_DATA", retrievedAt: "2026-09-15T04:30:00.000Z" }], changes: [], recommendations: [{ title: "Review INV-TEST-1", reason: "Payment is overdue", href: "/finance", action: null }], coverage: [{ source: "finance.overdue_invoices", service: "FINANCE", status: "VERIFIED", retrievedAt: "2026-09-15T04:30:00.000Z" }, { source: "analysis.risks", service: "BUSINESS_ANALYSIS", status: "FORBIDDEN", retrievedAt: "2026-09-15T04:30:00.000Z" }], coverageSummary: { checked: 10, unavailable: 0, forbidden: 1, failed: 0, noData: 8, retrievedAt: "2026-09-15T04:30:00.000Z" }, mutationPerformed: false, externalCallPerformed: false };

test("renders and explicitly refreshes the bounded J6 brief", async ({ page }) => {
  await installSyntheticApi(page); let requests = 0, mutations = 0;
  await page.route("**/api/v1/workspace-agent/brief", async (route) => { requests += 1; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: brief }) }); });
  page.on("request", (request) => { if (request.method() !== "GET" && request.url().includes("/workspace-agent/")) mutations += 1; });
  await page.goto("/agent");
  const region = page.getByRole("region", { name: "Today's operating brief" });
  await expect(region.getByText("2 verified priorities need review.")).toBeVisible();
  await expect(region.getByText("HIGH")).toBeVisible();
  expect(requests).toBe(1); expect(mutations).toBe(0);
  await region.getByRole("button", { name: "Refresh brief" }).click();
  await expect.poll(() => requests).toBe(2);
});
