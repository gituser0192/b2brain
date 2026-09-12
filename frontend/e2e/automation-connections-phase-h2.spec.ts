import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const connectors = [
  { id: "wa-sim", name: "WhatsApp CRM Simulator", type: "WHATSAPP", provider: "B2BRAIN_SIMULATOR", status: "ACTIVE", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-wa", lastReceivedAt: null, credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } },
  { id: "wa-test", name: "WhatsApp Business Test Mode", type: "WHATSAPP", provider: "META_WHATSAPP_CLOUD", status: "DRAFT", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-wa-test", lastReceivedAt: null, credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } },
  { id: "meta-test", name: "Meta Lead Test Mode", type: "SOCIAL", provider: "META_LEAD_ADS", status: "ACTIVE", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-meta", lastReceivedAt: null, credentialsConfiguredAt: "2026-09-01T00:00:00.000Z", whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } },
  { id: "web", name: "Website intake", type: "WEBSITE", provider: "SIGNED_INTAKE", status: "ACTIVE", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-web", lastReceivedAt: null, credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } },
  { id: "email", name: "Email delivery", type: "EMAIL", provider: "SMTP", status: "PAUSED", mode: "MANUAL_APPROVAL", webhookKey: "synthetic-email", lastReceivedAt: null, credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 0, messageDrafts: 0 } },
];

async function installConnections(page: Parameters<typeof installSyntheticApi>[0], permissions = ["AUTOMATION_VIEW", "AUTOMATION_MANAGE"]) {
  await installSyntheticApi(page, { permissions });
  await page.route("**/api/v1/automation-bridge", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectors, events: [], metrics: { received: 0, completed: 0, failed: 0 } } }) }));
  await page.route("**/api/v1/automation-bridge/connectors/*/meta/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "ACTIVE", mode: "TEST", setupState: "READY_TEST", page: { name: "Synthetic Page", maskedId: "••••0001" }, forms: [], permissionsValid: true, subscriptionVerified: true, lastVerifiedAt: "2026-09-01T00:00:00.000Z", lastTestAt: "2026-09-01T00:00:00.000Z", lastSuccessfulLeadAt: null, canActivateProduction: false } }) }));
  await page.route("**/api/v1/automation-bridge/connectors/*/whatsapp-setup/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "DRAFT", mode: "TEST", setupState: "NOT_CONFIGURED", accounts: [], selectedAccount: null, selectedNumber: null, grantedScopes: [], permissionsValid: false, webhookReady: false, authorizationVerifiedAt: null, numberVerifiedAt: null, lastTestAt: null, outboundEnabled: false, canActivateProduction: false } }) }));
}

test("Connections presents four truthful customer-facing channels", async ({ page }, testInfo) => {
  let writes = 0;
  let reads = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/api/v1/automation-bridge") && request.method() === "GET") reads += 1;
    if (path.includes("/api/v1/automation-bridge") && request.method() !== "GET") writes += 1;
  });
  await installConnections(page);
  await page.goto("/automation?section=connections");

  const cards = page.getByLabel("Business channels");
  await expect(cards.locator("article")).toHaveCount(4);
  await expect(cards.getByText("WhatsApp Business", { exact: true })).toBeVisible();
  await expect(cards.getByText("Meta Lead Ads", { exact: true })).toBeVisible();
  await expect(cards.getByText("Website", { exact: true })).toBeVisible();
  await expect(cards.getByText("Email", { exact: true })).toBeVisible();
  await expect(cards.getByText("Test ready", { exact: true })).toHaveCount(2);
  await expect(cards.getByText("Connected", { exact: true })).toHaveCount(0);
  await expect(cards.getByText("Paused", { exact: true })).toHaveCount(1);
  await expect(cards.getByText(/Outbound messaging remains disabled/)).toBeVisible();
  await expect(cards.getByText(/Real Meta activation remains disabled/)).toBeVisible();
  await expect(cards.getByText(/Draft, Unpaid and Unfulfilled/)).toBeVisible();
  await expect(cards).not.toContainText("synthetic-web");
  expect(writes).toBe(0);
  expect(reads).toBe(1);
  await expect(page.locator(".automation-workspace")).toHaveScreenshot(`automation-connections-overview-${testInfo.project.name}.png`);
});

