import { expect, test } from "./fixtures/synthetic-workspace";

test("CRM language choice persists without changing customer data or permissions", async ({ syntheticPage: page }) => {
  await page.goto("/crm");
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) < 600) await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("combobox", { name: "Language" }).selectOption("hi");
  await expect(page.getByRole("heading", { name: "कस्टमर" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("नाम, ईमेल, फ़ोन या कंपनी खोजें")).toBeVisible();
  await expect(page.getByText("Synthetic Retail Co").first()).toBeVisible();
  await page.getByRole("button", { name: /कस्टमर जोड़ें/ }).first().click();
  await expect(page.getByText("पहला नाम")).toBeVisible();
  await expect(page.getByText("उपनाम")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Synthetic Retail Co/ }).click();
  await expect(page.getByText("संबंध इतिहास")).toBeVisible();
});
