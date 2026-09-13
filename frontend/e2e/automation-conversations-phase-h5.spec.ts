import type { Route } from "@playwright/test";
import { expect, installSyntheticApi, test } from "./fixtures/synthetic-workspace";

const conversationId = "11111111-1111-4111-8111-111111111111";
const customerId = "cus-e2e-001";
const summary = {
  conversationId,
  displayName: "Synthetic WhatsApp Customer",
  maskedContact: "••••3210",
  channel: "WHATSAPP",
  classification: "SALES_OPPORTUNITY",
  status: "REVIEWING",
  latestMessagePreview: "Please share the approved annual plan and next steps.",
  lastActivityAt: "2026-09-13T10:00:00.000Z",
  pendingApprovalCount: 1,
  needsAttention: true,
};
const detail = {
  conversation: { ...summary, subject: "Annual plan", customerId, humanReviewRequested: false },
  messages: [
    { id: "event-h5-inbound", direction: "INBOUND", body: "Please share the approved annual plan and next steps.", status: "RECEIVED", occurredAt: "2026-09-13T10:00:00.000Z" },
    { id: "draft-h5-outbound", direction: "OUTBOUND", body: "A test response is waiting for review. It has not been sent externally.", status: "PENDING_APPROVAL", occurredAt: "2026-09-13T10:05:00.000Z" },
  ],
  pendingApprovalCount: 1,
  connectors: [{ id: "con-e2e-whatsapp", name: "Synthetic WhatsApp Simulator", provider: "B2BRAIN_SIMULATOR" }],
  pagination: { limit: 200, hasMore: false },
};

async function installH5(page: Parameters<typeof installSyntheticApi>[0], options: { readOnly?: boolean; empty?: boolean; failList?: boolean; failDetail?: boolean } = {}) {
  await installSyntheticApi(page, { permissions: options.readOnly ? ["AUTOMATION_VIEW", "APPROVAL_VIEW", "INQUIRY_VIEW", "CRM_VIEW"] : ["AUTOMATION_VIEW", "AUTOMATION_MANAGE", "APPROVAL_VIEW", "INQUIRY_VIEW", "CRM_VIEW"] });
  const counts = { summaries: 0, details: 0, legacy: 0, mutations: 0, external: 0 };
  const fulfillList = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "GET") counts.mutations += 1;
    counts.summaries += 1;
    return route.fulfill({ status: options.failList ? 503 : 200, contentType: "application/json", body: JSON.stringify(options.failList ? { success: false, message: "Synthetic inbox failure." } : { success: true, data: { conversations: options.empty ? [] : [summary], pagination: { page: 1, limit: 25, hasMore: false } } }) });
  };
  await page.route("**/api/v1/automation-bridge/whatsapp-conversations", fulfillList);
  await page.route("**/api/v1/automation-bridge/whatsapp-conversations?*", fulfillList);
  await page.route("**/api/v1/automation-bridge/whatsapp-conversations/*", async route => {
    if (route.request().method() !== "GET") counts.mutations += 1;
    counts.details += 1;
    return route.fulfill({ status: options.failDetail ? 404 : 200, contentType: "application/json", body: JSON.stringify(options.failDetail ? { success: false, message: "Conversation was not found." } : { success: true, data: detail }) });
  });
  page.on("request", request => {
    if (request.url().includes("/whatsapp-workspace")) counts.legacy += 1;
    if (/graph\.facebook|openai|python-agent|agent-service/i.test(request.url())) counts.external += 1;
  });
  return counts;
}

test("customer conversation Inbox is URL-backed, lazy and non-mutating", async ({ page }, testInfo) => {
  const counts = await installH5(page);
  await page.goto("/automation?section=approvals");
  await page.getByRole("link", { name: /Customer conversations/ }).click();
  await expect(page).toHaveURL(/section=approvals&view=conversations/);
  await expect(page.getByRole("heading", { name: "Customer conversations" })).toBeVisible();
  await expect(page.getByText("••••3210")).toBeVisible();
  expect(counts).toMatchObject({ summaries: 1, details: 0, legacy: 0, mutations: 0, external: 0 });

  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".whatsapp-inbox-layout")).toHaveScreenshot("automation-conversation-inbox-mobile.png");
  }
  await page.getByRole("button", { name: /Synthetic WhatsApp Customer/ }).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${conversationId}`));
  await expect(page.getByRole("heading", { name: "Synthetic WhatsApp Customer" })).toBeVisible();
  await expect(page.getByText("A test response is waiting for review.", { exact: false })).toBeVisible();
  await expect.poll(() => counts.details).toBe(1);
  expect(counts).toMatchObject({ summaries: 1, legacy: 0, mutations: 0, external: 0 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Synthetic WhatsApp Customer" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Customer conversations" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Synthetic WhatsApp Customer" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const detailCapture = testInfo.project.name === "mobile" ? page.locator(".whatsapp-inbox-composer") : page.locator(".whatsapp-inbox-layout");
  await expect(detailCapture).toHaveScreenshot(`automation-conversation-detail-${testInfo.project.name}.png`);
  expect(counts.mutations).toBe(0);
  expect(counts.external).toBe(0);
});

test("conversation filters, explicit draft and escalation preserve safety", async ({ page }) => {
  const counts = await installH5(page);
  let drafts = 0;
  let escalations = 0;
  await page.route("**/api/v1/automation-bridge/whatsapp-template-drafts", async route => {
    drafts += 1;
    await new Promise(resolve => setTimeout(resolve, 80));
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, data: { id: "draft-new" } }) });
  });
  await page.route("**/api/v1/automation-bridge/whatsapp-escalations", route => {
    escalations += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { escalated: true } }) });
  });
  await page.goto("/automation?section=approvals&view=conversations");
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await expect(page.getByRole("button", { name: /Synthetic WhatsApp Customer/ })).toBeVisible();
  await page.getByLabel("Search conversations").fill("missing");
  await expect(page.getByText("No matching conversations")).toBeVisible();
  await page.getByLabel("Search conversations").fill("");
  await page.getByRole("button", { name: /Synthetic WhatsApp Customer/ }).click();
  await page.getByLabel("Draft reply").fill("Synthetic reply for approval only.");
  const create = page.getByRole("button", { name: "Create test approval draft" });
  await create.dblclick();
  await expect(page.getByText("External delivery remains disabled.")).toBeVisible();
  expect(drafts).toBe(1);
  page.once("dialog", dialog => dialog.accept("Synthetic escalation reason"));
  await page.getByRole("button", { name: "Escalate to person" }).click();
  await expect(page.getByText("A person responsible for this inquiry has been notified.")).toBeVisible();
  expect(escalations).toBe(1);
  expect(counts.external).toBe(0);
});

test("conversation Inbox handles empty, read-only and unavailable states truthfully", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "State characterisation is captured once on desktop.");
  await installH5(page, { readOnly: true, empty: true });
  await page.goto("/automation?section=approvals&view=conversations");
  await expect(page.getByText("Read-only access.", { exact: false })).toBeVisible();
  await expect(page.getByText("No conversations yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create test approval draft" })).toHaveCount(0);
  await expect(page.locator(".whatsapp-inbox-layout")).toHaveScreenshot("automation-conversation-empty-read-only-desktop.png");

  await installH5(page, { readOnly: true, failDetail: true });
  await page.goto(`/automation?section=approvals&view=conversations&conversation=${conversationId}`);
  await expect(page.getByText("Conversation unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("This conversation is unavailable.")).toBeVisible();
});
