import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  META_INSTAGRAM_CONNECT_ENABLED: true, META_INSTAGRAM_APP_ID: "123456", META_INSTAGRAM_APP_SECRET: "synthetic-private-secret",
  META_INSTAGRAM_REDIRECT_URI: "https://api.example.test/api/v1/instagram-login/redirect", META_INSTAGRAM_API_VERSION: "v26.0", NODE_ENV: "production",
}));
vi.mock("../src/config/env.js", () => ({ env }));
import { instagramAuthorizationUrl, OfficialInstagramLoginProvider } from "../src/modules/automation-bridge/instagram-login.provider.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { globalThis.fetch = vi.fn(); });
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });

describe("official Instagram Login adapter without live calls", () => {
  it("builds the exact minimal code authorization URL without a secret", () => {
    const url = new URL(instagramAuthorizationUrl("synthetic-state"));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_messages");
    expect(url.searchParams.get("redirect_uri")).toBe(env.META_INSTAGRAM_REDIRECT_URI);
    expect(url.toString()).not.toContain(env.META_INSTAGRAM_APP_SECRET);
  });

  it("exchanges the code server-side, discovers /me.user_id, and subscribes to messages only", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json({ data: [{ access_token: "short", user_id: "app-scoped-id", permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }] }) as never);
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000, token_type: "bearer" }) as never);
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", id: "different-app-scoped-id", username: "professional", account_type: "BUSINESS" }) as never);
    mocked.mockResolvedValueOnce(json({ success: true }) as never);
    const provider = new OfficialInstagramLoginProvider();
    const stages: string[] = [];
    const result = await provider.exchange("synthetic-code", stage => stages.push(stage));
    expect(stages).toEqual(["CODE_EXCHANGE", "LONG_LIVED_TOKEN_EXCHANGE", "ACCOUNT_DISCOVERY", "SCOPE_VALIDATION"]);
    expect(result).toMatchObject({ accountId: "123456789", token: "long", username: "professional" });
    expect(mocked.mock.calls[0]?.[0]).toBe("https://api.instagram.com/oauth/access_token");
    expect((mocked.mock.calls[0]?.[1]?.body as FormData).get("grant_type")).toBe("authorization_code");
    expect(new URL(mocked.mock.calls[2]?.[0] as string).pathname).toBe("/v26.0/me");
    expect(await provider.subscribe(result.accountId, result.token)).toBe(true);
    const subscription = new URL(mocked.mock.calls[3]?.[0] as string);
    expect(subscription.pathname).toBe("/v26.0/123456789/subscribed_apps");
    expect(subscription.searchParams.get("subscribed_fields")).toBe("messages");
    expect(mocked.mock.calls[3]?.[1]?.method).toBe("POST");
  });

  it("fails closed on provider errors without returning the provider body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ access_token: "sensitive" }) } as never);
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed." });
  });

  it.each([
    ["CODE_EXCHANGE", 0], ["LONG_LIVED_TOKEN_EXCHANGE", 1], ["ACCOUNT_DISCOVERY", 2], ["SCOPE_VALIDATION", 3],
  ])("identifies the failing provider stage %s", async (expected, badAt) => {
    const responses = [
      json(badAt === 0 ? {} : { access_token: "short", user_id: "app-scoped-id", permissions: badAt === 3 ? [] : ["instagram_business_basic", "instagram_business_manage_messages"] }),
      json(badAt === 1 ? {} : { access_token: "long", expires_in: 5184000 }),
      json(badAt === 2 ? {} : { user_id: "123456789", account_type: "BUSINESS" }),
    ];
    for (const response of responses) vi.mocked(globalThis.fetch).mockResolvedValueOnce(response);
    const stages: string[] = [];
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code", stage => stages.push(stage))).rejects.toBeInstanceOf(Error);
    expect(stages.at(-1)).toBe(expected);
  });

  it("uses the documented long-lived token refresh endpoint", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json({ access_token: "refreshed", expires_in: 5184000 }) as never);
    await expect(new OfficialInstagramLoginProvider().refresh("old-synthetic-token")).resolves.toMatchObject({ token: "refreshed" });
    const refresh = new URL(mocked.mock.calls[0]?.[0] as string);
    expect(refresh.origin + refresh.pathname).toBe("https://graph.instagram.com/refresh_access_token");
    expect(refresh.searchParams.get("grant_type")).toBe("ig_refresh_token");
  });
  it("rejects oversized, non-JSON, malformed, redirected and excessive-expiry responses without leaking secrets", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    for (const response of [
      new Response("x".repeat(65 * 1024), { headers: { "content-type": "application/json" } }),
      new Response("<html>secret</html>", { headers: { "content-type": "text/html" } }),
      new Response("{secret", { headers: { "content-type": "application/json" } }),
      new Response("", { status: 302, headers: { location: "https://example.test", "content-type": "application/json" } }),
    ]) {
      mocked.mockResolvedValueOnce(response);
      await expect(new OfficialInstagramLoginProvider().refresh("synthetic-secret")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed." });
    }
    mocked.mockResolvedValueOnce(json({ access_token: "synthetic", expires_in: 999999999 }));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-secret")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
    mocked.mockResolvedValueOnce(json({ access_token: "x".repeat(8193), expires_in: 5000 }));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-secret")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
  });
  it("fails closed on a timed-out provider request without retrying or exposing the token", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockRejectedValueOnce(new DOMException("synthetic-private-token", "TimeoutError"));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-private-token")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed.", diagnosticCategory: "TIMEOUT" });
    expect(mocked).toHaveBeenCalledTimes(1);
  });
  it("classifies authentication rejection and malformed responses without provider text", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 10, message: "synthetic-private-token" } }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-private-token")).rejects.toMatchObject({ diagnosticCategory: "HTTP_AUTH_REJECTION", code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed." });
    mocked.mockResolvedValueOnce(new Response("{synthetic-private-token", { headers: { "content-type": "application/json" } }));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-private-token")).rejects.toMatchObject({ diagnosticCategory: "MALFORMED_RESPONSE", code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed." });
  });
  it("classifies a documented credential error without returning provider text", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 190, message: "synthetic-private-token" } }), { status: 400, headers: { "content-type": "application/json" } }));
    await expect(new OfficialInstagramLoginProvider().refresh("synthetic-private-token")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED", message: "Instagram reconnection is required." });
  });
});
