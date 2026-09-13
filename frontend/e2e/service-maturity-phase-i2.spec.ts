import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("Super Admin distinguishes entitlement from service maturity", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-12T09:00:00.000Z"));
  await installSyntheticApi(page, { platformAdmin: true });
  await page.goto("/super-admin");
  await expect(page.getByText("7 Available", { exact: true })).toBeVisible();
  await expect(page.getByText("14 Beta services", { exact: true })).toBeVisible();
  await page.goto("/super-admin?section=services");
  await expect(page.getByText("Beta access is intended for approved testing.").first()).toBeVisible();
  await expect(page.getByText("21 enabled", { exact: false })).toBeVisible();
  await expect(page).toHaveScreenshot(`service-maturity-super-admin-${testInfo.project.name}-win32.png`, { animations: "disabled" });
});

test("customer Enabled Services shows maturity without broken shortcuts", async ({ page }, testInfo) => {
  await installSyntheticApi(page);
  await page.goto("/settings?section=services");
  await expect(page.locator(".enabled-services-panel .maturity-badge")).toHaveCount(9);
  await expect(page.getByText("Enabled for Beta access. A primary workspace shortcut is not available yet.").first()).toBeVisible();
  await expect(page.locator('.enabled-services-panel a[href*="catalogue"]')).toHaveCount(0);
  await expect(page).toHaveScreenshot(`service-maturity-settings-${testInfo.project.name}-win32.png`, { animations: "disabled" });
});

test("restricted members cannot reach Super Admin entitlement controls", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true });
  await page.goto("/super-admin");
  await expect(page).toHaveURL(/dashboard/);
});

test("maturity views report loading failures honestly", async ({ page }) => {
  await installSyntheticApi(page, { failServiceContext: true, delayServiceContext: 300 });
  await page.goto("/settings?section=services");
  await expect(page.getByText("Checking service access…")).toBeVisible();
  await expect(page.getByText("Synthetic service catalogue failure.")).toBeVisible();
});

test("Super Admin reports catalogue failure without fabricated maturity", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true, failPlatformOverview: true, delayPlatformOverview: 300 });
  await page.goto("/super-admin");
  await expect(page.getByText("Opening secure platform console…")).toBeVisible();
  await expect(page.getByText("Synthetic platform catalogue failure.")).toBeVisible();
  await expect(page.getByText("7 Available", { exact: true })).toHaveCount(0);
});
