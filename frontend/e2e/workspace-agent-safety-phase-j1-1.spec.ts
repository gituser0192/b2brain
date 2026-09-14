import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("opening and refreshing the Agent remains read only", async ({ page }) => {
  let mutations = 0;
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/**", async (route) => {
    if (route.request().method() !== "GET") mutations += 1;
    await route.continue();
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  await expect(page.getByRole("dialog", { name: "Ask B² Brain" })).toBeVisible();
  expect(mutations).toBe(0);
  await page.getByRole("link", { name: "Full workspace" }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole("heading", { name: "Ask B² Brain" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ask B² Brain" })).toBeVisible();
  expect(mutations).toBe(0);
});

test("confirmation actions send the signed preview decision", async ({ page }) => {
  const decisions: string[] = [];
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    const body = await route.request().postDataJSON() as { confirmation?: { decision: string } };
    if (body.confirmation) decisions.push(body.confirmation.decision);
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: body.confirmation ? { answer: body.confirmation.decision === "CONFIRM" ? "Created once." : "Cancelled." } : { answer: "Review before creating.", needsConfirmation: true, confirmation: { action: "CUSTOMER_CREATE", token: "signed-confirmation-token-that-is-long-enough", expiresAt: "2026-09-14T12:10:00.000Z", preview: { name: "Synthetic Customer", phone: "9876543210", type: "PERSON", status: "LEAD" } } } }) });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await drawer.getByLabel("Message Ask B² Brain").fill("Add Synthetic Customer phone 9876543210");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("Review required")).toBeVisible();
  await drawer.getByRole("button", { name: "Cancel" }).click();
  await expect(drawer.getByText("Cancelled.")).toBeVisible();
  expect(decisions).toEqual(["CANCEL"]);
});

test("verified zero and unavailable metrics stay distinct", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: { answer: "Checked permitted data.", metrics: [{ label: "CRM customers", value: 0, availability: "VERIFIED" }, { label: "Finance", value: null, availability: "UNAVAILABLE" }] } }) }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await drawer.getByLabel("Message Ask B² Brain").fill("Check my business");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("CRM customers").locator("..").getByText("0", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Finance").locator("..").getByText("Unavailable", { exact: true })).toBeVisible();
});
