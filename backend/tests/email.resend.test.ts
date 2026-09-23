import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { EmailService } from "../src/shared/email/email.service.js";

const originalKey = env.RESEND_API_KEY;

afterEach(() => {
  env.RESEND_API_KEY = originalKey;
  vi.restoreAllMocks();
});

describe("Resend transactional email", () => {
  it("sends a password-reset email through HTTPS when configured", async () => {
    env.RESEND_API_KEY = "re_test_key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "email-1" }) } as Response);

    const result = await new EmailService().passwordReset("owner@example.com", "/reset-password?token=test-token");

    expect(result).toMatchObject({ delivered: true, messageId: "email-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer re_test_key" });
    expect(JSON.parse(options?.body as string)).toMatchObject({
      from: "SATHOS <notifications@mail.sathos.in>",
      to: ["owner@example.com"],
      subject: "Reset your SATHOS password",
    });
  });

  it("does not silently fall back to SMTP or expose provider errors", async () => {
    env.RESEND_API_KEY = "re_test_key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve("private provider response") } as Response);

    const result = await new EmailService().invitation("member@example.com", "Test", "/accept-invitation?token=test-token");

    expect(result).toMatchObject({ delivered: false, error: "Email provider rejected the message (HTTP 403)." });
    expect(JSON.stringify(result)).not.toContain("private provider response");
  });
});
