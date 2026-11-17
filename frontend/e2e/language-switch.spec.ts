import { expect, test } from "@playwright/test";

test("English–Hindi choice persists across public pages while legal copy stays English", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Run your business from one connected operating system." })).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("hi");
  await expect(page.getByRole("heading", { name: "अपने व्यवसाय को एक जुड़े हुए कार्यस्थल से चलाएँ।" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.goto("/privacy");
  await expect(page.locator("main")).toHaveAttribute("lang", "en");
  await expect(page.locator(".language-preview-note")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "सेवाएँ" }).first()).toBeVisible();
  await page.goto("/services");
  await expect(page.locator(".language-preview-note")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "अपने व्यवसाय को एक जुड़े हुए कार्यस्थल से चलाएँ।" })).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Run your business from one connected operating system." })).toBeVisible();
});
