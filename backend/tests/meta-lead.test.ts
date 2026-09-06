import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: { META_LEAD_ADS_ENABLED: true, EXTERNAL_CHANNELS_ENABLED: true, META_LEAD_VERIFY_TOKEN: "synthetic-verify-token", META_LEAD_APP_SECRET: "synthetic-app-secret", META_GRAPH_API_VERSION: "v23.0", META_LEAD_GRAPH_ENABLED: false, META_LEAD_GRAPH_BASE_URL: "https://graph.facebook.com", META_LEAD_GRAPH_TIMEOUT_MS: 1000, META_LEAD_GRAPH_MAX_RETRIES: 0 },
  connectors: vi.fn(), update: vi.fn(), graph: vi.fn(), process: vi.fn(), decrypt: vi.fn(() => "synthetic-page-token-value"),
}));
vi.mock("../src/config/env.js", () => ({ env: state.env }));
vi.mock("../src/database/prisma.js", () => ({ prisma: { integrationConnector: { findMany: state.connectors, update: state.update } } }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({ decryptSecret: state.decrypt }));
import { MetaLeadService } from "../src/modules/automation-bridge/meta-lead.service.js";

const connector = { id: crypto.randomUUID(), organizationId: crypto.randomUUID(), createdById: crypto.randomUUID(), accessTokenEncrypted: "encrypted", credentialsConfiguredAt: new Date(), configuration: { metaLeadAuthorizationVerified: true, metaLeadAllowedFormIds: ["222"] } };
const body = { object: "page", entry: [{ id: "111", time: 1, changes: [{ field: "leadgen", value: { leadgen_id: "333", page_id: "111", form_id: "222", created_time: 1 } }] }] };
const lead = { id: "333", created_time: new Date().toISOString(), form_id: "222", field_data: [{ name: "full_name", values: ["Synthetic Buyer"] }, { name: "email", values: ["BUYER@EXAMPLE.TEST"] }, { name: "unknown_sensitive", values: ["must-not-pass"] }, { name: "message", values: ["Need course details"] }] };
const signed = (raw: Buffer) => `sha256=${createHmac("sha256", state.env.META_LEAD_APP_SECRET).update(raw).digest("hex")}`;

describe("Meta Lead Ads adapter", () => {
  beforeEach(() => { vi.clearAllMocks(); state.connectors.mockResolvedValue([connector]); state.graph.mockResolvedValue(lead); state.process.mockResolvedValue({ duplicate: false }); state.update.mockResolvedValue({}); });
  it("verifies GET tokens and signed POST then delegates normalized data", async () => {
    const service = new MetaLeadService({ retrieve: state.graph }, { processVerifiedMetaLead: state.process } as never), raw = Buffer.from(JSON.stringify(body));
    expect(service.verify("subscribe", state.env.META_LEAD_VERIFY_TOKEN, "challenge")).toBe("challenge");
    await expect(service.accept(raw, signed(raw), body)).resolves.toEqual({ accepted: true, processed: 1 });
    expect(state.process).toHaveBeenCalledWith(connector.organizationId, connector.createdById, expect.objectContaining({ channel: "META_LEAD_AD", eventType: "LEAD_CAPTURED", externalEventId: "333", sender: { name: "Synthetic Buyer", email: "buyer@example.test" }, content: { text: "Need course details" } }));
    expect(JSON.stringify(state.process.mock.calls)).not.toContain("must-not-pass");
  });
  it("rejects signatures before lookup or Graph work", async () => { await expect(new MetaLeadService({ retrieve: state.graph }).accept(Buffer.from("{}"), "sha256=bad", {})).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" }); expect(state.connectors).not.toHaveBeenCalled(); expect(state.graph).not.toHaveBeenCalled(); });
  it("resolves exactly one active Page and enforces the Form allowlist before Graph", async () => {
    const service = new MetaLeadService({ retrieve: state.graph }), raw = Buffer.from(JSON.stringify(body)); state.connectors.mockResolvedValue([]);
    await expect(service.accept(raw, signed(raw), body)).rejects.toMatchObject({ code: "META_LEAD_UNAVAILABLE" });
    state.connectors.mockResolvedValue([{ ...connector, configuration: { ...connector.configuration, metaLeadAllowedFormIds: ["999"] } }]);
    await expect(service.accept(raw, signed(raw), body)).rejects.toMatchObject({ code: "META_LEAD_UNAVAILABLE" }); expect(state.graph).not.toHaveBeenCalled();
  });
  it("rejects payload organization authority and excessive entries", async () => {
    const service = new MetaLeadService({ retrieve: state.graph }), injected = { ...body, organizationId: crypto.randomUUID() }, raw = Buffer.from(JSON.stringify(injected));
    await expect(service.accept(raw, signed(raw), injected)).rejects.toMatchObject({ code: "INVALID_META_WEBHOOK" });
    const excessive = { object: "page", entry: Array.from({ length: 26 }, () => body.entry[0]) }, excessiveRaw = Buffer.from(JSON.stringify(excessive));
    await expect(service.accept(excessiveRaw, signed(excessiveRaw), excessive)).rejects.toBeTruthy();
  });
});
