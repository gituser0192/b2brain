import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const sections = ["organizations", "plans", "services", "operations", "support", "agents", "audit", "settings"];

test("Super Admin uses URL-backed focused sections", async ({ page }) => {
  test.setTimeout(60_000);
  await installSyntheticApi(page, { platformAdmin: true });
  await page.goto("/super-admin");
  await expect(page).toHaveURL(/\/super-admin$/);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByText("Active organizations")).toBeVisible();
  await expect(page.getByText("7 Available", { exact: true })).toBeVisible();
  await expect(page.getByText("14 Beta services", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply plan" })).toHaveCount(0);

  for (const section of sections) {
    await page.goto(`/super-admin?section=${section}`);
    await expect(page.getByRole("link", { name: new RegExp(section === "plans" ? "Plans and Billing" : section, "i") })).toHaveAttribute("aria-current", "page");
  }

  await page.goto("/super-admin?section=unknown");
  await expect(page).toHaveURL(/section=overview/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
});

test("Super Admin section navigation is non-mutating and supports history", async ({ page }) => {
  const mutations: string[] = [];
  let overviewReads = 0;
  await installSyntheticApi(page, { platformAdmin: true });
  page.on("request", (request) => {
    if (request.method() !== "GET") mutations.push(`${request.method()} ${request.url()}`);
    if (request.method() === "GET" && request.url().includes("/api/v1/platform/overview")) overviewReads += 1;
  });
  await page.goto("/super-admin");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  expect(overviewReads).toBe(1);
  mutations.length = 0;
  const organizationsLink = page.getByRole("link", { name: "Organizations", exact: true });
  await organizationsLink.focus();
  await organizationsLink.press("Enter");
  await expect(page).toHaveURL(/section=organizations/);
  const servicesLink = page.getByRole("link", { name: "Services", exact: true });
  await servicesLink.focus();
  await servicesLink.press("Enter");
  await expect(page).toHaveURL(/section=services/);
  await page.goBack();
  await expect(page).toHaveURL(/section=organizations/);
  await page.goForward();
  await expect(page).toHaveURL(/section=services/);
  expect(mutations).toEqual([]);
});

test("Super Admin workflows are grouped and planned sections are honest", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true });
  await page.goto("/super-admin?section=organizations");
  await expect(page.getByRole("heading", { name: "Invite organization owner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organization directory" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply plan" })).toHaveCount(0);
  await page.goto("/super-admin?section=plans");
  await expect(page.getByRole("heading", { name: "Plans and Billing", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New plan" })).toBeVisible();
  await page.goto("/super-admin?section=services");
  await expect(page.getByText(/7 Available · 14 Beta/)).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.goto("/super-admin?section=audit");
  await expect(page.getByText("A centralized platform audit timeline is not available yet.")).toBeVisible();
  await expect(page.locator(".platform-planned button")).toHaveCount(0);
});

test("organization owners remain outside every Super Admin section", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/super-admin?section=services");
  await expect(page).toHaveURL(/dashboard/);
});

test("Super Admin S1 responsive views", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T09:00:00.000Z"));
  await installSyntheticApi(page, { platformAdmin: true });
  await page.goto("/super-admin");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("super-admin-s1-overview.png", { animations: "disabled" });
  for (const selected of ["organizations", "plans", "services", "audit"]) {
    await page.goto(`/super-admin?section=${selected}`);
    const heading = selected === "plans" ? "Plans and Billing" : selected === "audit" ? "Audit Log" : selected.slice(0, 1).toUpperCase() + selected.slice(1);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`super-admin-s1-${selected}.png`, { animations: "disabled" });
  }
});
