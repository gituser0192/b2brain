import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const connector = { id: "connector-h4", name: "Website Test Mode", type: "WEBSITE", provider: "B2BRAIN_SIMULATOR", status: "ACTIVE", mode: "MANUAL_APPROVAL", webhookKey: "safe-test-key", lastReceivedAt: "2026-09-12T10:00:00.000Z", credentialsConfiguredAt: null, whatsappPhoneNumberId: null, _count: { events: 5, messageDrafts: 1 } };
const events = [
  { id: "event-lead", externalEventId: "synthetic-1", eventName: "website.enquiry.received", kind: "INQUIRY", status: "AWAITING_APPROVAL", traceId: "trace-safe-1", failureMessage: null, resultType: null, createdAt: "2026-09-12T10:00:00.000Z", connector: { name: connector.name }, attempts: [], payload: { contactName: "Synthetic Customer", subject: "Pricing enquiry" } },
  { id: "event-order", externalEventId: "synthetic-2", eventName: "website.order.received", kind: "ORDER", status: "AWAITING_APPROVAL", traceId: "trace-safe-2", failureMessage: null, resultType: null, createdAt: "2026-09-12T09:00:00.000Z", connector: { name: connector.name }, attempts: [], payload: { subject: "Draft order review" } },
  { id: "event-complete", externalEventId: "synthetic-3", eventName: "website.enquiry.received", kind: "INQUIRY", status: "COMPLETED", traceId: "trace-safe-3", failureMessage: null, resultType: "CUSTOMER_MATCHED", createdAt: "2026-09-11T10:00:00.000Z", connector: { name: connector.name }, attempts: [], payload: { contactName: "Synthetic Customer" } },
  { id: "event-failed", externalEventId: "synthetic-4", eventName: "connection.test", kind: "INQUIRY", status: "FAILED", traceId: "trace-safe-4", failureMessage: "Synthetic connection test failed.", resultType: null, createdAt: "2026-09-10T10:00:00.000Z", connector: { name: connector.name }, attempts: [], payload: {} },
  { id: "event-quarantine", externalEventId: "synthetic-5", eventName: "website.enquiry.received", kind: "INQUIRY", status: "QUARANTINED", traceId: "trace-safe-5", failureMessage: null, resultType: null, createdAt: "2026-09-09T10:00:00.000Z", connector: { name: connector.name }, attempts: [], payload: {} },
];
const draft = { id: "draft-h4", connectorId: connector.id, eventId: "event-lead", recipient: "+910000000000", body: "Synthetic test reply draft.", status: "PENDING_APPROVAL", failureMessage: null, createdAt: "2026-09-12T10:05:00.000Z", connector: { name: "WhatsApp Simulator", provider: "B2BRAIN_SIMULATOR" } };

async function installH4(page: Parameters<typeof installSyntheticApi>[0], permissions = ["AUTOMATION_VIEW", "AUTOMATION_MANAGE", "APPROVAL_VIEW", "FINANCE_VIEW", "INQUIRY_VIEW", "AUDIT_VIEW"]) {
  await installSyntheticApi(page, { permissions });
  await page.route("**/api/v1/automation-bridge", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { connectors: [connector], events, metrics: {} } }) }));
  await page.route("**/api/v1/automation-bridge/message-drafts", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [draft] }) }));
}

test("Approvals is truthful, permission-aware and read-only until a decision", async ({ page }, testInfo) => {
  let writes = 0;
  page.on("request", request => { if (request.url().includes("/api/v1/") && request.method() !== "GET" && !request.url().includes("/auth/refresh")) writes += 1; });
  await installH4(page);
  await page.goto("/automation?section=approvals");
  await expect(page.getByText("Waiting for your decision")).toBeVisible();
  await expect(page.locator(".approval-summary strong")).toHaveText("3");
  await expect(page.getByRole("button", { name: "Finance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set aside for review" }).first()).toBeVisible();
  await expect(page.getByText("website.enquiry.received").first()).toBeHidden();
  await page.getByText("Technical details").first().click();
  await expect(page.getByText("trace-safe-1")).toBeVisible();
  expect(writes).toBe(0);
  await expect(page.locator(".bridge-manager-approvals .bridge-event").first()).toHaveScreenshot(`automation-approvals-${testInfo.project.name}.png`);
});

test("Activity uses customer language, bounded history and stable filters", async ({ page }, testInfo) => {
  await installH4(page);
  await page.goto("/automation?section=activity");
  await expect(page.getByText("Lead enquiry received").first()).toBeVisible();
  await expect(page.getByText("website.enquiry.received").first()).toBeHidden();
  await expect(page.getByRole("button", { name: /See 2 more/ })).toBeVisible();
  await page.getByRole("button", { name: "Failed" }).click();
  await expect(page.getByText("Connection test failed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/section=activity/);
  await expect(page.locator(".bridge-manager-activity .bridge-event").first()).toHaveScreenshot(`automation-activity-${testInfo.project.name}.png`);
});

test("Approvals hides Finance details and decisions without permission", async ({ page }) => {
  await installH4(page, ["AUTOMATION_VIEW", "APPROVAL_VIEW", "INQUIRY_VIEW"]);
  await page.goto("/automation?section=approvals");
  await expect(page.getByRole("button", { name: "Finance" })).toHaveCount(0);
  await expect(page.getByText("Draft order review")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
  await expect(page.getByText(/Test draft only/)).toBeVisible();
});
