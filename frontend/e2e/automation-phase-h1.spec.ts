import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

test("Automation sections are URL-backed and restore with history and refresh", async ({ syntheticPage: page }) => {
  await page.goto("/automation");
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Recommended next step", { exact: true })).toBeVisible();

  for (const section of ["Connections", "Automations", "Approvals", "Activity"] as const) {
    await page.getByRole("link", { name: section, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`section=${section.toLowerCase()}`));
    await expect(page.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
  }

  await page.reload();
  await expect(page.getByRole("link", { name: "Activity", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page.getByRole("link", { name: "Approvals", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page.getByRole("link", { name: "Activity", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Overview stays compact, truthful, and does not trigger external actions", async ({ page }) => {
  let writes = 0;
  const reads = new Map<string, number>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (["/automation-bridge", "/automation-bridge/message-drafts", "/agents", "/agents/runs/centre"].includes(path)) {
      reads.set(path, (reads.get(path) ?? 0) + 1);
    }
  });
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() !== "GET") writes += 1;
    await route.fallback();
  });
  await installSyntheticApi(page, { richAutomation: true });
  await page.goto("/automation");

  await expect(page.getByLabel("Automation summary")).toBeVisible();
  await expect(page.getByText("Connections configured")).toBeVisible();
  await expect(page.getByText("Integration event inbox")).toHaveCount(0);
  await expect(page.getByText(/Trace /)).toHaveCount(0);
  await expect(page.locator(".automation-overview-grid > section article")).toHaveCount(1);
  expect(writes).toBe(0);
  expect(Object.fromEntries(reads)).toEqual({
    "/automation-bridge": 1,
    "/automation-bridge/message-drafts": 1,
    "/agents": 1,
    "/agents/runs/centre": 1,
  });
  await expect(page.locator(".automation-workspace")).toHaveScreenshot("automation-phase-h1-overview.png");
});

test("Overview reports API failure without inventing activity", async ({ page }) => {
  await installSyntheticApi(page);
  for (const path of ["automation-bridge", "automation-bridge/message-drafts", "agents", "agents/runs/centre"]) {
    await page.route(`**/api/v1/${path}`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  }
  await page.goto("/automation");
  await expect(page.locator(".automation-overview [role='alert']")).toHaveText("Automation information is unavailable right now.");
  await expect(page.getByText("No recent automation activity.")).toBeVisible();
});

test("read-only users cannot expose Automation management controls", async ({ page }) => {
  await installSyntheticApi(page, { permissions: ["AUTOMATION_VIEW"], richAutomation: true });
  await page.goto("/automation?section=connections");
  await expect(page.getByRole("button", { name: "New connector" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Configure WhatsApp" })).toHaveCount(0);
  await page.goto("/automation?section=automations");
  await expect(page.getByRole("button", { name: "Create agent" })).toHaveCount(0);

  await installSyntheticApi(page, { permissions: ["AUTOMATION_VIEW"], metaAutomation: true });
  await page.route("**/api/v1/automation-bridge/connectors/*/meta/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "DRAFT", mode: "TEST", setupState: "DRAFT", page: null, forms: [], permissionsValid: false, subscriptionVerified: false, lastVerifiedAt: null, lastTestAt: null, lastSuccessfulLeadAt: null, canActivateProduction: false } }) }));
  await page.goto("/automation?section=connections");
  await expect(page.getByRole("button", { name: "Connect Meta" })).toBeDisabled();
});

test("disabled Automation service shows the shell access boundary", async ({ page }) => {
  await installSyntheticApi(page, { enabledServices: ["CRM", "FINANCE"] });
  await page.goto("/automation?section=connections");
  await expect(page.locator(".dashboard-notice.error")).toContainText("Access unavailable");
  await expect(page.getByRole("navigation", { name: "Automation sections" })).toHaveCount(0);
});

test("Automation navigation is keyboard accessible, responsive, and the sticky header is opaque", async ({ syntheticPage: page }) => {
  await page.goto("/automation");
  await page.getByRole("link", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Connections", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/section=connections/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.locator(".dashboard-header")).toHaveCSS("background-color", "rgb(247, 249, 252)");
});

test("existing Meta and WhatsApp Test Mode setup remains reachable", async ({ page }) => {
  await installSyntheticApi(page, { metaAutomation: true });
  await page.route("**/api/v1/automation-bridge/connectors/*/meta/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "DRAFT", mode: "TEST", setupState: "DRAFT", page: null, forms: [], permissionsValid: false, subscriptionVerified: false, lastVerifiedAt: null, lastTestAt: null, lastSuccessfulLeadAt: null, canActivateProduction: false } }) }));
  await page.goto("/automation?section=connections");
  await expect(page.getByText("Meta Lead Ads", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST MODE", { exact: true })).toBeVisible();
});

test("existing WhatsApp Business Test Mode setup remains reachable", async ({ page }) => {
  await installSyntheticApi(page, { whatsappAutomation: true });
  await page.route("**/api/v1/automation-bridge/connectors/*/whatsapp-setup/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectorStatus: "DRAFT", mode: "TEST", setupState: "NOT_CONFIGURED", accounts: [], selectedAccount: null, selectedNumber: null, grantedScopes: [], permissionsValid: false, webhookReady: false, authorizationVerifiedAt: null, numberVerifiedAt: null, lastTestAt: null, outboundEnabled: false, canActivateProduction: false } }) }));
  await page.goto("/automation?section=connections");
  await expect(page.getByText("WhatsApp Business — Test Mode", { exact: true })).toBeVisible();
});
