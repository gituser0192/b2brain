import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ verify: vi.fn(), process: vi.fn() }));
vi.mock("../src/modules/automation-bridge/website-enquiry.service.js", () => ({ verifyWebsiteWebhook: state.verify }));
import { WebsiteOrderService } from "../src/modules/automation-bridge/website-order.service.js";
const connector = { id: "10000000-0000-4000-8000-00000000000a", organizationId: "00000000-0000-4000-8000-00000000000a", createdById: "20000000-0000-4000-8000-00000000000a", configuration: { websiteOrderIngestionEnabled: true } };
const payload = { version: "1", eventId: "order-event-1", submittedAt: new Date().toISOString(), externalOrderId: "shop-1001", customer: { email: "buyer@example.test" }, currency: "INR", items: [{ sku: "COURSE-1", quantity: 2, displayUnitPrice: 1 }], submittedTotal: 2 };
describe("website order adapter", () => {
  beforeEach(() => { vi.clearAllMocks(); state.verify.mockResolvedValue({ connector, eventId: payload.eventId }); state.process.mockResolvedValue({ duplicate: false, status: "AWAITING_APPROVAL", reviewRequired: true, correlationId: crypto.randomUUID() }); });
  it("reuses verification, derives the tenant and delegates to the shared processor", async () => {
    await new WebsiteOrderService({ processVerifiedWebsiteOrder: state.process } as never).accept("public", Buffer.from("{}"), "signature", "timestamp", payload.eventId, payload);
    expect(state.verify).toHaveBeenCalledWith("public", expect.any(Buffer), "signature", "timestamp", payload.eventId, 128 * 1024);
    expect(state.process).toHaveBeenCalledWith(connector.organizationId, connector.createdById, expect.objectContaining({ channel: "WEBSITE_ORDER", eventType: "ORDER_CREATED", connectorId: connector.id }), expect.objectContaining({ externalOrderId: payload.externalOrderId }));
  });
  it("rejects a connector without explicitly authorized order ingestion", async () => {
    state.verify.mockResolvedValue({ connector: { ...connector, configuration: {} }, eventId: payload.eventId });
    await expect(new WebsiteOrderService({ processVerifiedWebsiteOrder: state.process } as never).accept("public", Buffer.from("{}"), "s", "t", payload.eventId, payload)).rejects.toMatchObject({ code: "WEBSITE_ORDER_UNAVAILABLE" });
    expect(state.process).not.toHaveBeenCalled();
  });
  it("rejects header/payload event substitution", async () => {
    state.verify.mockResolvedValue({ connector, eventId: "different" });
    await expect(new WebsiteOrderService({ processVerifiedWebsiteOrder: state.process } as never).accept("public", Buffer.from("{}"), "s", "t", "different", payload)).rejects.toMatchObject({ code: "INVALID_WEBSITE_ORDER" });
  });
});
