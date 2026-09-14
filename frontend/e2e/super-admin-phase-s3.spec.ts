import {
  expect,
  installSyntheticApi,
  test,
} from "./fixtures/synthetic-workspace";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T09:00:00.000Z"));
  await installSyntheticApi(page, {
    platformAdmin: true,
    platformOrganizations: true,
  });
});

test("plans workspace uses one bounded overview read and URL-backed organization selection", async ({
  page,
}) => {
  let reads = 0;
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/platform/overview")) reads += 1;
    if (request.method() !== "GET" && !request.url().includes("/auth/"))
      mutations.push(request.method());
  });
  await page.goto("/super-admin?section=plans");
  await expect(
    page.getByRole("heading", { name: "Plans and Billing", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Growth", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pilot", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy", { exact: true })).toBeVisible();
  expect(reads).toBe(1);
  expect(mutations).toEqual([]);
  await page.getByRole("link", { name: /E2E Safety Works/ }).click();
  await expect(page).toHaveURL(/section=plans&organization=org-e2e-safe/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "E2E Safety Works" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/section=plans$/);
  await page.goForward();
  await expect(page).toHaveURL(/organization=org-e2e-safe/);
});

test("plan editing validates fields and separates Available and Beta composition", async ({
  page,
}) => {
  await page.goto("/super-admin?section=plans");
  await page.getByRole("button", { name: "+ New plan" }).click();
  await expect(
    page.getByText(/Editing a plan definition does not silently/),
  ).toBeVisible();
  await expect(
    page.getByText(/Beta services require approved testing/),
  ).toBeVisible();
  const monthly = page.getByLabel("Monthly price");
  await monthly.fill("-1");
  await expect(monthly).toHaveAttribute("min", "0");
  await expect(page.getByLabel(/AUTOMATION/)).toBeVisible();
  await expect(
    page.getByText(/Beta services require approved testing/),
  ).toBeVisible();
});

test("subscription and manual payment require truthful confirmation", async ({
  page,
}) => {
  await page.goto("/super-admin?section=plans&organization=org-e2e-safe");
  await expect(page.getByText("Record offline/manual payment")).toBeVisible();
  await expect(page.getByText(/does not charge the customer/)).toBeVisible();
  await expect(page.getByText("SYNTHETIC-REF-001")).toBeVisible();
  await page
    .getByRole("button", { name: "Review payment and renewal" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("already received outside B² Brain");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review payment and renewal" }),
  ).toBeFocused();
});

test("services preserve maturity metadata and require entitlement confirmation", async ({
  page,
}) => {
  await page.goto("/super-admin?section=services");
  await expect(
    page.getByText(
      "7 Available · 14 Beta across the verified 21-service catalogue.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("No primary customer navigation").first(),
  ).toBeVisible();
  await page.getByRole("link", { name: /E2E Safety Works/ }).click();
  const automation = page
    .locator(".entitlement-workspace article")
    .filter({ hasText: "AUTOMATION" });
  await automation.locator("label.access-switch").click();
  await expect(page.getByRole("dialog")).toContainText("approved Beta testing");
  await page.getByRole("button", { name: "Cancel" }).click();
  const crm = page
    .locator(".entitlement-workspace article")
    .filter({ hasText: "CRM" });
  await crm.locator("label.access-switch").click();
  await expect(page.getByRole("dialog")).toContainText(
    "existing business data is preserved",
  );
});

test("invalid selection and organization owner access fail safely", async ({
  page,
}) => {
  await page.goto("/super-admin?section=services&organization=not-real");
  await expect(
    page.getByRole("heading", { name: "Organization not found" }),
  ).toBeVisible();
  await installSyntheticApi(page, { platformAdmin: false });
  await page.goto("/super-admin?section=plans");
  await expect(page).toHaveURL(/dashboard/);
});

test("S3 responsive plans and services", async ({ page }, testInfo) => {
  await page.goto("/super-admin?section=plans&organization=org-e2e-safe");
  await expect(
    page.getByRole("heading", { name: "Plans and Billing", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".platform-commerce")).toHaveScreenshot(
    `super-admin-s3-plans-${testInfo.project.name}.png`,
  );
  await page.goto("/super-admin?section=services&organization=org-e2e-safe");
  await expect(
    page.getByRole("heading", { name: "Services", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".platform-commerce")).toHaveScreenshot(
    `super-admin-s3-services-${testInfo.project.name}.png`,
  );
});
