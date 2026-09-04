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
  await expect(drawer.getByRole("button", { name: "New chat" })).toBeFocused();
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

test("drawer opens a clean chat, preserves an unsent draft, and creates no empty conversation", async ({ page }) => {
  let historyRequests = 0;
  let messageRequests = 0;
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/conversations/**", (route) => { historyRequests += 1; return route.continue(); });
  await page.route("**/api/v1/workspace-agent/messages", (route) => { messageRequests += 1; return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: { answer: "Verified synthetic answer.", warnings: [] } }) }); });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  let drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await expect(drawer.getByRole("heading", { name: "Start a new conversation" })).toBeVisible();
  await expect(drawer.getByText("Ask about your business health, finances, customers or priorities.")).toBeVisible();
  expect(historyRequests).toBe(0);
  expect(messageRequests).toBe(0);
  await drawer.getByLabel("Message Ask B² Brain").fill("My unsent question");
  await drawer.getByRole("button", { name: "Close Ask B² Brain" }).click();
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await expect(drawer.getByLabel("Message Ask B² Brain")).toHaveValue("My unsent question");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("Verified synthetic answer.")).toBeVisible();
  expect(messageRequests).toBe(1);
  await drawer.getByRole("button", { name: "Close Ask B² Brain" }).click();
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await expect(drawer.getByRole("heading", { name: "Start a new conversation" })).toBeVisible();
  await drawer.getByLabel("Message Ask B² Brain").fill("Clear this draft");
  await drawer.getByRole("button", { name: "New chat" }).click();
  await expect(drawer.getByLabel("Message Ask B² Brain")).toHaveValue("");
  await drawer.getByRole("link", { name: "Full workspace" }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole("heading", { name: "Ask B² Brain" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("desktop and tablet launcher drags without opening, snaps, and restores its scoped position", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase().includes("mobile"), "Phone launcher intentionally remains fixed.");
  await installSyntheticApi(page);
  await page.goto("/dashboard");
  const launcher = page.getByRole("button", { name: "Open Ask B² Brain" });
  const before = await launcher.boundingBox();
  if (!before) throw new Error("Launcher is not measurable.");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x - 180, Math.max(180, before.y - 180), { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Ask B² Brain" })).toHaveCount(0);
  const moved = await launcher.boundingBox();
  expect(moved?.x).not.toBe(before.x);
  const stored = await page.evaluate(() => localStorage.getItem("b2brain-agent-launcher:org-e2e-safe:usr-e2e-owner"));
  expect(stored).toBeTruthy();
  await page.reload();
  const restored = await page.getByRole("button", { name: "Open Ask B² Brain" }).boundingBox();
  expect(Math.abs((restored?.x ?? 0) - (moved?.x ?? 0))).toBeLessThan(2);
  await launcher.click();
  await expect(page.getByRole("dialog", { name: "Ask B² Brain" })).toBeVisible();
});
