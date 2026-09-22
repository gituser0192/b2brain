import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("private staging HTTP boundaries", () => {
  it("exposes a minimal liveness response with security headers", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: "healthy" } });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("allows only the explicitly configured browser origins", async () => {
    const allowed = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", env.FRONTEND_URL)
      .set("Access-Control-Request-Method", "POST");
    expect(allowed.headers["access-control-allow-origin"]).toBe(env.FRONTEND_URL);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const additional = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", env.ADDITIONAL_FRONTEND_ORIGIN!)
      .set("Access-Control-Request-Method", "POST");
    expect(additional.headers["access-control-allow-origin"]).toBe(env.ADDITIONAL_FRONTEND_ORIGIN);
    expect(additional.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://unapproved.example")
      .set("Access-Control-Request-Method", "POST");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not mount external intake channels while disabled", async () => {
    expect(env.EXTERNAL_CHANNELS_ENABLED).toBe(false);
    const [forms, intake, whatsapp, website, websiteOrder, metaLead] = await Promise.all([
      request(app).get("/api/v1/public/forms/not-enabled"),
      request(app).post("/api/v1/webhooks/intake/not-enabled").send({}),
      request(app).get("/api/v1/webhooks/whatsapp"),
      request(app).post("/api/v1/integrations/website/enquiries/not-enabled").send({}),
      request(app).post("/api/v1/integrations/website/orders/not-enabled").send({}),
      request(app).post("/api/v1/integrations/meta/leads").send({}),
    ]);
    expect(forms.status).toBe(404);
    expect(intake.status).toBe(404);
    expect(whatsapp.status).toBe(404);
    expect(website.status).toBe(404);
    expect(websiteOrder.status).toBe(404);
    expect(metaLead.status).toBe(404);
  });

  it("returns safe malformed-request errors without stack traces", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "The request body is not valid JSON.",
      code: "INVALID_JSON",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|secret|password/i);
  });
});
