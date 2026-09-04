import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("desktop navigation is grouped, collapsible and active", async ({ syntheticPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/crm");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  for (const name of ["Overview", "Work", "Money", "Intelligence", "System"]) await expect(nav.getByText(name, { exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Customers" })).toHaveAttribute("aria-current", "page");
  await nav.getByText("Work", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "Customers" })).toBeHidden();
  await nav.getByText("Work", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "Customers" })).toBeVisible();
});

test("restricted navigation hides unpermitted destinations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await installSyntheticApi(page, { restricted: true });
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Team and Access" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Automation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Customers" })).toBeVisible();
});

test("mobile navigation provides sheets, focus and finance fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await installSyntheticApi(page, { enabledServices: ["CRM", "LEADS", "B2BRAIN_AGENT", "PROJECTS"] });
  await page.goto("/dashboard");
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobile).toBeVisible();
  await expect(mobile.getByRole("link", { name: /Business Agent/ })).toBeVisible();
  const moreButton = mobile.getByRole("button", { name: "More" });
  await moreButton.click();
  await expect(page.getByRole("dialog", { name: "More destinations" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(moreButton).toBeFocused();
  await mobile.getByRole("button", { name: "Quick Add" }).click();
  await expect(page.getByRole("link", { name: "Add customer" })).toHaveAttribute("href", "/crm");
  const agentBox = await page.getByRole("button", { name: "Open Ask B² Brain" }).boundingBox();
  const navBox = await mobile.boundingBox();
  expect((agentBox?.y ?? 0) + (agentBox?.height ?? 0)).toBeLessThanOrEqual(navBox?.y ?? 0);
});
