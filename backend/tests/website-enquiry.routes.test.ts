import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebsiteEnquiryService } from "../src/modules/automation-bridge/website-enquiry.service.js";
import { websiteEnquiryWebhookRouter } from "../src/modules/automation-bridge/website-enquiry.routes.js";

const app = express();
app.use(express.json({ verify: (req, _res, buffer) => { (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
app.use("/enquiries", websiteEnquiryWebhookRouter);
app.use((error: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  res.status(error.statusCode ?? 500).json({ success: false, code: error.code ?? "INTERNAL_ERROR" });
});

const payload = { version: "1", eventId: "web-route-001", submittedAt: new Date().toISOString(), email: "visitor@example.test", message: "Need details" };
const headers = { "x-b2brain-signature": "v1=" + "1".repeat(64), "x-b2brain-timestamp": String(Math.floor(Date.now() / 1000)), "x-b2brain-event-id": payload.eventId };

describe("website enquiry public route", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns only a bounded acknowledgement", async () => {
    vi.spyOn(WebsiteEnquiryService.prototype, "accept").mockResolvedValue({
      duplicate: false, processingStatus: "COMPLETED", correlationId: "b516e37e-06a8-47e7-a1e1-9364a5630307",
    } as never);
    const response = await request(app).post("/enquiries/public-id").set(headers).send(payload).expect(202);
    expect(response.body).toEqual({ success: true, message: "Enquiry accepted.", data: {
      accepted: true, duplicate: false, status: "COMPLETED", referenceId: "b516e37e-06a8-47e7-a1e1-9364a5630307",
    } });
    expect(JSON.stringify(response.body)).not.toMatch(/organizationId|customerId|inquiryId|confidence|secret/i);
  });

  it("rejects non-JSON requests", async () => {
    const accept = vi.spyOn(WebsiteEnquiryService.prototype, "accept");
    await request(app).post("/enquiries/public-id").set("content-type", "text/plain").send("hello").expect(415);
    expect(accept).not.toHaveBeenCalled();
  });

  it("rate limits a connector and IP burst", async () => {
    vi.spyOn(WebsiteEnquiryService.prototype, "accept").mockResolvedValue({
      duplicate: false, processingStatus: "COMPLETED", correlationId: "b516e37e-06a8-47e7-a1e1-9364a5630307",
    } as never);
    const connector = `burst-${crypto.randomUUID()}`;
    for (let index = 0; index < 30; index += 1)
      await request(app).post(`/enquiries/${connector}`).set(headers).send(payload).expect(202);
    const response = await request(app).post(`/enquiries/${connector}`).set(headers).send(payload).expect(429);
    expect(response.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
  });
});
