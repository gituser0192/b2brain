import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

const providerId = z.union([z.string().regex(/^\d{5,32}$/), z.number().int().positive().safe()]);
const token = z.string().min(1).max(8192);
const shortToken = z.object({ access_token: token, user_id: z.union([z.string().min(1).max(64), z.number().int().positive().safe()]), permissions: z.array(z.string().min(1).max(128)).max(50) }).strict();
const longToken = z.object({ access_token: token, expires_in: z.number().int().min(1).max(90 * 24 * 60 * 60), token_type: z.enum(["bearer", "Bearer"]).optional() }).strict();
const account = z.object({ user_id: providerId, id: z.union([z.string().min(1).max(64), z.number().int().positive().safe()]).optional(), username: z.string().min(1).max(128).optional(), account_type: z.enum(["BUSINESS", "MEDIA_CREATOR", "Business", "Media_Creator"]) }).strict();
const requiredScopes = ["instagram_business_basic", "instagram_business_manage_messages"] as const;
export type InstagramAuthorization = { token: string; expiresAt: Date; scopes: string[]; accountId: string; username?: string };

export interface InstagramLoginProvider {
  exchange(code: string): Promise<InstagramAuthorization>;
  subscribe(accountId: string, token: string): Promise<boolean>;
  refresh(token: string): Promise<{ token: string; expiresAt: Date }>;
}

function configuration() {
  if (!env.META_INSTAGRAM_CONNECT_ENABLED || !env.META_INSTAGRAM_APP_ID || !env.META_INSTAGRAM_APP_SECRET || !env.META_INSTAGRAM_REDIRECT_URI)
    throw new AppError(503, "Instagram private connection is not configured.", "INSTAGRAM_CONNECT_UNAVAILABLE");
  const redirect = new URL(env.META_INSTAGRAM_REDIRECT_URI);
  if (env.NODE_ENV === "production" && redirect.protocol !== "https:") throw new AppError(503, "Instagram private connection is not configured.", "INSTAGRAM_CONNECT_UNAVAILABLE");
  if (redirect.search || redirect.hash || redirect.pathname !== "/api/v1/instagram-login/redirect") throw new AppError(503, "Instagram redirect URI is invalid.", "INSTAGRAM_REDIRECT_INVALID");
  return { appId: env.META_INSTAGRAM_APP_ID, secret: env.META_INSTAGRAM_APP_SECRET, redirectUri: redirect.toString() };
}

export function instagramAuthorizationUrl(state: string) {
  const { appId, redirectUri } = configuration();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", requiredScopes.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

async function providerJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error" });
    if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Invalid provider response");
    const limit = 64 * 1024;
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Provider response too large");
    if (!response.body) throw new Error("Provider response empty");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) throw new Error("Provider response too large");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!response.ok) {
      const failure = z.object({ error: z.object({ code: z.number().int().min(0).max(999999), error_subcode: z.number().int().min(0).max(999999).optional(), message: z.string().max(512).optional(), type: z.string().max(80).optional() }) }).safeParse(data);
      if (failure.success && failure.data.error.code === 190)
        throw new AppError(409, "Instagram reconnection is required.", "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED");
      throw new Error("Provider rejected request");
    }
    return data;
  } catch (error) {
    if (error instanceof AppError && error.code === "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED") throw error;
    // Never include provider response bodies: they may contain tokens or authorization codes.
    throw new AppError(502, "Instagram authorization could not be completed.", "INSTAGRAM_PROVIDER_FAILURE");
  }
}

export class OfficialInstagramLoginProvider implements InstagramLoginProvider {
  async refresh(token: string) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", token);
    const refreshed = longToken.safeParse(await providerJson(url.toString()));
    if (!refreshed.success) throw new AppError(502, "Instagram refresh response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
    return { token: refreshed.data.access_token, expiresAt: new Date(Date.now() + refreshed.data.expires_in * 1000) };
  }

  async exchange(code: string): Promise<InstagramAuthorization> {
    const { appId, secret, redirectUri } = configuration();
    const form = new FormData();
    form.set("client_id", appId); form.set("client_secret", secret);
    form.set("grant_type", "authorization_code"); form.set("redirect_uri", redirectUri); form.set("code", code);
    const exchanged = z.union([shortToken, z.object({ data: z.array(shortToken).length(1) })]).safeParse(await providerJson("https://api.instagram.com/oauth/access_token", { method: "POST", body: form }));
    if (!exchanged.success) throw new AppError(502, "Instagram authorization response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
    const short = "data" in exchanged.data ? exchanged.data.data[0]! : exchanged.data;
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", secret);
    longUrl.searchParams.set("access_token", short.access_token);
    const long = longToken.safeParse(await providerJson(longUrl.toString()));
    if (!long.success) throw new AppError(502, "Instagram token response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
    const meUrl = new URL(`https://graph.instagram.com/${env.META_INSTAGRAM_API_VERSION}/me`);
    meUrl.searchParams.set("fields", "user_id,username,account_type");
    meUrl.searchParams.set("access_token", long.data.access_token);
    const discovered = z.union([account, z.object({ data: z.array(account).length(1) })]).safeParse(await providerJson(meUrl.toString()));
    if (!discovered.success) throw new AppError(502, "Instagram account could not be verified.", "INSTAGRAM_ACCOUNT_INVALID");
    const me = "data" in discovered.data ? discovered.data.data[0]! : discovered.data;
    const accountId = String(me.user_id);
    if (!/^\d{5,32}$/.test(accountId) || !["BUSINESS", "MEDIA_CREATOR", "Business", "Media_Creator"].includes(me.account_type ?? ""))
      throw new AppError(409, "A professional Instagram account is required.", "INSTAGRAM_PROFESSIONAL_REQUIRED");
    if (!requiredScopes.every(scope => short.permissions?.includes(scope)))
      throw new AppError(409, "Instagram messaging permission was not granted.", "INSTAGRAM_SCOPE_MISSING");
    // OAuth user_id is deliberately not substituted for /me.user_id.
    return { token: long.data.access_token, expiresAt: new Date(Date.now() + long.data.expires_in * 1000), scopes: short.permissions ?? [], accountId, ...(me.username ? { username: me.username } : {}) };
  }

  async subscribe(accountId: string, token: string): Promise<boolean> {
    const url = new URL(`https://graph.instagram.com/${env.META_INSTAGRAM_API_VERSION}/${accountId}/subscribed_apps`);
    url.searchParams.set("subscribed_fields", "messages");
    url.searchParams.set("access_token", token);
    const response = z.object({ success: z.literal(true) }).safeParse(await providerJson(url.toString(), { method: "POST" }));
    return response.success;
  }
}
