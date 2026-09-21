import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

test("shows a bounded truthful guided setup assessment", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("**/api/v1/workspace-agent/messages", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: {
    answer: "I checked your permitted workspace. Let’s start with WhatsApp Business.",
    setupAssessment: { counts: { complete: 3, actionRequired: 2, externalAuthorization: 1 }, areas: [], currentStep: null, steps: [{ key: "whatsapp", name: "WhatsApp Business", status: "EXTERNAL_AUTHORIZATION_REQUIRED", why: "WhatsApp setup currently supports Test Mode; real Embedded Signup is not available.", customerMust: "Open the existing setup. Never paste credentials into chat.", href: "/automation?section=connections", testMode: true }], mutationPerformed: false, externalCallPerformed: false },
  } }) }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask SATHOS" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask SATHOS" });
  await drawer.getByLabel("Message Ask SATHOS").fill("Help me set up WhatsApp");
  await drawer.getByRole("button", { name: "Send" }).click();
  const setup = drawer.getByRole("region", { name: "Guided setup" });
  await expect(setup.getByText("3 complete · 2 need action")).toBeVisible();
  await expect(setup.getByText("EXTERNAL AUTHORIZATION REQUIRED · Test Mode")).toBeVisible();
  await expect(setup.getByRole("link", { name: "Open setup" })).toHaveAttribute("href", "/automation?section=connections");
  await expect(setup.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Exit setup" })).toBeVisible();
});
