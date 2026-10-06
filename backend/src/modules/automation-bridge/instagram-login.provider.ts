import { z } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors/app-error.js";

const providerId = z.union([z.string().regex(/^\d{5,32}$/), z.number().int().positive().safe()]);
const token = z.string().min(1).max(8192);
class NumericOAuthId {
  readonly #digits: string;
  constructor(digits: string) { this.#digits = digits; }
  get digits() { return this.#digits; }
}
const numericOAuthId = z.instanceof(NumericOAuthId).transform(id => id.digits);
const shortToken = z.object({ access_token: token, user_id: z.union([z.string().regex(/^[1-9]\d{0,63}$/), numericOAuthId]), permissions: z.string().min(1).max(8192) }).strict();
const flatShortToken = z.object({ access_token: token, user_id: numericOAuthId, permissions: z.array(z.string().min(1).max(128)).min(1).max(50) }).strict();
const shortTokenResponse = z.union([z.object({ data: z.array(shortToken).length(1) }).strict(), flatShortToken]);
const longToken = z.object({ access_token: token, expires_in: z.number().int().min(1).max(90 * 24 * 60 * 60), token_type: z.enum(["bearer", "Bearer"]).optional() }).strict();
const account = z.object({ user_id: providerId, id: z.union([z.string().min(1).max(64), z.number().int().positive().safe()]).optional(), username: z.string().min(1).max(128).optional(), account_type: z.enum(["BUSINESS", "MEDIA_CREATOR", "Business", "Media_Creator"]) }).strict();
const requiredScopes = ["instagram_business_basic", "instagram_business_manage_messages"] as const;
const contractFields = ["access_token", "expires_in", "permissions", "token_type", "user_id"] as const;
const invalidCodeExchange = () => new AppError(502, "Instagram authorization response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
function codeExchangeReviver(key: string, value: unknown, context?: { source?: string }) {
  if (key !== "user_id" || typeof value !== "number") return value;
  const digits = context?.source;
  if (typeof digits !== "string" || !/^[1-9]\d{4,31}$/.test(digits)) throw invalidCodeExchange();
  return new NumericOAuthId(digits);
}
function requireJsonSourceContext() {
  try {
    const probe = JSON.parse('{"user_id":1}', (key, value: unknown, context?: { source?: string }) => key === "user_id" && typeof value === "number" ? context?.source : value) as { user_id?: unknown };
    if (probe?.user_id === "1") return;
  } catch { /* Unsupported runtime: fail closed before spending the authorization code. */ }
  throw invalidCodeExchange();
}
function codeExchangeContract(response: Response, bytes: number | undefined, parsed: boolean, value: unknown) {
  const object = parsed && value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const data = object?.data;
  const entry = Array.isArray(data) && data.length === 1 && data[0] !== null && typeof data[0] === "object" && !Array.isArray(data[0])
    ? data[0] as Record<string, unknown> : object;
  const fields = Object.fromEntries(contractFields.map(field => {
    const present = entry !== null && Object.hasOwn(entry, field);
    const item = present ? entry[field] : undefined;
    const type = !present ? "ABSENT" : item === null ? "NULL" : Array.isArray(item) ? "ARRAY" : typeof item === "string" ? "STRING" : typeof item === "number" || item instanceof NumericOAuthId ? "NUMBER" : typeof item === "object" ? "OBJECT" : undefined;
    return [field, { present, ...(type ? { type } : {}) }];
  }));
  const contentType = response.headers?.get?.("content-type");
  return {
    ...(Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? { statusClass: `${Math.floor(response.status / 100)}XX` } : {}),
    contentType: !contentType ? "MISSING" : /^application\/(?:[\w.+-]+\+)?json(?:\s*;|\s*$)/i.test(contentType) ? "JSON" : "OTHER",
    ...(bytes === undefined ? {} : { byteBucket: bytes === 0 ? "ZERO" : bytes <= 1024 ? "UP_TO_1K" : bytes <= 8192 ? "UP_TO_8K" : bytes <= 65536 ? "UP_TO_64K" : "OVER_64K" }),
    ...(parsed ? value !== null && typeof value === "object" ? { topLevelKind: Array.isArray(value) ? "ARRAY" : "OBJECT" } : {} : { topLevelKind: "INVALID_JSON" }),
    dataExists: object !== null && Object.hasOwn(object, "data"),
    dataIsArray: Array.isArray(data),
    ...(Array.isArray(data) ? { dataLength: Math.min(data.length, 51) } : {}),
    fields,
    documentedRequiredFieldsPresent: ["access_token", "user_id", "permissions"].every(field => entry !== null && Object.hasOwn(entry, field)),
  };
}
function normalizePermissions(value: string | string[]) {
  const scopes = (typeof value === "string" ? value.split(",") : value).map(scope => scope.trim());
  if (scopes.length > 50 || scopes.some(scope => !/^[a-z][a-z0-9_]{0,127}$/.test(scope)))
    throw new AppError(502, "Instagram authorization response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
  return [...new Set(scopes)];
}
export type InstagramAuthorization = { token: string; expiresAt: Date; scopes: string[]; accountId: string; username?: string };
export type InstagramOAuthProviderStage = "CODE_EXCHANGE" | "LONG_LIVED_TOKEN_EXCHANGE" | "ACCOUNT_DISCOVERY" | "SCOPE_VALIDATION";
export type InstagramProviderFailureCategory = "TIMEOUT" | "HTTP_AUTH_REJECTION" | "MALFORMED_RESPONSE" | "PROVIDER_REJECTION" | "PROVIDER_FAILURE";

export class InstagramProviderDiagnosticError extends AppError {
  constructor(public readonly diagnosticCategory: InstagramProviderFailureCategory) {
    super(502, "Instagram authorization could not be completed.", "INSTAGRAM_PROVIDER_FAILURE");
  }
}

export interface InstagramLoginProvider {
  exchange(code: string, onStage?: (stage: InstagramOAuthProviderStage) => void): Promise<InstagramAuthorization>;
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

async function providerJson(url: string, init?: RequestInit, onCodeExchangeContract?: (contract: ReturnType<typeof codeExchangeContract>) => void): Promise<unknown> {
  let response: Response | undefined, bytes: number | undefined, parsed = false, data: unknown;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error" });
    if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")) throw new InstagramProviderDiagnosticError("MALFORMED_RESPONSE");
    const limit = 64 * 1024;
    if (Number(response.headers.get("content-length")) > limit) throw new InstagramProviderDiagnosticError("MALFORMED_RESPONSE");
    if (!response.body) throw new InstagramProviderDiagnosticError("MALFORMED_RESPONSE");
    bytes = 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        bytes = length;
        if (length > limit) throw new InstagramProviderDiagnosticError("MALFORMED_RESPONSE");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"), onCodeExchangeContract && response.ok ? codeExchangeReviver : undefined) as unknown;
    parsed = true;
    if (!response.ok) {
      const failure = z.object({ error: z.object({ code: z.number().int().min(0).max(999999), error_subcode: z.number().int().min(0).max(999999).optional(), message: z.string().max(512).optional(), type: z.string().max(80).optional() }) }).safeParse(data);
      if (failure.success && failure.data.error.code === 190)
        throw new AppError(409, "Instagram reconnection is required.", "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED");
      throw new InstagramProviderDiagnosticError(response.status === 401 || response.status === 403 ? "HTTP_AUTH_REJECTION" : "PROVIDER_REJECTION");
    }
    return data;
  } catch (error) {
    if (error instanceof InstagramProviderDiagnosticError || error instanceof AppError && (error.code === "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED" || onCodeExchangeContract && error.code === "INSTAGRAM_PROVIDER_INVALID")) throw error;
    if (onCodeExchangeContract && error instanceof SyntaxError) throw invalidCodeExchange();
    // Never include provider response bodies: they may contain tokens or authorization codes.
    const category = error instanceof SyntaxError ? "MALFORMED_RESPONSE" : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "TIMEOUT" : "PROVIDER_FAILURE";
    throw new InstagramProviderDiagnosticError(category);
  } finally {
    if (response && onCodeExchangeContract) onCodeExchangeContract(codeExchangeContract(response, bytes, parsed, data));
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

  async exchange(code: string, onStage?: (stage: InstagramOAuthProviderStage) => void): Promise<InstagramAuthorization> {
    onStage?.("CODE_EXCHANGE");
    const { appId, secret, redirectUri } = configuration();
    const form = new FormData();
    form.set("client_id", appId); form.set("client_secret", secret);
    form.set("grant_type", "authorization_code"); form.set("redirect_uri", redirectUri); form.set("code", code);
    let contract: ReturnType<typeof codeExchangeContract> | undefined;
    let short: z.infer<typeof shortToken> | z.infer<typeof flatShortToken>, scopes: string[];
    try {
      requireJsonSourceContext();
      const exchanged = shortTokenResponse.safeParse(await providerJson("https://api.instagram.com/oauth/access_token", { method: "POST", body: form }, result => { contract = result; }));
      if (!exchanged.success) throw invalidCodeExchange();
      short = "data" in exchanged.data ? exchanged.data.data[0]! : exchanged.data;
      scopes = normalizePermissions(short.permissions);
    } catch (error) {
      const malformed = error instanceof InstagramProviderDiagnosticError ? error.diagnosticCategory === "MALFORMED_RESPONSE" : error instanceof AppError && error.code === "INSTAGRAM_PROVIDER_INVALID";
      if (contract && malformed) logger.info({ codeExchangeResponse: contract }, "Instagram code exchange response contract");
      throw error;
    }
    onStage?.("LONG_LIVED_TOKEN_EXCHANGE");
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", secret);
    longUrl.searchParams.set("access_token", short.access_token);
    const long = longToken.safeParse(await providerJson(longUrl.toString()));
    if (!long.success) throw new AppError(502, "Instagram token response was invalid.", "INSTAGRAM_PROVIDER_INVALID");
    onStage?.("ACCOUNT_DISCOVERY");
    const meUrl = new URL(`https://graph.instagram.com/${env.META_INSTAGRAM_API_VERSION}/me`);
    meUrl.searchParams.set("fields", "user_id,username,account_type");
    meUrl.searchParams.set("access_token", long.data.access_token);
    const discovered = z.union([account, z.object({ data: z.array(account).length(1) })]).safeParse(await providerJson(meUrl.toString()));
    if (!discovered.success) throw new AppError(502, "Instagram account could not be verified.", "INSTAGRAM_ACCOUNT_INVALID");
    const me = "data" in discovered.data ? discovered.data.data[0]! : discovered.data;
    const accountId = String(me.user_id);
    if (!/^\d{5,32}$/.test(accountId) || !["BUSINESS", "MEDIA_CREATOR", "Business", "Media_Creator"].includes(me.account_type ?? ""))
      throw new AppError(409, "A professional Instagram account is required.", "INSTAGRAM_PROFESSIONAL_REQUIRED");
    onStage?.("SCOPE_VALIDATION");
    if (!requiredScopes.every(scope => scopes.includes(scope)))
      throw new AppError(409, "Instagram messaging permission was not granted.", "INSTAGRAM_SCOPE_MISSING");
    // OAuth user_id is deliberately not substituted for /me.user_id.
    return { token: long.data.access_token, expiresAt: new Date(Date.now() + long.data.expires_in * 1000), scopes, accountId, ...(me.username ? { username: me.username } : {}) };
  }

  async subscribe(accountId: string, token: string): Promise<boolean> {
    const url = new URL(`https://graph.instagram.com/${env.META_INSTAGRAM_API_VERSION}/${accountId}/subscribed_apps`);
    url.searchParams.set("subscribed_fields", "messages");
    url.searchParams.set("access_token", token);
    const response = z.object({ success: z.literal(true) }).safeParse(await providerJson(url.toString(), { method: "POST" }));
    return response.success;
  }
}
