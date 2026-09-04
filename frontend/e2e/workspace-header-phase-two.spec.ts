import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("sticky header shows route titles and detail breadcrumbs", async ({ syntheticPage: page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile");
  await page.goto("/crm/customers/cus-e2e-001");
  const header = page.locator(".dashboard-header");
  await expect(header.getByRole("heading", { name: "Customer details" })).toBeVisible();
  await expect(header.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/crm");
  await expect(header).toHaveCSS("position", "sticky");
  await page.goto("/projects/prj-e2e-001");
  await expect(header.getByRole("heading", { name: "Project details" })).toBeVisible();
});

test("Quick Add follows services and permissions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await installSyntheticApi(page, { enabledServices: ["CRM", "FINANCE", "B2BRAIN_AGENT"], permissions: ["CRM_VIEW", "CRM_CREATE", "FINANCE_VIEW"] });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Quick Add" }).click();
  const menu = page.getByRole("menu", { name: "Quick Add actions" });
  await expect(menu.getByRole("menuitem", { name: "Add customer" })).toHaveAttribute("href", "/crm");
  await expect(menu.getByRole("menuitem", { name: "Ask Business Agent" })).toHaveAttribute("href", "/agent");
  await expect(menu.getByText("Record revenue")).toHaveCount(0);
  await expect(menu.getByText("Create project")).toHaveCount(0);
  await expect(menu.getByText("Add lead or inquiry")).toHaveCount(0);
});

test("Quick Add exposes permitted Finance and Projects destinations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await installSyntheticApi(page, { enabledServices: ["FINANCE", "PROJECTS"], permissions: ["FINANCE_VIEW", "FINANCE_MANAGE", "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_TASK_MANAGE"] });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Quick Add" }).click();
  const menu = page.getByRole("menu");
  for (const name of ["Record revenue", "Add expense"]) await expect(menu.getByRole("menuitem", { name })).toHaveAttribute("href", "/finance");
  for (const name of ["Create project", "Create task"]) await expect(menu.getByRole("menuitem", { name })).toHaveAttribute("href", "/projects");
});

test("Quick Add closes by Escape and outside click", async ({ syntheticPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/dashboard");
  const trigger = page.getByRole("button", { name: "Quick Add" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator(".workspace-page-heading").click();
  await expect(page.getByRole("menu")).toBeHidden();
});

test("header remains independent and responsive without navigation collisions", async ({ syntheticPage: page }, testInfo) => {
  await page.goto("/finance");
  const header = page.locator(".dashboard-header");
  const main = page.locator(".dashboard-main");
  await main.evaluate((node) => { node.scrollTop = 500; });
  await expect(header.getByRole("heading", { name: "Finance" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  if (testInfo.project.name === "mobile") {
    await expect(header.getByRole("button", { name: "Quick Add" })).toBeHidden();
    const headerBox = await header.boundingBox();
    const mobileBox = await page.getByRole("navigation", { name: "Mobile navigation" }).boundingBox();
    const agentBox = await page.getByRole("button", { name: "Open Ask B² Brain" }).boundingBox();
    expect((headerBox?.y ?? 1)).toBe(0);
    expect((agentBox?.y ?? 0) + (agentBox?.height ?? 0)).toBeLessThanOrEqual(mobileBox?.y ?? 0);
  } else {
    await expect(header.getByRole("button", { name: "Quick Add" })).toBeVisible();
  }
});

test("header title survives refresh and browser history", async ({ syntheticPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/crm");
  await expect(page.locator(".dashboard-header").getByRole("heading", { name: "Customers" })).toBeVisible();
  await page.getByRole("button", { name: "Quick Add" }).click();
  await page.getByRole("menuitem", { name: "Create project" }).click();
  await page.waitForURL("**/projects");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL("**/crm");
  await expect(page.locator(".dashboard-header").getByRole("heading", { name: "Customers" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".dashboard-header").getByRole("heading", { name: "Customers" })).toBeVisible();
});
