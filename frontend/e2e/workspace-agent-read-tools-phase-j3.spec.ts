import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

test("renders verified bounded business records with accessible deep links", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: {
    answer: "Based on your permitted organization records: CRM: 1.", provenance: "ORGANIZATION_DATA",
    toolResults: [{ toolName: "crm.customer_search", service: "CRM", provenance: "ORGANIZATION_DATA", retrievedAt: "2026-09-15T09:00:00.000Z", availability: "VERIFIED", resultCount: 1, totalCount: 18, truncated: true, records: [{ type: "CUSTOMER", id: "00000000-0000-4000-8000-000000000010", label: "Synthetic Customer", status: "ACTIVE", date: "2026-09-15T09:00:00.000Z", reason: "Pune, India", href: "/crm/customers/00000000-0000-4000-8000-000000000010" }] }],
  } }) }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("Find customer Synthetic Customer");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByRole("region", { name: "CRM results" })).toContainText("Verified organization data");
  await expect(drawer.getByText("Showing 1 of 18")).toBeVisible();
  const link = drawer.getByRole("link", { name: "Open Synthetic Customer" });
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveAttribute("href", "/crm/customers/00000000-0000-4000-8000-000000000010");
});

test("shows unavailable data without presenting a verified zero", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: { answer: "The requested business records could not be verified: FINANCE: unavailable.", toolResults: [{ toolName: "finance.overdue_invoices", service: "FINANCE", provenance: "ORGANIZATION_DATA", retrievedAt: "2026-09-15T09:00:00.000Z", availability: "UNAVAILABLE", resultCount: 0, truncated: false, records: [] }] } }) }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("Show overdue invoices");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("Service unavailable")).toBeVisible();
  await expect(drawer.getByText(/0 overdue invoices/i)).toHaveCount(0);
});
