import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("launcher is service-filtered and stays clear of mobile navigation", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: ["CRM", "FINANCE"] });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Open Ask B² Brain" })).toHaveCount(0);

  await installSyntheticApi(page, { enabledServices: ["CRM", "FINANCE", "B2BRAIN_AGENT"], permissions: [] });
  await page.reload();
  const launcher = page.getByRole("button", { name: "Open Ask B² Brain" });
  await expect(launcher).toBeVisible();
  const launcherBox = await launcher.boundingBox();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  if (await mobileNav.isVisible()) {
    const navBox = await mobileNav.boundingBox();
    expect((launcherBox?.y ?? 0) + (launcherBox?.height ?? 0)).toBeLessThanOrEqual(navBox?.y ?? 0);
  }
});

test("drawer traps focus, closes with Escape and restores launcher focus", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  const launcher = page.getByRole("button", { name: "Open Ask B² Brain" });
  await launcher.click();
  const drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Full workspace" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(launcher).toBeFocused();
});

test("drawer suggestions follow route context and use the existing message API", async ({ page }) => {
  let submitted = "";
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    submitted = (await route.request().postDataJSON()).message;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { answer: "Verified synthetic answer.", warnings: [], suggestions: [] } }) });
  });
  await page.goto("/finance");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  await page.getByRole("button", { name: "Explain this month’s profit" }).click();
  await expect(page.getByText("Verified synthetic answer.")).toBeVisible();
  expect(submitted).toBe("Explain this month’s profit");
});

test("CRM and Projects expose only their contextual suggestions", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/crm");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  await expect(page.getByRole("button", { name: "Which customers need follow-up?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/projects");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  await expect(page.getByRole("button", { name: "Which tasks are overdue?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Count my customers" })).toHaveCount(0);
});

test("drawer input, long history and full workspace remain usable", async ({ page }) => {
  await installSyntheticApi(page);
  const items = Array.from({ length: 12 }, (_, index) => ({ id: `drawer-${index}`, createdAt: "2026-09-04T09:00:00.000Z", message: `Question ${index + 1}`, output: { answer: `Verified answer ${index + 1}`, warnings: [] } }));
  await page.route("**/api/v1/workspace-agent/conversations/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: items }) }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await expect(drawer.getByLabel("Message Ask B² Brain")).toBeVisible();
  expect(await drawer.locator(".workspace-agent-thread").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await drawer.getByRole("link", { name: "Full workspace" }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole("heading", { name: "Ask B² Brain" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
