import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

test("shows a confirmation-gated internal action and prevents duplicate submission", async ({ page }) => {
  await installSyntheticApi(page);
  let calls = 0;
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    calls += 1;
    const request = route.request().postDataJSON() as { confirmation?: { decision: string } };
    const data = request.confirmation
      ? { answer: "The confirmed internal action was completed. No external action occurred.", actionResult: { toolName: "crm.follow_up_create", status: "COMPLETED", label: "Call customer", href: "/crm/customers/00000000-0000-4000-8000-000000000010", externalEffect: false } }
      : { answer: "Review this action before confirming.", confirmation: { action: "TOOL_ACTION", token: "synthetic-confirmation-token-that-is-long-enough", expiresAt: "2026-09-20T10:10:00.000Z", preview: { targetLabel: "Synthetic Customer", changes: { title: "Call customer", dueAt: "20 September 2026, 10:00 AM" }, consequence: "This will add one CRM follow-up. No message will be sent.", externalEffect: false } } };
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("Create a follow-up");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("No external action", { exact: true })).toBeVisible();
  const confirm = drawer.getByRole("button", { name: "Confirm" });
  await confirm.dblclick();
  await expect(drawer.getByText("Action completed")).toBeVisible();
  await expect(drawer.getByText("No external action occurred.", { exact: true })).toBeVisible();
  expect(calls).toBe(2);
});

test("cancels without claiming a mutation", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    const request = route.request().postDataJSON() as { confirmation?: { decision: string } };
    const data = request.confirmation?.decision === "CANCEL"
      ? { answer: "The proposed action was cancelled. Nothing was changed.", cancelled: true }
      : { answer: "Review this action before confirming.", confirmation: { action: "TOOL_ACTION", token: "synthetic-confirmation-token-that-is-long-enough", expiresAt: "2026-09-20T10:10:00.000Z", preview: { targetLabel: "Synthetic Project", changes: { title: "Call supplier" }, consequence: "This will create one internal project task. No external action will occur.", externalEffect: false } } };
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("Create a task");
  await drawer.getByRole("button", { name: "Send" }).click();
  await drawer.getByRole("button", { name: "Cancel" }).click();
  await expect(drawer.getByText("Nothing was changed.")).toBeVisible();
});
