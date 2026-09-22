import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T09:00:00.000Z"));
});

test("organization directory supports URL selection, history, search and filters", async ({ page }) => {
  const mutations: string[] = [];
  let overviewReads = 0;
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/platform/overview")) overviewReads += 1;
    if (request.method() !== "GET" && !request.url().includes("/api/v1/auth/")) mutations.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/super-admin?section=organizations");
  await expect(page.getByRole("heading", { name: "Organization directory" })).toBeVisible();
  expect(overviewReads).toBe(1);
  await page.locator('.organization-directory a[href*="org-e2e-suspended"]').click();
  await expect(page).toHaveURL(/organization=org-e2e-suspended/);
  await expect(page.getByRole("heading", { name: "Northwind Test Studio" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Northwind Test Studio" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/section=organizations$/);
  await page.goForward();
  await expect(page).toHaveURL(/organization=org-e2e-suspended/);
  await page.goto("/super-admin?section=organizations");
  await page.getByLabel("Search organizations").fill("tara");
  await expect(page.locator(".organization-directory a")).toHaveCount(1);
  await page.getByLabel("Search organizations").fill("");
  await page.getByLabel("Filter").selectOption("TRIAL");
  await expect(page.locator(".organization-directory a")).toHaveCount(1);
  expect(mutations).toEqual([]);
});

test("invalid organization selection is safe and related links preserve selection", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.goto("/super-admin?section=organizations&organization=unknown-id");
  await expect(page.getByRole("heading", { name: "Organization not found" })).toBeVisible();
  await page.goto("/super-admin?section=organizations&organization=org-e2e-safe");
  await expect(page.locator(".organization-related-links").getByRole("link", { name: "Plans and Billing" })).toHaveAttribute("href", /section=plans&organization=org-e2e-safe/);
  await expect(page.locator(".organization-related-links").getByRole("link", { name: "Services" })).toHaveAttribute("href", /section=services&organization=org-e2e-safe/);
});

test("owner invitation validates, prevents duplicate submission and offers its one-time link", async ({ page }) => {
  let invitationRequests = 0;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.route("**/api/v1/platform/invitations", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, data: { emailDelivered: false, signupUrl: "https://staging.sathos.in/signup?token=synthetic-test-token" } }) }));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/v1/platform/invitations")) invitationRequests += 1;
  });
  await page.goto("/super-admin?section=organizations");
  await page.getByRole("button", { name: "Invite organization owner" }).click();
  expect(invitationRequests).toBe(0);
  await page.getByLabel("Organization name").fill("Synthetic Invite Company");
  await page.getByLabel("Owner email").fill("invite.owner@example.test");
  await page.getByRole("button", { name: "Invite organization owner" }).dblclick();
  await expect(page.getByText("Invitation created", { exact: true })).toBeVisible();
  expect(invitationRequests).toBe(1);
  await expect(page.getByLabel("Secure invitation link")).toHaveValue("https://staging.sathos.in/signup?token=synthetic-test-token");
  await expect(page.getByText("the email was not delivered", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Invitation link copied.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Secure invitation link")).toHaveCount(0);
});

test("dangerous organization and invitation actions require accessible confirmation", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.goto("/super-admin?section=organizations");
  const revoke = page.getByRole("button", { name: "Revoke" });
  await revoke.click();
  const revokeDialog = page.getByRole("dialog", { name: "Revoke owner invitation?" });
  await expect(revokeDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(revokeDialog).toBeHidden();
  await expect(revoke).toBeFocused();
  await page.goto("/super-admin?section=organizations&organization=org-e2e-safe");
  await page.getByRole("button", { name: "Suspend access" }).click();
  await expect(page.getByRole("dialog", { name: "Suspend E2E Safety Works?" })).toContainText("Business data is retained");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Remove account" }).click();
  await expect(page.getByRole("dialog", { name: "Remove E2E Safety Works?" })).toContainText("archives this organization account");
});

test("failed access mutation keeps its confirmation open and reports the backend error", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.route("**/api/v1/platform/organizations/org-e2e-safe/access", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Synthetic access update failure." }) }));
  await page.goto("/super-admin?section=organizations&organization=org-e2e-safe");
  await page.getByRole("button", { name: "Suspend access" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Suspend access" }).click();
  await expect(page.getByText("Synthetic access update failure.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Suspend E2E Safety Works?" })).toBeVisible();
});

test("organization owner cannot access S2", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/super-admin?section=organizations&organization=org-e2e-safe");
  await expect(page).toHaveURL(/dashboard/);
});

test("organization directory reports loading, empty, no-results and complete failure honestly", async ({ page }) => {
  await installSyntheticApi(page, { platformAdmin: true, emptyPlatformOrganizations: true, delayPlatformOverview: 300 });
  await page.goto("/super-admin?section=organizations");
  await expect(page.getByText("Opening secure platform console…")).toBeVisible();
  await expect(page.getByText("No organizations registered.")).toBeVisible();
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.reload();
  await page.getByLabel("Search organizations").fill("does not exist");
  await expect(page.getByText("No organizations match this search or filter.")).toBeVisible();
  await installSyntheticApi(page, { platformAdmin: true, failPlatformOverview: true });
  await page.reload();
  await expect(page.getByText("Synthetic platform catalogue failure.")).toBeVisible();
  await expect(page.getByText("0 organizations")).toHaveCount(0);
});

test("S2 responsive directory and detail views", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { platformAdmin: true, platformOrganizations: true });
  await page.goto("/super-admin?section=organizations");
  await expect(page.getByRole("heading", { name: "Organization directory" })).toBeVisible();
  await expect(page).toHaveScreenshot(`super-admin-s2-directory-${testInfo.project.name}-win32.png`, { animations: "disabled" });
  await page.goto("/super-admin?section=organizations&organization=org-e2e-safe");
  await expect(page.getByRole("heading", { name: "E2E Safety Works" })).toBeVisible();
  await expect(page).toHaveScreenshot(`super-admin-s2-detail-${testInfo.project.name}-win32.png`, { animations: "disabled" });
  await page.getByRole("button", { name: "Suspend access" }).click();
  await expect(page).toHaveScreenshot(`super-admin-s2-confirmation-${testInfo.project.name}-win32.png`, { animations: "disabled" });
});
