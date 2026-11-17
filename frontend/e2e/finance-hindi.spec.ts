import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

async function chooseHindi(page: Parameters<typeof installSyntheticApi>[0]) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Language" }).selectOption("hi");
}

test("Finance overview, ledger and invoice data use Hindi labels without changing values", async ({ page }) => {
  await installSyntheticApi(page, { richFinance: true });
  await chooseHindi(page);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "फाइनेंस", exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole("navigation", { name: "फाइनेंस सेक्शन" }).getByRole("button", { name: "ओवरव्यू" })).toBeVisible();
  await expect(page.getByLabel("मौजूदा फाइनेंस सारांश")).toContainText("₹10,000");
  await page.getByRole("button", { name: "इनवॉइस", exact: true }).click();
  await expect(page.getByRole("heading", { name: "कस्टमर इनवॉइस" })).toBeVisible();
  await expect(page.getByText("E2E-INV-001").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "पेमेंट दर्ज करें" }).first()).toBeVisible();
});

test("Hindi Finance forms and collection controls retain their original action values", async ({ page }) => {
  await installSyntheticApi(page, { richFinance: true });
  await chooseHindi(page);
  await page.goto("/finance?tab=invoices");
  await page.getByRole("button", { name: "पेमेंट दर्ज करें" }).first().click();
  await expect(page.getByRole("heading", { name: /पेमेंट दर्ज करें · E2E-INV-001/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "तरीका" })).toHaveValue("BANK_TRANSFER");
  await page.goto("/finance");
  await page.getByRole("button", { name: "इनवॉइस बनाएँ" }).click();
  await expect(page.getByText("इनवॉइस नंबर")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "कस्टमर" })).toBeVisible();
  await page.goto("/finance?tab=expenses");
  await page.getByRole("button", { name: "खर्च जोड़ें" }).first().click();
  await expect(page.getByRole("heading", { name: "खर्च दर्ज करें" })).toBeVisible();
  await expect(page.getByText("शीर्षक")).toBeVisible();
  await page.goto("/finance?tab=payments");
  await expect(page.getByRole("heading", { name: "पेमेंट कलेक्शन और मिलान" })).toBeVisible();
  await expect(page.getByText("रिफंड के लिए दूसरे अधिकृत यूज़र की स्वीकृति जरूरी है।")).toBeVisible();
  await page.getByRole("button", { name: "+ अकाउंट" }).click();
  await expect(page.getByRole("heading", { name: "पेमेंट अकाउंट जोड़ें" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "प्रकार" })).toHaveValue("BANK");
});

test("Hindi mode does not grant Finance mutation controls to a read-only user", async ({ page }) => {
  await installSyntheticApi(page, { restricted: true, richFinance: true });
  await chooseHindi(page);
  await page.goto("/finance?tab=invoices");
  await expect(page.getByRole("heading", { name: "कस्टमर इनवॉइस" })).toBeVisible();
  await expect(page.getByRole("button", { name: "इनवॉइस बनाएँ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "पेमेंट दर्ज करें" })).toHaveCount(0);
});
