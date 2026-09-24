import { expect, test } from "@playwright/test";

test("public SATHOS website exposes the product journey without API mutations", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Run your business from one connected operating system." })).toBeVisible();
  await page.getByRole("link", { name: "Services", exact: true }).first().click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { name: "One workspace, shaped around your business." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with the problem, not the software." })).toBeVisible();
  await expect(page.getByRole("region", { name: "SATHOS service directory" }).getByRole("article")).toHaveCount(6);
  expect(mutations).toEqual([]);
});

test("public website is usable on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Mobile public navigation" })).toBeVisible();
  await page.getByRole("link", { name: "Security", exact: true }).last().click();
  await expect(page).toHaveURL(/\/security$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Why SATHOS explains the operating problem without unsupported claims", async ({ page }) => {
  await page.goto("/why-sathos");
  await expect(page.getByRole("heading", { name: "Growth creates coordination problems before it creates clarity." })).toBeVisible();
  await expect(page.getByRole("table", { name: "How SATHOS differs" })).toBeVisible();
  await expect(page.getByText("The platform cannot replace business judgment, guarantee outcomes or make incomplete data reliable.", { exact: false })).toBeVisible();
});

test("How it works explains guided onboarding without automatic activation", async ({ page }) => {
  await page.goto("/how-it-works");
  await expect(page.getByRole("region", { name: "SATHOS onboarding journey" }).getByRole("article")).toHaveCount(5);
  await expect(page.getByText("A request does not automatically create or approve an account.")).toBeVisible();
  await expect(page.getByText("Do not email passwords, one-time codes, access tokens", { exact: false })).toBeVisible();
});

test("Security explains shared responsibilities without absolute promises", async ({ page }) => {
  await page.goto("/security");
  await expect(page.getByRole("region", { name: "SATHOS security layers" }).getByRole("article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Protect platform boundaries." })).toBeVisible();
  await expect(page.getByText("No internet service can promise absolute security.", { exact: false })).toBeVisible();
});

test("Pricing explains custom scope without inventing fixed plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("region", { name: "SATHOS pricing factors" }).getByRole("article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "No fixed package before we understand the work." })).toBeVisible();
  await expect(page.getByText("Nothing is charged from the public website.")).toBeVisible();
  await expect(page.getByText("No invented “starting from” price", { exact: false })).toBeVisible();
});

test("Request access submits on the website without opening a mail app", async ({ page }) => {
  await page.route("**/api/v1/public/request-access", async route => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true }) }));
  await page.goto("/contact");
  await expect(page.getByRole("region", { name: "Contact SATHOS" }).getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "sathsupport@sathos.in" }).first()).toHaveAttribute("href", "mailto:sathsupport@sathos.in");
  await expect(page.getByText("sending an email does not approve an account", { exact: false })).toBeVisible();
  await page.getByLabel("Your name").fill("Test Owner");
  await page.getByLabel("Work email").fill("owner@example.com");
  await page.getByLabel("Organization").fill("Test Company");
  await page.getByLabel("What would you like help with?").fill("We need help setting up a workspace.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toHaveText("Request received. Our team will contact you.");
});

test("Privacy remains a transparent beta notice rather than invented legal terms", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("region", { name: "Information processed by SATHOS" }).getByRole("article")).toHaveCount(4);
  await expect(page.getByText("must be reviewed by qualified counsel", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final periods must be documented before launch." })).toBeVisible();
});

test("Terms remain a reviewable beta framework rather than final legal claims", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("region", { name: "SATHOS private beta terms" }).getByRole("article")).toHaveCount(6);
  await expect(page.getByText("They are not final commercial terms", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Commercial and legal terms still to be finalized." })).toBeVisible();
  await expect(page.getByText("Governing law and dispute-resolution terms")).toBeVisible();
});
