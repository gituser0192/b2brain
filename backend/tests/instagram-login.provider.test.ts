import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  META_INSTAGRAM_CONNECT_ENABLED: true, META_INSTAGRAM_APP_ID: "123456", META_INSTAGRAM_APP_SECRET: "synthetic-private-secret",
  META_INSTAGRAM_REDIRECT_URI: "https://api.example.test/api/v1/instagram-login/redirect", META_INSTAGRAM_API_VERSION: "v26.0", NODE_ENV: "production",
}));
const logs = vi.hoisted(() => ({ info: vi.fn<(fields: unknown, message: string) => void>() }));
vi.mock("../src/config/env.js", () => ({ env }));
vi.mock("../src/config/logger.js", () => ({ logger: logs }));
import { instagramAuthorizationUrl, OfficialInstagramLoginProvider } from "../src/modules/automation-bridge/instagram-login.provider.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; logs.info.mockClear(); });
beforeEach(() => { globalThis.fetch = vi.fn(); });
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
const rawJson = (body: string) => new Response(body, { status: 200, headers: { "content-type": "application/json" } });

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
    mocked.mockResolvedValueOnce(json({ data: [{ access_token: "short", user_id: "987654321", permissions: " instagram_business_basic , instagram_business_manage_messages , instagram_business_basic " }] }) as never);
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000, token_type: "bearer" }) as never);
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", id: "different-app-scoped-id", username: "professional", account_type: "BUSINESS" }) as never);
    mocked.mockResolvedValueOnce(json({ success: true }) as never);
    const provider = new OfficialInstagramLoginProvider();
    const stages: string[] = [];
    const result = await provider.exchange("synthetic-code", stage => stages.push(stage));
    expect(stages).toEqual(["CODE_EXCHANGE", "LONG_LIVED_TOKEN_EXCHANGE", "ACCOUNT_DISCOVERY", "SCOPE_VALIDATION"]);
    expect(result).toMatchObject({ accountId: "123456789", token: "long", username: "professional", scopes: ["instagram_business_basic", "instagram_business_manage_messages"] });
    expect(mocked.mock.calls[0]?.[0]).toBe("https://api.instagram.com/oauth/access_token");
    expect((mocked.mock.calls[0]?.[1]?.body as FormData).get("grant_type")).toBe("authorization_code");
    expect(new URL(mocked.mock.calls[2]?.[0] as string).pathname).toBe("/v26.0/me");
    expect(await provider.subscribe(result.accountId, result.token)).toBe(true);
    const subscription = new URL(mocked.mock.calls[3]?.[0] as string);
    expect(subscription.pathname).toBe("/v26.0/123456789/subscribed_apps");
    expect(subscription.searchParams.get("subscribed_fields")).toBe("messages");
    expect(mocked.mock.calls[3]?.[1]?.method).toBe("POST");
    expect(logs.info).not.toHaveBeenCalled();
  });

  it("accepts the observed flat response with a safe numeric ID and normalized permission array", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json({ access_token: "short", user_id: 9007199254740991, permissions: [" instagram_business_basic ", "instagram_business_manage_messages", "instagram_business_basic"] }));
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000 }));
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", account_type: "BUSINESS" }));
    const result = await new OfficialInstagramLoginProvider().exchange("synthetic-code");
    expect(result).toMatchObject({ token: "long", accountId: "123456789", scopes: ["instagram_business_basic", "instagram_business_manage_messages"] });
    expect(mocked).toHaveBeenCalledTimes(3);
    expect(logs.info).not.toHaveBeenCalled();
  });

  it("preserves the exact above-safe numeric lexeme from authored raw JSON", async () => {
    const id = "9007199254740993";
    const body = `{"access_token":"short","user_id":${id},"permissions":["instagram_business_basic","instagram_business_manage_messages"]}`;
    expect(body).toContain(`"user_id":${id}`);
    expect(JSON.stringify({ user_id: Number(id) })).not.toContain(id); // JSON.stringify of a JS number would already be rounded.
    const parse = JSON.parse;
    let internalId: unknown;
    const spy = vi.spyOn(JSON, "parse").mockImplementation((text, reviver): unknown => parse(text, reviver && ((key: string, value: unknown, context?: { source?: string }) => {
      const transformed = (reviver as (key: string, value: unknown, context?: { source?: string }) => unknown)(key, value, context);
      if (key === "user_id") internalId = transformed;
      return transformed;
    })) as unknown);
    try {
      const mocked = vi.mocked(globalThis.fetch);
      mocked.mockResolvedValueOnce(rawJson(body));
      mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000 }));
      mocked.mockResolvedValueOnce(json({ user_id: "123456789", account_type: "BUSINESS" }));
      await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).resolves.toMatchObject({ token: "long", accountId: "123456789" });
      expect(typeof Reflect.get(internalId as object, "digits")).toBe("string");
      expect(Reflect.get(internalId as object, "digits")).toBe(id);
      expect(JSON.stringify(internalId)).toBe("{}");
      expect(mocked).toHaveBeenCalledTimes(3);
      expect(logs.info).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  it("accepts the 32-digit boundary in raw numeric form", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(rawJson(`{"access_token":"short","user_id":${"9".repeat(32)},"permissions":["instagram_business_basic","instagram_business_manage_messages"]}`));
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000 }));
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", account_type: "BUSINESS" }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).resolves.toMatchObject({ token: "long" });
    expect(logs.info).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", "0"], ["negative", "-12345"], ["decimal", "12345.0"], ["exponent", "1e5"],
    ["signed", "+12345"], ["leading zero", "012345"], ["malformed", "1_2345"],
    ["too short", "1234"], ["too long", "9".repeat(33)],
  ])("rejects a %s raw numeric user_id without exposing its lexeme", async (_case, lexeme) => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(rawJson(`{"access_token":"synthetic-private-token","user_id":${lexeme},"permissions":["instagram_business_basic","instagram_business_manage_messages"]}`));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID", message: "Instagram authorization response was invalid." });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(logs.info.mock.calls);
    expect(logged).not.toContain(lexeme);
    expect(logged).not.toMatch(/synthetic-private|instagram_business_basic|instagram_business_manage_messages/);
  });

  it("fails before fetching when JSON.parse reviver source text is unavailable", async () => {
    const parse = JSON.parse;
    const spy = vi.spyOn(JSON, "parse").mockImplementation((text, reviver): unknown => parse(text, reviver && ((key, value) => reviver(key, value) as unknown)) as unknown);
    try {
      await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID", message: "Instagram authorization response was invalid." });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(logs.info).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  it("rejects a numeric ID if source text disappears after the runtime probe", async () => {
    const parse = JSON.parse;
    const spy = vi.spyOn(JSON, "parse").mockImplementation((text, reviver): unknown => text === '{"user_id":1}' ? parse(text, reviver) as unknown : parse(text, reviver && ((key, value) => reviver(key, value) as unknown)) as unknown);
    try {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(rawJson('{"access_token":"synthetic-private-token","user_id":9007199254740993,"permissions":["instagram_business_basic","instagram_business_manage_messages"]}'));
      await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/9007199254740993|synthetic-private|instagram_business_basic|instagram_business_manage_messages/);
    } finally { spy.mockRestore(); }
  });

  it("rejects a provider object that imitates the internal numeric ID marker", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(rawJson('{"access_token":"synthetic-private-token","user_id":{"digits":"9007199254740993"},"permissions":["instagram_business_basic","instagram_business_manage_messages"]}'));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/9007199254740993|synthetic-private|instagram_business_basic|instagram_business_manage_messages/);
  });

  it("keeps the code-exchange size and JSON Content-Type gates", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(rawJson("synthetic-private-body".repeat(4096)));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ diagnosticCategory: "MALFORMED_RESPONSE" });
    mocked.mockResolvedValueOnce(new Response("synthetic-private-body", { headers: { "content-type": "text/plain" } }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ diagnosticCategory: "MALFORMED_RESPONSE" });
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/synthetic-private-body|synthetic-private-code/);
  });

  it("logs only bounded, allow-listed shape metadata for a rejected code-exchange response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(json({ data: [{
      access_token: "synthetic-private-token", user_id: "123456789", permissions: ["instagram_business_basic"],
      token_type: "bearer", expires_in: 3600, unknown_secret_field: "synthetic-private-secret",
    }] }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
    expect(logs.info).toHaveBeenCalledTimes(1);
    const contract = (logs.info.mock.calls[0]?.[0] as { codeExchangeResponse: { fields: Record<string, unknown> } }).codeExchangeResponse;
    expect(contract).toMatchObject({
      statusClass: "2XX", contentType: "JSON", byteBucket: "UP_TO_1K", topLevelKind: "OBJECT",
      dataExists: true, dataIsArray: true, dataLength: 1, documentedRequiredFieldsPresent: true,
      fields: {
        access_token: { present: true, type: "STRING" }, expires_in: { present: true, type: "NUMBER" },
        permissions: { present: true, type: "ARRAY" }, token_type: { present: true, type: "STRING" },
        user_id: { present: true, type: "STRING" },
      },
    });
    expect(Object.keys(contract.fields)).toEqual(["access_token", "expires_in", "permissions", "token_type", "user_id"]);
    expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/synthetic-private|123456789|unknown_secret_field|instagram_business_basic|3600|bearer/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("distinguishes flat, non-JSON, invalid-JSON and capped multi-entry responses without values", async () => {
    const responses = [
      json({ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic" }),
      new Response("<html>synthetic-private-token</html>", { status: 200, headers: { "content-type": "text/html" } }),
      new Response("{synthetic-private-token", { status: 200, headers: { "content-type": "application/json" } }),
      json({ data: Array.from({ length: 80 }, () => ({})) }),
    ];
    for (const response of responses) {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(response);
      await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toBeInstanceOf(Error);
    }
    expect(logs.info).toHaveBeenCalledTimes(4);
    const contracts = logs.info.mock.calls.map(call => (call[0] as { codeExchangeResponse: Record<string, unknown> }).codeExchangeResponse);
    expect(contracts[0]).toMatchObject({ dataExists: false, fields: { access_token: { present: true, type: "STRING" } } });
    expect(contracts[1]).toMatchObject({ contentType: "OTHER", dataExists: false });
    expect(contracts[1]).not.toHaveProperty("byteBucket");
    expect(contracts[2]).toMatchObject({ contentType: "JSON", topLevelKind: "INVALID_JSON", byteBucket: "UP_TO_1K" });
    expect(contracts[3]).toMatchObject({ dataLength: 51, documentedRequiredFieldsPresent: false });
    expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/synthetic-private|123456789|instagram_business_basic|<html>/);
  });

  it("records shape, not scope text or provider error text, for later code-exchange failures", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(json({ data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,,instagram_business_manage_messages" }] }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID" });
    expect(logs.info.mock.calls[0]?.[0]).toMatchObject({ codeExchangeResponse: { statusClass: "2XX", fields: { permissions: { present: true, type: "STRING" } }, documentedRequiredFieldsPresent: true } });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 10, message: "synthetic-private-token" } }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-private-code")).rejects.toMatchObject({ diagnosticCategory: "HTTP_AUTH_REJECTION" });
    expect(logs.info).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(/synthetic-private|123456789|instagram_business_basic|instagram_business_manage_messages/);
  });

  it("fails closed on provider errors without returning the provider body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ access_token: "sensitive" }) } as never);
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_FAILURE", message: "Instagram authorization could not be completed." });
  });

  it.each([
    ["CODE_EXCHANGE", 0], ["LONG_LIVED_TOKEN_EXCHANGE", 1], ["ACCOUNT_DISCOVERY", 2], ["SCOPE_VALIDATION", 3],
  ])("identifies the failing provider stage %s", async (expected, badAt) => {
    const responses = [
      json(badAt === 0 ? {} : { data: [{ access_token: "short", user_id: "987654321", permissions: badAt === 3 ? "instagram_business_basic" : "instagram_business_basic,instagram_business_manage_messages" }] }),
      json(badAt === 1 ? {} : { access_token: "long", expires_in: 5184000 }),
      json(badAt === 2 ? {} : { user_id: "123456789", account_type: "BUSINESS" }),
    ];
    for (const response of responses) vi.mocked(globalThis.fetch).mockResolvedValueOnce(response);
    const stages: string[] = [];
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code", stage => stages.push(stage))).rejects.toBeInstanceOf(Error);
    expect(stages.at(-1)).toBe(expected);
  });

  it.each([
    ["flat response", { access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages" }],
    ["array permissions", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }] }],
    ["flat string ID", { access_token: "synthetic-private-token", user_id: "123456789", permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["flat permission string", { access_token: "synthetic-private-token", user_id: 123456789, permissions: "instagram_business_basic,instagram_business_manage_messages" }],
    ["fractional numeric ID", { access_token: "synthetic-private-token", user_id: 1.5, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["zero numeric ID", { access_token: "synthetic-private-token", user_id: 0, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["negative numeric ID", { access_token: "synthetic-private-token", user_id: -1, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["object ID", { access_token: "synthetic-private-token", user_id: {}, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["array ID", { access_token: "synthetic-private-token", user_id: [123456789], permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["null ID", { access_token: "synthetic-private-token", user_id: null, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["malformed wrapped ID", { data: [{ access_token: "synthetic-private-token", user_id: "not-an-id", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
    ["wrapped whitespace ID", { data: [{ access_token: "synthetic-private-token", user_id: " 123456789 ", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
    ["flat unknown field", { access_token: "synthetic-private-token", user_id: 123456789, permissions: ["instagram_business_basic", "instagram_business_manage_messages"], token_type: "bearer" }],
    ["flat missing token", { user_id: 123456789, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["flat empty permissions", { access_token: "synthetic-private-token", user_id: 123456789, permissions: [] }],
    ["flat malformed permission", { access_token: "synthetic-private-token", user_id: 123456789, permissions: ["instagram_business_basic", "instagram_business_manage_messages;other"] }],
    ["flat oversized permission", { access_token: "synthetic-private-token", user_id: 123456789, permissions: ["instagram_business_basic", "x".repeat(129), "instagram_business_manage_messages"] }],
    ["flat too many permissions", { access_token: "synthetic-private-token", user_id: 123456789, permissions: Array.from({ length: 51 }, (_, i) => `scope_${i}`) }],
    ["flat oversized token", { access_token: "x".repeat(8193), user_id: 123456789, permissions: ["instagram_business_basic", "instagram_business_manage_messages"] }],
    ["multiple token entries", { data: [
      { access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages" },
      { access_token: "synthetic-private-token", user_id: "987654321", permissions: "instagram_business_basic,instagram_business_manage_messages" },
    ] }],
    ["missing token", { data: [{ user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
    ["missing user ID", { data: [{ access_token: "synthetic-private-token", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
    ["undocumented token field", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages", token_type: "bearer" }] }],
    ["undocumented envelope field", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages" }], token_type: "bearer" }],
    ["empty permission", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,,instagram_business_manage_messages" }] }],
    ["malformed permission", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages;other" }] }],
    ["oversized permission", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: `instagram_business_basic,${"x".repeat(129)},instagram_business_manage_messages` }] }],
    ["oversized permission string", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: "x".repeat(8193) }] }],
    ["too many permissions", { data: [{ access_token: "synthetic-private-token", user_id: "123456789", permissions: Array.from({ length: 51 }, (_, i) => `scope_${i}`).join(",") }] }],
    ["oversized token", { data: [{ access_token: "x".repeat(8193), user_id: "123456789", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
    ["oversized user ID", { data: [{ access_token: "synthetic-private-token", user_id: "9".repeat(65), permissions: "instagram_business_basic,instagram_business_manage_messages" }] }],
  ])("rejects %s without exposing provider content or retrying", async (_case, response) => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json(response));
    const failure: unknown = await new OfficialInstagramLoginProvider().exchange("synthetic-private-code").catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "INSTAGRAM_PROVIDER_INVALID", message: "Instagram authorization response was invalid." });
    expect(JSON.stringify(failure)).not.toMatch(/synthetic-private|123456789|987654321/);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it.each(["instagram_business_basic", "instagram_business_manage_messages"])("requires %s after normalization", async missing => {
    const granted = ["instagram_business_basic", "instagram_business_manage_messages"].filter(scope => scope !== missing).join(",");
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json({ data: [{ access_token: "short", user_id: "123456789", permissions: granted }] }));
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000 }));
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", account_type: "BUSINESS" }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).rejects.toMatchObject({ code: "INSTAGRAM_SCOPE_MISSING" });
    expect(mocked).toHaveBeenCalledTimes(3);
  });

  it("requires both messaging scopes in the flat permission array", async () => {
    const mocked = vi.mocked(globalThis.fetch);
    mocked.mockResolvedValueOnce(json({ access_token: "short", user_id: 123456789, permissions: ["instagram_business_basic"] }));
    mocked.mockResolvedValueOnce(json({ access_token: "long", expires_in: 5184000 }));
    mocked.mockResolvedValueOnce(json({ user_id: "123456789", account_type: "BUSINESS" }));
    await expect(new OfficialInstagramLoginProvider().exchange("synthetic-code")).rejects.toMatchObject({ code: "INSTAGRAM_SCOPE_MISSING" });
    expect(mocked).toHaveBeenCalledTimes(3);
    expect(logs.info).not.toHaveBeenCalled();
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
