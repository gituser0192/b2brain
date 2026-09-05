import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("Settings sections use real existing workspaces and survive refresh", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Personal profile" })).toBeVisible();
  await page.getByRole("link", { name: "Team and Access", exact: true }).click();
  await expect(page).toHaveURL(/section=team/);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await page.getByRole("link", { name: "Roles and Permissions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organization Owner" })).toBeVisible();
});

test("restricted members can edit themselves but cannot edit the business", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true });
  await page.goto("/settings?section=business");
  await expect(page.getByText("Only the organization owner can change business settings.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save business settings" })).toBeDisabled();
  await page.getByRole("link", { name: "Personal Profile" }).click();
  await expect(page.getByRole("button", { name: "Save profile" })).toBeEnabled();
});

test("services, integrations and setup state stay truthful", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/settings?section=services");
  await expect(page.locator(".enabled-count")).toContainText("9");
  await page.getByRole("link", { name: "Integrations" }).click();
  await expect(page.getByText("Simulator activity is not a live connection.")).toBeVisible();
  await page.getByRole("link", { name: "Workspace Setup" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable in Settings")).toBeVisible();
});

test("security keeps password and session actions separate", async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto("/settings?section=security");
  await expect(page.getByLabel("Current password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out this browser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out all devices" })).toBeVisible();
});