for (const channel of ["whatsapp", "meta", "website", "email"] as const) {
  test(`${channel} details are URL-backed and survive refresh`, async ({ page }, testInfo) => {
    await installConnections(page);
    await page.goto(`/automation?section=connections&channel=${channel}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`channel=${channel}`));
    await expect(page.getByRole("link", { name: "All connections" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`channel=${channel}`));
    if (channel === "whatsapp") await expect(page.getByText("WhatsApp Business — Test Mode", { exact: true })).toBeVisible();
    if (channel === "meta") await expect(page.getByText("Meta Lead Ads", { exact: true })).toBeVisible();
    if (channel === "website") await expect(page.getByRole("heading", { name: "Website enquiries and draft orders" })).toBeVisible();
    if (channel === "email") await expect(page.getByRole("heading", { name: "Email delivery connector" })).toBeVisible();
    if (testInfo.project.name === "desktop") await expect(page.locator(".bridge-manager")).toHaveScreenshot(`automation-connection-${channel}-detail.png`);
  });
}

test("invalid channel returns to the Connections overview", async ({ page }) => {
  await installConnections(page);
  await page.goto("/automation?section=connections&channel=unknown");
  await expect(page.getByLabel("Business channels")).toBeVisible();
});

test("Back and Forward restore the selected connection", async ({ page }) => {
  await installConnections(page);
  await page.goto("/automation?section=connections");
  await page.getByLabel("Business channels").getByRole("link").first().click();
  await expect(page).toHaveURL(/channel=whatsapp/);
  await page.goBack();
  await expect(page.getByLabel("Business channels")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/channel=whatsapp/);
});

test("advanced controls are permission filtered and opening details does not mutate", async ({ page }) => {
  let writes = 0;
  page.on("request", (request) => { if (request.url().includes("/api/v1/automation-bridge") && request.method() !== "GET") writes += 1; });
  await installConnections(page, ["AUTOMATION_VIEW"]);
  await page.goto("/automation?section=connections");
  await expect(page.getByText("Advanced connector management")).toHaveCount(0);
  await page.goto("/automation?section=connections&channel=email");
  await expect(page.getByText("SMTP is not configured on the backend. Delivery remains blocked.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save delivery policy" })).toHaveCount(0);
  expect(writes).toBe(0);
});

test("advanced management remains accessible without exposing raw details on cards", async ({ page }) => {
  await installConnections(page);
  await page.goto("/automation?section=connections");
  const disclosure = page.getByText("Advanced connector management");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "New connector" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulate WhatsApp" })).toBeVisible();
});

test("Connections reports loading, empty and complete failure states honestly", async ({ page }) => {
  await installSyntheticApi(page);
  let releaseBridge: (() => void) | undefined;
  const bridgeGate = new Promise<void>((resolve) => { releaseBridge = resolve; });
  await page.route("**/api/v1/automation-bridge", async (route) => {
    await bridgeGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectors: [], events: [], metrics: {} } }) });
  });
  await page.goto("/automation?section=connections", { waitUntil: "commit" });
  await expect(page.locator(".connection-loading")).toHaveText("Loading connection status…");
  releaseBridge?.();
  await expect(page.getByLabel("Business channels").locator("article")).toHaveCount(4);
  await expect(page.getByText("Not configured", { exact: true })).toHaveCount(4);

  await page.unroute("**/api/v1/automation-bridge");
  await page.route("**/api/v1/automation-bridge", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Unavailable" } }) }));
  await page.reload();
  await expect(page.locator(".form-alert")).toHaveText("Unable to load Automation Bridge.");
  await expect(page.getByLabel("Business channels")).toHaveCount(0);
});
