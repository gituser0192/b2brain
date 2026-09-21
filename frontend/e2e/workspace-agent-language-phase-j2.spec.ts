import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

test("clarification choices remain separate from confirmation", async ({ page }) => {
  await installSyntheticApi(page);
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    const body = await route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    const clarified = Boolean(body.clarification);
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: clarified ? { answer: "Your organization has 0 CRM customers.", metrics: [{ label: "CRM customers", value: 0, availability: "VERIFIED" }] } : { answer: "What should I apply that follow-up to?", provenance: "INFERENCE", clarification: { token: "signed-clarification-token-that-is-long-enough", expiresAt: "2026-09-15T12:05:00.000Z", choices: [{ label: "CRM customers", request: "Count all CRM customers" }, { label: "Finance summary", request: "Show my finance summary" }] } } }) });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("show me more");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("I need clarification before checking")).toBeVisible();
  await drawer.getByRole("button", { name: "CRM customers" }).focus();
  await page.keyboard.press("Enter");
  await expect(drawer.getByText("Your organization has 0 CRM customers.")).toBeVisible();
  expect(requests[1]).toMatchObject({ clarification: { choice: 0 } });
  expect(requests[1]).not.toHaveProperty("confirmation");
});

test("opening the Agent remains mutation free", async ({ page }) => {
  await installSyntheticApi(page);
  const mutations: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/workspace-agent/") && request.method() !== "GET") mutations.push(request.url()); });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  await expect(page.getByRole("dialog", { name: "Ask SATHOS" })).toBeVisible();
  expect(mutations).toEqual([]);
});
