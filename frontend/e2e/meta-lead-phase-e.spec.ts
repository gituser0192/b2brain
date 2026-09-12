import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("guided Meta Lead Ads test-mode setup is responsive and safely gated", async ({ page }, testInfo) => {
  await installSyntheticApi(page, { metaAutomation: true });
  let setupState = "DRAFT", forms: Array<{ id: string; name: string }> = [], subscriptionVerified = false;
  await page.route("**/api/v1/automation-bridge/connectors/*/meta/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method(), reply = (data: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (path.endsWith("/meta/status")) return reply({ connectorStatus: "DRAFT", mode: "TEST", setupState, page: setupState === "DRAFT" || setupState === "AUTHORIZED" ? null : { name: "Synthetic Test Page", maskedId: "••••0001" }, forms, permissionsValid: setupState !== "DRAFT" && setupState !== "AUTHORIZED", subscriptionVerified, lastVerifiedAt: subscriptionVerified ? "2026-09-06T12:00:00.000Z" : null, lastTestAt: setupState === "READY_TEST" ? "2026-09-06T12:01:00.000Z" : null, lastSuccessfulLeadAt: null, canActivateProduction: false });
    if (path.endsWith("/meta/authorize")) return reply({ authorizationUrl: "/automation?section=connections&channel=meta&meta_code=fake-approved&meta_state=synthetic-state-with-sufficient-entropy-1234567890" });
    if (path.endsWith("/meta/callback")) { setupState = "AUTHORIZED"; return reply({ mode: "TEST", pages: [{ id: "900000000000001", name: "Synthetic Test Page", permissions: ["leads_retrieval", "pages_manage_metadata", "pages_show_list"] }] }); }
    if (path.endsWith("/meta/page") && method === "PUT") { setupState = "PAGE_SELECTED"; return reply({ forms: [{ id: "910000000000001", name: "Synthetic Enquiry Form" }] }); }
    if (path.endsWith("/meta/forms") && method === "PUT") { setupState = "FORMS_SELECTED"; forms = [{ id: "910000000000001", name: "Synthetic Enquiry Form" }]; return reply({}); }
    if (path.endsWith("/meta/verify")) { setupState = "READY_TEST"; subscriptionVerified = true; return reply({}); }
    if (path.endsWith("/meta/test")) return reply({ processed: true, synthetic: true, externalActionPerformed: false });
    return route.fallback();
  });
  await page.goto("/automation?section=connections&channel=meta");
  const setup = page.locator(".meta-lead-setup");
  await expect(setup.getByText("TEST MODE", { exact: true })).toBeVisible();
  await setup.getByRole("button", { name: "Connect Meta" }).click();
  await setup.getByLabel("Authorized Page").selectOption("900000000000001");
  await setup.getByRole("button", { name: "Use Page" }).click();
  await setup.getByLabel("Synthetic Enquiry Form").check();
  await setup.getByRole("button", { name: "Save forms" }).click();
  await setup.getByRole("button", { name: "Verify subscription" }).click();
  await setup.getByRole("button", { name: "Run synthetic test" }).click();
  await expect(setup.getByText("Synthetic lead passed without creating CRM data.")).toBeVisible();
  await expect(setup.getByRole("button", { name: "Activate" })).toBeDisabled();
  if (testInfo.project.name === "mobile") {
    const setupHeader = setup.locator("header");
    const setupActions = setup.locator(".meta-setup-actions");
    await setupHeader.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(setupHeader).toHaveScreenshot("meta-lead-test-mode-header.png");
    await setupActions.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(setupActions).toHaveScreenshot("meta-lead-test-mode-actions.png");
  } else {
    await setup.evaluate(element => element.scrollIntoView({ block: "end" }));
    await expect(setup).toHaveScreenshot("meta-lead-test-mode-setup.png");
  }
});
