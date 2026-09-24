import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { EmailService } from "../src/shared/email/email.service.js";

afterEach(() => vi.restoreAllMocks());

it("accepts a valid access request only when email delivery is accepted", async () => {
  const send = vi.spyOn(EmailService.prototype, "send").mockResolvedValue({ delivered: true, preview: false, messageId: "test", error: null });
  const body = { name: "Test Owner", email: "owner@example.com", organization: "Test Company", message: "We need help setting up a workspace.", website: "" };
  const response = await request(app).post("/api/v1/public/request-access").send(body);
  expect(response.status).toBe(202);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "sathsupport@sathos.in", subject: "SATHOS access request" }));
  send.mockResolvedValue({ delivered: false, preview: false, messageId: null, error: "Unavailable" });
  const failed = await request(app).post("/api/v1/public/request-access").send(body);
  expect(failed.status).toBe(503);
});
