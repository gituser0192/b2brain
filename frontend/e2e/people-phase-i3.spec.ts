import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const services = ["CRM", "PEOPLE"];
const viewer = ["EMPLOYEE_VIEW"];
const manager = ["EMPLOYEE_VIEW", "EMPLOYEE_MANAGE", "MEMBERSHIP_VIEW"];

test("People navigation is entitlement and permission aware", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager });
  await page.goto("/dashboard");
  const peopleLink = page.locator('a[href="/people"]');
  await expect(peopleLink).toHaveCount(1);
  if (await peopleLink.isVisible()) await peopleLink.click();
  else { await page.getByRole("button", { name: "More" }).click(); await page.getByRole("dialog", { name: "More destinations" }).getByRole("link", { name: "People" }).click(); }
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByRole("heading", { name: "Employee records" })).toBeVisible();
  await expect(page.locator('a[href="/settings?section=team"]')).toHaveCount(2);
});

test("People is hidden and direct access is restricted without entitlement", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: ["CRM"], permissions: manager });
  await page.goto("/people");
  await expect(page.locator('a[href="/people"]')).toHaveCount(0);
  await expect(page.locator(".dashboard-notice[role=alert]")).toContainText("Access unavailable");
});

test("People is hidden and direct access is restricted without EMPLOYEE_VIEW", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: ["EMPLOYEE_MANAGE"] });
  await page.goto("/people");
  await expect(page.locator('a[href="/people"]')).toHaveCount(0);
  await expect(page.locator(".dashboard-notice[role=alert]")).toContainText("Access unavailable");
});

test("People supports search, sections, refresh and browser history", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager });
  await page.goto("/people");
  const visibleRecords = page.locator(".people-table:visible, .people-cards:visible");
  await expect(visibleRecords.getByText("Priya Mehta")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search employees" }).fill("Sales");
  await expect(visibleRecords.getByText("Rohan Singh")).toBeVisible();
  await page.getByRole("tab", { name: "Archived" }).click();
  await expect(visibleRecords.getByText("Dev Kumar")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Employee records" })).toBeVisible();
  await page.goto("/dashboard");
  await page.goBack(); await expect(page).toHaveURL(/\/people$/);
  await page.goForward(); await expect(page).toHaveURL(/\/dashboard$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/people$/);
});

test("employee create, edit, archive and restore use only existing APIs", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager });
  const requests: { method: string; url: string; body: string | null }[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.includes("/api/v1/employees")) requests.push({ method: request.method(), url: request.url(), body: request.postData() }); });
  await page.goto("/people");
  await page.getByRole("button", { name: "Add employee" }).first().click();
  await page.getByLabel("Employee ID Required").fill("EMP-004");
  await page.getByLabel("First name Required").fill("Asha");
  await page.getByLabel("Job title Required").fill("Analyst");
  await page.getByLabel("Start date Required").fill("2026-09-12");
  await page.getByRole("button", { name: "Save employee" }).click();
  const create = requests.find((request) => request.method === "POST" && new URL(request.url).pathname.endsWith("/employees"));
  expect(create?.body).not.toContain("organizationId");
  expect(JSON.parse(create?.body ?? "{}").linkedMembershipId).toBeNull();
  await page.getByRole("button", { name: "View or edit" }).first().click();
  await page.getByLabel("Job title Required").fill("Senior Operations Manager");
  await page.getByRole("button", { name: "Save employee" }).click();
  expect(requests.some((request) => request.method === "PUT")).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "View or edit" }).first().click();
  await page.getByRole("button", { name: "Archive employee" }).click();
  expect(requests.some((request) => request.method === "DELETE")).toBe(true);
  await page.getByRole("tab", { name: "Archived" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "View or edit" }).click();
  await page.getByRole("button", { name: "Restore employee" }).click();
  expect(requests.some((request) => request.method === "POST" && request.url.includes("/restore"))).toBe(true);
});

test("read-only People keeps employee records separate from login accounts", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: viewer });
  await page.goto("/people");
  await expect(page.getByText("Read-only access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add employee" })).toHaveCount(0);
  await expect(page.getByText("Login accounts, invitations and permissions remain in")).toBeVisible();
  await page.getByRole("button", { name: "View" }).first().click();
  await expect(page.getByRole("button", { name: "Save employee" })).toHaveCount(0);
  if (testInfo.project.name === "desktop") await expect(page).toHaveScreenshot("people-read-only-desktop-win32.png");
});

test("People reports loading state honestly", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager, delayEmployees: 600 });
  await page.goto("/people");
  await expect(page.getByText("Loading employee records…")).toBeVisible();
  if (testInfo.project.name === "desktop") await expect(page).toHaveScreenshot("people-loading-desktop-win32.png");
  await expect(page.locator(".people-table:visible, .people-cards:visible").getByText("Priya Mehta")).toBeVisible();
});

test("People reports empty state honestly", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager, emptyEmployees: true });
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "No employees found" })).toBeVisible();
  if (testInfo.project.name === "desktop") await expect(page).toHaveScreenshot("people-empty-desktop-win32.png");

});

test("People reports API errors honestly", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager, failEmployees: true });
  await page.goto("/people");
  await expect(page.locator(".dashboard-notice[role=alert]")).toContainText("Synthetic People failure.");
  if (testInfo.project.name === "desktop") await expect(page).toHaveScreenshot("people-error-desktop-win32.png");
});

test("People layout is responsive and opening it is read-only", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { enabledServices: services, permissions: manager });
  let writes = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname.includes("/api/v1/employees") && request.method() !== "GET") writes += 1; });
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "Employee records" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(writes).toBe(0);
  await expect(page).toHaveScreenshot(`people-workspace-${testInfo.project.name}-win32.png`);
});
