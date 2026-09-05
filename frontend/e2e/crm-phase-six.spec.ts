import { expect, installSyntheticApi, ownerSession, test } from "./fixtures/synthetic-workspace";

test("CRM lifecycle tabs use server filters and clear them", async ({ page }) => {
  const requests: string[] = [];
  await installSyntheticApi(page);
  page.on("request", (request) => { if (request.url().includes("/api/v1/customers?")) requests.push(request.url()); });
  await page.goto("/crm");
  await expect(page.getByRole("heading", { name: "Customers", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Active customers" }).click();
  await expect.poll(() => requests.some((url) => url.includes("status=ACTIVE"))).toBe(true);
  await page.getByRole("button", { name: "Leads" }).click();
  await expect.poll(() => requests.some((url) => url.includes("status=LEAD"))).toBe(true);
  await page.getByPlaceholder("Search name, email, phone or company").fill("nothing");
  await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByPlaceholder("Search name, email, phone or company")).toHaveValue("");
});

test("mobile CRM cards retain contact, status and primary actions", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.toLowerCase().includes("mobile"), "Mobile characterization only.");
  await installSyntheticApi(page);
  await page.goto("/crm");
  const record = page.locator(".customer-table article").first();
  await expect(record.getByText("hello@example.test")).toBeVisible();
  await expect(record.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(record.getByRole("button", { name: "View" })).toBeVisible();
});

test("Lead pipeline maps real statuses and preserves explicit conversion", async ({ page }) => {
  let conversion: unknown;
  await installSyntheticApi(page, { permissions: [...ownerSession.membership.permissions, "INQUIRY_VIEW", "INQUIRY_MANAGE", "INQUIRY_CONVERT"] });
  await page.route("**/api/v1/inquiries/inq-e2e-001/convert", async (route) => {
    conversion = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: {} }) });
  });
  await page.goto("/dashboard?view=inquiries");
  await expect(page.getByRole("heading", { name: "Lead & inquiry inbox" })).toBeVisible();
  for (const stage of ["New", "Contacted", "Qualified", "Won", "Lost"]) await expect(page.getByRole("button", { name: new RegExp(stage) })).toBeVisible();
  await page.getByRole("button", { name: "Customer", exact: true }).click();
  await expect.poll(() => conversion).toEqual({ target: "CUSTOMER" });
});

test("restricted CRM hides write controls while keeping customer access", async ({ page }) => {
  await installSyntheticApi(page, { permissions: ["CRM_VIEW"] });
  await page.goto("/crm");
  await expect(page.getByRole("button", { name: /Add customer/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow-up due" })).toHaveCount(0);
});
