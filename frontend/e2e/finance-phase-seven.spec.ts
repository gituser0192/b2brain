import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("Finance sections use verified values and preserve one workspace request", async ({ page }) => {
  let financeRequests = 0;
  await installSyntheticApi(page, { richFinance: true });
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/v1/finance") financeRequests += 1; });
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Finance", exact: true }).last()).toBeVisible();
  await expect(page.getByLabel("Current finance summary")).toContainText("₹10,000");
  await expect(page.getByLabel("Current finance summary")).toContainText("₹5,000");
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByText("E2E-INV-001")).toBeVisible();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(page.getByText("Synthetic ad spend").last()).toBeVisible();
  expect(financeRequests).toBe(1);
});

test("Finance ledger filters and mobile records remain usable", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { richFinance: true });
  await page.goto("/finance?tab=revenue");
  await expect(page.getByRole("button", { name: "Revenue", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("From").fill("2026-09-01");
  await page.getByLabel("Payment method").selectOption("BANK_TRANSFER");
  await expect(page.getByText("E2E-INV-001")).toBeVisible();
  if (testInfo.project.name === "mobile") await expect(page.locator(".finance-workspace")).not.toHaveCSS("overflow-x", "scroll");
});

test("Quick Add opens existing Finance actions without submitting", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { richFinance: true });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Quick Add/ }).click();
  await page.getByRole(testInfo.project.name === "mobile" ? "link" : "menuitem", { name: "Add expense" }).click();
  await expect(page).toHaveURL(/\/finance\?tab=expenses&action=expense/);
  await expect(page.getByRole("heading", { name: "Record expense" })).toBeVisible();
});

test("restricted Finance remains read-only", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true, richFinance: true });
  await page.goto("/finance?tab=invoices");
  await expect(page.getByText("E2E-INV-001")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
});
