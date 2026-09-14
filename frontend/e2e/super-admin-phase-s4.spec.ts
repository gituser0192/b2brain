import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const planned = [
  ["operations", "Operations", "A cross-organization Platform Admin operations queue is not available yet."],
  ["support", "Support", "A centralized platform support inbox is not available yet."],
  ["agents", "Platform Agents", "Platform-owned agent management is not available yet."],
  ["audit", "Audit Log", "A centralized platform audit timeline is not available yet."],
  ["settings", "Platform Settings", "Safe Platform Admin settings are not available yet."],
] as const;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T09:00:00.000Z"));
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
});

test("planned platform sections are URL-backed, read-only, and make no extra requests", async ({ page }) => {
  let overviewReads = 0;
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/platform/overview")) overviewReads += 1;
    if (request.method() !== "GET" && !request.url().includes("/auth/")) mutations.push(request.method());
  });

  await page.goto("/super-admin?section=operations");
  await expect(page.getByRole("heading", { name: "Operations", level: 1 })).toBeVisible();
  expect(overviewReads).toBe(1);
  for (const [section, heading, message] of planned) {
    await page.getByRole("link", { name: new RegExp(heading, "i") }).click();
    await expect(page).toHaveURL(new RegExp(`section=${section}`));
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.locator(".platform-planned-detail button")).toHaveCount(0);
  }
  expect(overviewReads).toBe(1);
  expect(mutations).toEqual([]);
  await page.goBack();
  await expect(page).toHaveURL(/section=audit/);
  await page.goForward();
  await expect(page).toHaveURL(/section=settings/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Platform Settings", level: 2 })).toBeVisible();
});

test("planned sections distinguish organization-only capabilities and expose no secrets", async ({ page }) => {
  await page.goto("/super-admin?section=support");
  await expect(page.getByText(/SUPPORT ticket service remain organization-scoped/)).toBeVisible();
  await page.goto("/super-admin?section=agents");
  await expect(page.getByText(/Organization Business Agents remain managed/)).toBeVisible();
  await page.goto("/super-admin?section=audit");
  await expect(page.getByText(/audit records are organization-scoped/)).toBeVisible();
  await page.goto("/super-admin?section=settings");
  await expect(page.getByText(/Environment variables, credentials, database access, and provider keys are never displayed/)).toBeVisible();
  await expect(page.getByText(/postgres|database_url|jwt|token|password|secret/i)).toHaveCount(0);
});

test("organization owners remain outside S4", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/super-admin?section=operations");
  await expect(page).toHaveURL(/dashboard/);
});

test("invalid section still resolves safely to Overview", async ({ page }) => {
  await page.goto("/super-admin?section=not-real");
  await expect(page).toHaveURL(/section=overview/);
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
});

test("S4 planned sections are responsive", async ({ page }, testInfo) => {
  for (const [section, heading] of planned) {
    await page.goto(`/super-admin?section=${section}`);
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate((body) => body.clientWidth));
    await expect(page).toHaveScreenshot(`super-admin-s4-${section}-${testInfo.project.name}.png`, { animations: "disabled" });
  }
});
