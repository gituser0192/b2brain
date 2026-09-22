import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("password reset shows progress and a result while the server responds", async ({ page }) => {
  await installSyntheticApi(page, { authenticated: false });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    requests += 1;
    await pending;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: {} }) });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByRole("button", { name: "Request password reset" }).click();
  await expect(page.getByRole("button", { name: "Requesting reset…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Contacting the server");
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole("heading", { name: "Reset requested" })).toBeVisible();
});

test("password reset reports a failed request", async ({ page }) => {
  await installSyntheticApi(page, { authenticated: false });
  await page.route("**/api/v1/auth/forgot-password", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Email service is temporarily unavailable." }) }));
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByRole("button", { name: "Request password reset" }).click();
  await expect(page.locator(".auth-form").getByRole("alert")).toHaveText("Email service is temporarily unavailable.");
  await expect(page.getByRole("button", { name: "Request password reset" })).toBeEnabled();
});
