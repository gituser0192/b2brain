import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ env: { META_LEAD_GRAPH_ENABLED: true, META_LEAD_GRAPH_BASE_URL: "https://graph.facebook.com", META_GRAPH_API_VERSION: "v23.0", META_LEAD_GRAPH_TIMEOUT_MS: 1000, META_LEAD_GRAPH_MAX_RETRIES: 0 } }));
vi.mock("../src/config/env.js", () => ({ env: state.env }));
import { HttpMetaLeadGraphClient } from "../src/modules/automation-bridge/meta-lead.graph.js";
const valid = JSON.stringify({ id: "123", created_time: new Date().toISOString(), form_id: "456", field_data: [] });
describe("Meta Lead Graph boundary", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("uses the allowed host, authorization header and bounded fields", async () => { const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(valid)); await new HttpMetaLeadGraphClient().retrieve("123", "secret-token"); const [url, init] = fetcher.mock.calls[0]!; expect(url).toBeInstanceOf(URL); expect((url as URL).href).toMatch(/^https:\/\/graph\.facebook\.com\/v23\.0\/123\?fields=/); expect(init?.headers).toMatchObject({ authorization: "Bearer secret-token" }); });
  it("rejects invalid hosts and oversized/error responses without leaking tokens", async () => { state.env.META_LEAD_GRAPH_BASE_URL = "https://example.test"; await expect(new HttpMetaLeadGraphClient().retrieve("123", "secret-token")).rejects.toMatchObject({ code: "META_GRAPH_CONFIGURATION_INVALID" }); state.env.META_LEAD_GRAPH_BASE_URL = "https://graph.facebook.com"; vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("x", { headers: { "content-length": String(300_000) } })); await expect(new HttpMetaLeadGraphClient().retrieve("123", "secret-token")).rejects.toMatchObject({ code: "META_GRAPH_RESPONSE_TOO_LARGE" }); });
  it("maps transport failures to a safe bounded error", async () => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("secret-token network detail")); await expect(new HttpMetaLeadGraphClient().retrieve("123", "secret-token")).rejects.toMatchObject({ code: "META_GRAPH_REQUEST_FAILED", message: "Meta lead retrieval failed." }); });
});
