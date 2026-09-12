import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

type Account = { id: string; verifiedBusinessName: string; permissions: string[]; phoneNumbers: { id: string; maskedDisplayNumber: string; verifiedName: string }[] };

test("guided WhatsApp Business Test Mode setup completes safely and responsively", async ({ page }) => {
  await installSyntheticApi(page, { whatsappAutomation: true });
  const accounts: Account[] = [{ id: "700000000000001", verifiedBusinessName: "Synthetic B2 Test Store", permissions: ["whatsapp_business_management", "whatsapp_business_messaging"], phoneNumbers: [{ id: "710000000000001", maskedDisplayNumber: "+91 ••••• ••101", verifiedName: "Synthetic Support" }] }];
  let setupState = "NOT_CONFIGURED";
  let selectedAccount: { id: string; verifiedBusinessName: string } | null = null;
  let selectedNumber: { maskedDisplayNumber: string; verifiedName: string } | null = null;
  let ready = false;
  let disconnected = false;
  await page.route("**/api/v1/automation-bridge/connectors/*/whatsapp-setup/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data, message: status >= 400 ? String(data) : undefined }) });
    if (path.endsWith("/status")) return reply({ connectorStatus: "DRAFT", mode: "TEST", setupState, accounts: setupState === "NOT_CONFIGURED" ? [] : accounts, selectedAccount, selectedNumber, grantedScopes: selectedAccount ? accounts[0]!.permissions : [], permissionsValid: Boolean(selectedAccount), webhookReady: ready, authorizationVerifiedAt: setupState === "NOT_CONFIGURED" ? null : "2026-09-10T10:00:00.000Z", numberVerifiedAt: selectedNumber ? "2026-09-10T10:01:00.000Z" : null, lastTestAt: ready ? "2026-09-10T10:02:00.000Z" : null, outboundEnabled: false, canActivateProduction: false });
    if (path.endsWith("/authorize")) return reply({ authorizationUrl: "/automation?section=connections&wa_code=fake-approved&wa_state=synthetic-whatsapp-state-with-safe-entropy-123456&wa_connector=con-whatsapp-cloud-e2e" });
    if (path.endsWith("/callback")) { setupState = "AUTHORIZED"; return reply({ accounts, mode: "TEST" }); }
    if (path.endsWith("/account")) { setupState = "ACCOUNT_SELECTED"; selectedAccount = { id: accounts[0]!.id, verifiedBusinessName: accounts[0]!.verifiedBusinessName }; return reply({ account: selectedAccount, phoneNumbers: accounts[0]!.phoneNumbers, permissionsValid: true }); }
    if (path.endsWith("/number")) { setupState = "NUMBER_SELECTED"; selectedNumber = { maskedDisplayNumber: accounts[0]!.phoneNumbers[0]!.maskedDisplayNumber, verifiedName: accounts[0]!.phoneNumbers[0]!.verifiedName }; return reply({}); }
    if (path.endsWith("/test")) { setupState = "READY_TEST"; ready = true; return reply({ ready: true, externalActionPerformed: false, messageSent: false, customerCreated: false, inquiryCreated: false }); }
    if (path.endsWith("/reconnect")) { setupState = "AUTHORIZATION_STARTED"; ready = false; return reply({ authorizationUrl: "/automation?section=connections&wa_code=fake-approved&wa_state=fresh-synthetic-whatsapp-state-with-safe-entropy-123&wa_connector=con-whatsapp-cloud-e2e" }); }
    if (path.endsWith("/disconnect")) { setupState = "DISCONNECTED"; selectedAccount = null; selectedNumber = null; ready = false; disconnected = true; return reply({ disconnected: true, providerContacted: false, historyPreserved: true }); }
    return route.fallback();
  });

  await page.goto("/automation?section=connections");
  const setup = page.locator(".whatsapp-business-setup");
  await expect(setup.getByText("WhatsApp Business — Test Mode")).toBeVisible();
  await expect(setup.getByText("No real WhatsApp account is connected. No messages will be sent.")).toBeVisible();
  await setup.getByRole("button", { name: "Connect WhatsApp" }).focus();
  await expect(setup.getByRole("button", { name: "Connect WhatsApp" })).toBeFocused();
  await page.keyboard.press("Enter");
  await setup.getByLabel("Verified synthetic business account").selectOption(accounts[0]!.id);
  await setup.getByRole("button", { name: "Use account" }).click();
  await setup.getByLabel("Verified synthetic WhatsApp number").selectOption(accounts[0]!.phoneNumbers[0]!.id);
  await setup.getByRole("button", { name: "Use number" }).click();
  await setup.getByRole("button", { name: "Test connection" }).click();
  await expect(setup.getByText("Test Mode inbound readiness passed. No customer record or message was created.")).toBeVisible();
  await expect(setup.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(setup.getByText("Test ready", { exact: true })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 1024) {
    const setupHeader = setup.locator("header");
    const setupActions = setup.locator(".whatsapp-setup-actions");
    await setupHeader.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(setupHeader).toHaveScreenshot("whatsapp-business-test-mode-header.png");
    await setupActions.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(setupActions).toHaveScreenshot("whatsapp-business-test-mode-actions.png");
  } else {
    await expect(setup).toHaveScreenshot("whatsapp-business-test-mode-setup.png");
  }

  page.once("dialog", (dialog) => dialog.accept());
  await setup.getByRole("button", { name: "Disconnect" }).click();
  await expect.poll(() => disconnected).toBe(true);
  await expect(setup.getByText("WhatsApp Test Mode disconnected. CRM records and history were preserved.")).toBeVisible();
});

test("WhatsApp setup is read-only without AUTOMATION_MANAGE", async ({ page }) => {
  await installSyntheticApi(page, { whatsappAutomation: true, permissions: ["AUTOMATION_VIEW"] });
  await page.route("**/api/v1/automation-bridge/connectors/*/whatsapp-setup/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "DRAFT", mode: "TEST", setupState: "NOT_CONFIGURED", accounts: [], selectedAccount: null, selectedNumber: null, grantedScopes: [], permissionsValid: false, webhookReady: false, authorizationVerifiedAt: null, numberVerifiedAt: null, lastTestAt: null, outboundEnabled: false, canActivateProduction: false } }) }));
  await page.goto("/automation?section=connections");
  const setup = page.locator(".whatsapp-business-setup");
  await expect(setup.getByText("AUTOMATION_MANAGE permission is required")).toBeVisible();
  await expect(setup.getByRole("button", { name: "Connect WhatsApp" })).toBeDisabled();
});
