import { expect, test } from "./fixtures/synthetic-workspace";

test("dashboard shell keeps sidebar and main content independently scrollable", async ({ syntheticPage: page }, testInfo) => {
  await page.goto("/dashboard?view=automation");
  const shell = page.locator(".dashboard-shell"), sidebar = page.locator("#dashboard-navigation"), main = page.locator(".dashboard-main");
  await expect(shell).toBeVisible();
  const shellStyle = await shell.evaluate((node) => ({ height: getComputedStyle(node).height, overflow: getComputedStyle(node).overflow }));
  expect(parseFloat(shellStyle.height)).toBeGreaterThanOrEqual((testInfo.project.use.viewport?.height ?? 0) - 2);
  expect(["hidden", "clip"]).toContain(shellStyle.overflow);
  const mainStyle = await main.evaluate((node) => ({ overflowY: getComputedStyle(node).overflowY, overflowX: getComputedStyle(node).overflowX }));
  expect(["auto", "scroll"]).toContain(mainStyle.overflowY);
  expect(mainStyle.overflowX).toBe("hidden");
  if (testInfo.project.name !== "mobile") {
    await expect(sidebar).toBeVisible();
    const navigationOverflow = await sidebar.locator("nav").evaluate((node) => getComputedStyle(node).overflowY);
    expect(["auto", "scroll"]).toContain(navigationOverflow);
  }
});

test("forms, buttons, cards, modal and agent panel retain usable geometry", async ({ syntheticPage: page }) => {
  await page.goto("/dashboard?view=crm");
  await expect(page.getByRole("button", { name: /Add customer/i })).toBeVisible();
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
  await page.getByRole("button", { name: /Add customer/i }).click();
  const dialog = page.locator(".customer-editor");
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())?.width ?? 0).toBeGreaterThan(280);
  await page.goto("/dashboard?view=b2agent");
  await expect(page.locator(".workspace-agent")).toBeVisible();
});
