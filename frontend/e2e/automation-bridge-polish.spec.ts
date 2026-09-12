import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("Automation Bridge expands and collapses long record lists", async ({ page }) => {
  await installSyntheticApi(page);
  const connectors = Array.from({ length: 5 }, (_, index) => ({
    id: `connector-${index}`,
    name: `Test connector ${index + 1}`,
    type: "EMAIL",
    provider: "SYNTHETIC",
    status: "ACTIVE",
    mode: "MANUAL_APPROVAL",
    webhookKey: `test-${index}`,
    lastReceivedAt: null,
    credentialsConfiguredAt: null,
    whatsappPhoneNumberId: null,
    _count: { events: 0, messageDrafts: 0 },
  }));
  await page.route("**/api/v1/automation-bridge", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          connectors,
          events: [],
          metrics: { received: 0, completed: 0, failed: 0 },
        },
      }),
    }),
  );
  await page.goto("/automation?section=connections");

  const connectorList = page.locator(".bridge-columns > section").first();
  await expect(connectorList.locator(".connector-card")).toHaveCount(3);
  await connectorList.getByRole("button", { name: "See 2 more" }).click();
  await expect(connectorList.locator(".connector-card")).toHaveCount(5);
  await connectorList.getByRole("button", { name: "Show less" }).click();
  await expect(connectorList.locator(".connector-card")).toHaveCount(3);

  const trigger = page.getByRole("button", { name: "New connector" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create connector" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
