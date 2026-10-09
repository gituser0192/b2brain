import { createHash, createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: { EXTERNAL_CHANNELS_ENABLED: true, META_INSTAGRAM_DM_ENABLED: true, META_INSTAGRAM_SIGNATURE_PROVEN: true, META_INSTAGRAM_SIGNATURE_PROOF_ENABLED: false, META_INSTAGRAM_VERIFY_TOKEN: "synthetic-verify-token", META_INSTAGRAM_APP_SECRET: "synthetic-app-secret", META_INSTAGRAM_PRIVATE_ORGANIZATION_ID: "organization" },
  proofLog: vi.fn(),
  assets: vi.fn(), binding: vi.fn(), connector: vi.fn(), serviceCount: vi.fn(), plan: vi.fn(), transaction: vi.fn(), lock: vi.fn(), eventCreate: vi.fn(), eventFind: vi.fn(), inquiryFind: vi.fn(), inquiryCreate: vi.fn(), timelineCreate: vi.fn(), eventUpdate: vi.fn(), connectorUpdate: vi.fn(),
}));
vi.mock("../src/config/env.js", () => ({ env: state.env }));
vi.mock("../src/config/logger.js", () => ({ logger: { info: state.proofLog } }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  metaConnectedAsset: { findMany: state.assets }, integrationConnector: { findFirst: state.connector }, integrationEvent: { findFirst: state.eventFind }, organizationService: { count: state.serviceCount }, organizationPlan: { findUnique: state.plan }, $transaction: state.transaction,
} }));
import { InstagramDmService } from "../src/modules/automation-bridge/instagram-dm.service.js";

const inbound = (mid = "m-1", extra: object = {}) => ({ sender: { id: "987654321" }, recipient: { id: "123456789" }, timestamp: Date.now(), message: { mid, text: "What is the price?", ...extra } });
const body = (messages = [inbound()]) => ({ object: "instagram", entry: [{ id: "123456789", messaging: messages }] });
const raw = (value: unknown) => Buffer.from(JSON.stringify(value));
const signed = (data: Buffer) => `sha256=${createHmac("sha256", state.env.META_INSTAGRAM_APP_SECRET).update(data).digest("hex")}`;
const enableProof = () => {
  vi.stubEnv("RENDER_SERVICE_ID", "srv-da9v5q1f2nfc738nimqg");
  vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "b2brain-staging-api.onrender.com");
  state.env.META_INSTAGRAM_SIGNATURE_PROVEN = false;
  state.env.META_INSTAGRAM_SIGNATURE_PROOF_ENABLED = true;
};
const expectProofIsolated = () => {
  for (const query of [state.assets, state.binding, state.connector, state.serviceCount, state.plan, state.transaction, state.lock, state.eventCreate, state.eventFind, state.inquiryFind, state.inquiryCreate, state.timelineCreate, state.eventUpdate, state.connectorUpdate])
    expect(query).not.toHaveBeenCalled();
  for (const [record, label] of state.proofLog.mock.calls) {
    const fields = record as Record<string, unknown>;
    expect(label).toBe("Instagram webhook signature proof");
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(["signature", "bytes"]));
    expect(Object.keys(fields).every(key => [
      "signature", "payload", "category", "retryCorrelation", "bytes", "entries", "events",
      "stage", "topLevel", "topFields", "objectIsInstagram", "entryCount", "entryFields",
      "messagingType", "messagingCount", "changesType", "changeFields", "eventFields", "fieldTypes", "envelopeVariant",
    ].includes(key))).toBe(true);
    if (fields.category !== undefined) {
      expect(["INVALID_JSON", "INVALID_ENVELOPE", "ZERO_ENTRIES", "INVALID_ENTRY", "MISSING_MESSAGING", "INVALID_EVENT", "ZERO_EVENTS", "EVENT_LIMIT"]).toContain(fields.category);
      expect(fields.retryCorrelation).toMatch(/^[a-f0-9]{32}$/);
    }
    if (fields.fieldTypes !== undefined) {
      expect(Object.keys(fields.fieldTypes as object).sort()).toEqual([
        "senderId", "recipientId", "timestamp", "messageMid", "messageText", "messageIsEcho", "messageIsDeleted",
      ].sort());
      expect(Object.values(fields.fieldTypes as object).every(value => ["ABSENT", "NULL", "STRING", "NUMBER", "BOOLEAN", "ARRAY", "OBJECT"].includes(value as string))).toBe(true);
    }
    for (const [key, allowed] of [
      ["topFields", ["object", "entry"]], ["entryFields", ["id", "messaging", "changes"]],
      ["changeFields", ["field", "value"]], ["eventFields", ["sender", "recipient", "timestamp", "message"]],
    ] as const) if (fields[key] !== undefined) expect((fields[key] as string[]).every(name => allowed.includes(name))).toBe(true);
    expect(["valid", "invalid"]).toContain(fields.signature);
    if (fields.payload !== undefined) expect(["valid", "invalid"]).toContain(fields.payload);
    expect(fields.bytes).toBeGreaterThanOrEqual(0);
    expect(fields.bytes).toBeLessThanOrEqual(256 * 1024 + 1);
    if (fields.entries !== undefined) expect(fields.entries).toBeLessThanOrEqual(400);
    if (fields.events !== undefined) expect(fields.events).toBeLessThanOrEqual(201);
  }
  expect(JSON.stringify(state.proofLog.mock.calls)).not.toMatch(/What is the price\?|987654321|123456789|m-1|synthetic-app-secret|sha256=/);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  state.env.META_INSTAGRAM_SIGNATURE_PROVEN = true;
  state.env.META_INSTAGRAM_SIGNATURE_PROOF_ENABLED = false;
  state.assets.mockResolvedValue([{ id: "asset", connectorId: "connector", organizationId: "organization" }]);
  state.binding.mockResolvedValue({ webhookCutoverAt: new Date(Date.now() - 1000) });
  state.connector.mockResolvedValue({ id: "connector", organizationId: "organization", createdById: "user" });
  state.serviceCount.mockResolvedValue(2); state.plan.mockResolvedValue(null);
  state.eventCreate.mockResolvedValue({ id: "event", traceId: "trace" });
  state.eventFind.mockResolvedValue(null); state.inquiryFind.mockResolvedValue(null);
  state.lock.mockResolvedValue([]);
  state.inquiryCreate.mockResolvedValue({ id: "inquiry" });
  state.transaction.mockImplementation((callback: (tx: object) => Promise<unknown>) => callback({
    $queryRaw: state.lock,
    metaConnectedAsset: { findMany: state.assets, findFirst: state.binding }, organizationService: { count: state.serviceCount }, organizationPlan: { findUnique: state.plan },
    integrationEvent: { create: state.eventCreate, findFirst: state.eventFind, update: state.eventUpdate },
    inquiry: { findFirst: state.inquiryFind, create: state.inquiryCreate }, inquiryTimeline: { create: state.timelineCreate },
    integrationConnector: { findFirst: state.connector, update: state.connectorUpdate },
  }));
});

describe("Instagram DM private intake", () => {
  it("proves a signed staging delivery without reading assets or writing an inquiry", async () => {
    enableProof();
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toEqual({ accepted: true, proofOnly: true });
    expect(state.proofLog).toHaveBeenCalledExactlyOnceWith({ signature: "valid", payload: "valid", bytes: data.length, entries: 1, events: 1 }, "Instagram webhook signature proof");
    expectProofIsolated();
  });

  it("uses only invalid signature vocabulary for missing, malformed and incorrect signatures", async () => {
    enableProof();
    const service = new InstagramDmService();
    const data = raw(body());
    await expect(service.accept(data, undefined)).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(service.accept(data, "sha256=bad")).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(service.accept(data, signed(Buffer.from("different")))).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.proofLog.mock.calls.map(call => call[0] as unknown)).toEqual(Array.from({ length: 3 }, () => ({ signature: "invalid", bytes: data.length })));
    expectProofIsolated();
  });

  it("does not parse or categorize malformed JSON before signature authentication", async () => {
    enableProof();
    const data = Buffer.from("private-invalid-json");
    await expect(new InstagramDmService().accept(data, undefined)).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.proofLog).toHaveBeenCalledExactlyOnceWith({ signature: "invalid", bytes: data.length }, "Instagram webhook signature proof");
    expectProofIsolated();
  });

  it("rejects invalid JSON, envelopes, entries, events and oversized bodies with fixed payload vocabulary", async () => {
    enableProof();
    const service = new InstagramDmService();
    const malformed = Buffer.from("not JSON");
    await expect(service.accept(malformed, signed(malformed))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    for (const value of [{ object: "other", entry: [] }, { object: "instagram", entry: [{ id: "bad-account", messaging: [inbound()] }] }, body([{ sender: { id: "bad" } } as never])]) {
      const data = raw(value);
      await expect(service.accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    }
    const oversized = Buffer.alloc(256 * 1024 + 1);
    await expect(service.accept(oversized, signed(oversized))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    const proofCalls = state.proofLog.mock.calls.filter(call => call[1] === "Instagram webhook signature proof");
    expect(proofCalls).toHaveLength(5);
    expect(proofCalls.map(call => (call[0] as { payload: string }).payload)).toEqual(Array(5).fill("invalid"));
    expect(proofCalls.slice(0, 4).map(call => (call[0] as { category: string }).category)).toEqual(["INVALID_JSON", "INVALID_ENVELOPE", "INVALID_ENTRY", "INVALID_EVENT"]);
    expect((proofCalls[4]?.[0] as { category?: string }).category).toBeUndefined(); // Rejected before authentication.
    expectProofIsolated();
  });

  it.each([
    ["INVALID_ENVELOPE", { object: "other", entry: [] }],
    ["ZERO_ENTRIES", { object: "instagram", entry: [] }],
    ["MISSING_MESSAGING", { object: "instagram", entry: [{ id: "123456789" }] }],
    ["INVALID_ENTRY", { object: "instagram", entry: [{ id: "bad", messaging: [inbound()] }] }],
    ["INVALID_EVENT", body([{ sender: { id: "bad" } } as never])],
    ["ZERO_EVENTS", { object: "instagram", entry: [{ id: "123456789", messaging: [] }] }],
  ])("logs exactly one bounded %s rejection", async (category, value) => {
    enableProof();
    const data = raw(value);
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    expect(state.proofLog).toHaveBeenCalledTimes(1);
    expect(state.proofLog.mock.calls[0]?.[0]).toMatchObject({ signature: "valid", payload: "invalid", category });
    expectProofIsolated();
  });

  it("correlates retries with a keyed, domain-separated fingerprint rather than a raw hash", async () => {
    enableProof();
    const data = Buffer.from("private-invalid-json");
    const service = new InstagramDmService();
    await expect(service.accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    await expect(service.accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    const fingerprints = state.proofLog.mock.calls.map(call => (call[0] as { retryCorrelation: string }).retryCorrelation);
    expect(fingerprints[0]).toBe(fingerprints[1]);
    expect(fingerprints[0]).not.toBe(createHash("sha256").update(data).digest("hex").slice(0, 32));
    expect(state.proofLog.mock.calls.map(call => (call[0] as { category: string }).category)).toEqual(["INVALID_JSON", "INVALID_JSON"]);
    expect(JSON.stringify(state.proofLog.mock.calls)).not.toContain("private-invalid-json");
    expectProofIsolated();
  });

  it("records only allow-listed structure for a signed but incompatible messaging event", async () => {
    enableProof();
    const data = raw({ object: "instagram", entry: [{
      id: "123456789", unknownCustomerField: "private-unknown-value",
      messaging: [{ sender: { id: "987654321" }, recipient: { id: "123456789" }, timestamp: "private-timestamp", message: { mid: "m-1", text: "What is the price?", is_echo: false } }],
    }] });
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    const diagnostic: unknown = state.proofLog.mock.calls[0]?.[0];
    expect(diagnostic).toMatchObject({
      category: "INVALID_EVENT", stage: "EVENT", topLevel: "OBJECT", topFields: ["object", "entry"], objectIsInstagram: true,
      entryCount: 1, entryFields: ["id", "messaging"], messagingType: "ARRAY", messagingCount: 1,
      changesType: "ABSENT", changeFields: [], envelopeVariant: "MESSAGING",
      fieldTypes: { senderId: "STRING", recipientId: "STRING", timestamp: "STRING", messageMid: "STRING", messageText: "STRING", messageIsEcho: "BOOLEAN", messageIsDeleted: "ABSENT" },
    });
    expect(JSON.stringify(state.proofLog.mock.calls)).not.toMatch(/private-unknown-value|private-timestamp|What is the price\?|987654321|123456789|m-1|synthetic-app-secret|sha256=/);
    expectProofIsolated();
  });

  it("distinguishes a changes-shaped signed delivery without accepting or processing it", async () => {
    enableProof();
    const data = raw({ object: "instagram", entry: [{ id: "123456789", changes: [{ field: "messages", value: { text: "private-message" } }] }] });
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    expect(state.proofLog.mock.calls[0]?.[0]).toMatchObject({
      category: "MISSING_MESSAGING", stage: "MESSAGING", entryFields: ["id", "changes"], messagingType: "ABSENT", changesType: "ARRAY",
      changeFields: ["field", "value"], envelopeVariant: "CHANGES",
    });
    expect(JSON.stringify(state.proofLog.mock.calls)).not.toContain("private-message");
    expectProofIsolated();
  });

  it("accepts exactly 200 events but rejects 201 before proof acknowledgment", async () => {
    enableProof();
    const service = new InstagramDmService();
    const make = (count: number) => raw({ object: "instagram", entry: Array.from({ length: Math.ceil(count / 50) }, (_, index) => ({ id: "123456789", messaging: Array.from({ length: Math.min(50, count - index * 50) }, (_, n) => inbound(`batch-${index}-${n}`)) })) });
    const accepted = make(200);
    await expect(service.accept(accepted, signed(accepted))).resolves.toEqual({ accepted: true, proofOnly: true });
    expect(state.proofLog).toHaveBeenLastCalledWith({ signature: "valid", payload: "valid", bytes: accepted.length, entries: 4, events: 200 }, "Instagram webhook signature proof");
    const rejected = make(201);
    await expect(service.accept(rejected, signed(rejected))).rejects.toMatchObject({ code: "INSTAGRAM_WEBHOOK_BATCH_LIMIT" });
    expect(state.proofLog.mock.lastCall?.[0]).toMatchObject({ signature: "valid", payload: "invalid", category: "EVENT_LIMIT", bytes: rejected.length, entries: 5, events: 201 });
    expectProofIsolated();
  });

  it("rejects aggregate work above 200 across multiple envelopes", async () => {
    enableProof();
    const data = raw(Array.from({ length: 5 }, (_, index) => ({ object: "instagram", entry: [{ id: "123456789", messaging: Array.from({ length: index === 4 ? 41 : 40 }, (_, n) => inbound(`envelope-${index}-${n}`)) }] })));
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INSTAGRAM_WEBHOOK_BATCH_LIMIT" });
    expect(state.proofLog.mock.lastCall?.[0]).toMatchObject({ signature: "valid", payload: "invalid", category: "EVENT_LIMIT", bytes: data.length, entries: 5, events: 201 });
    expectProofIsolated();
  });

  it("keeps normal processing blocked when both signature flags are false", async () => {
    state.env.META_INSTAGRAM_SIGNATURE_PROVEN = false;
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.proofLog).not.toHaveBeenCalled();
    expectProofIsolated();
  });

  it("keeps proof mode blocked outside the exact staging service", async () => {
    vi.stubEnv("RENDER_SERVICE_ID", "another-service");
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "b2brain-staging-api.onrender.com");
    state.env.META_INSTAGRAM_SIGNATURE_PROVEN = false;
    state.env.META_INSTAGRAM_SIGNATURE_PROOF_ENABLED = true;
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.proofLog).not.toHaveBeenCalled();
    expect(state.assets).not.toHaveBeenCalled();
  });

  it("authenticates bytes before parsing and blocks missing or bad signatures", async () => {
    const service = new InstagramDmService();
    expect(service.verify("subscribe", state.env.META_INSTAGRAM_VERIFY_TOKEN, "12345")).toBe("12345");
    expect(() => service.verify("subscribe", "wrong", "12345")).toThrow();
    const data = raw(body());
    await expect(service.accept(data, undefined)).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(service.accept(data, "sha256=bad")).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(service.accept(Buffer.from("not JSON"), signed(Buffer.from("not JSON")))).rejects.toMatchObject({ code: "INVALID_INSTAGRAM_WEBHOOK" });
    expect(state.assets).not.toHaveBeenCalled();
  });

  it("accepts batched array envelopes and routes only through the account asset", async () => {
    const data = raw([body([inbound("m-1"), inbound("m-2")])]);
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toEqual({ accepted: true, processed: 2, duplicate: 0, ignored: 0 });
    expect((state.assets.mock.calls[0]?.[0] as { where: { assetId: string } }).where.assetId).toBe("123456789");
    expect(JSON.stringify(state.eventCreate.mock.calls)).not.toContain("What is the price?");
    expect(JSON.stringify(state.eventCreate.mock.calls)).toContain("123456789:m-1");
  });

  it("ignores echo, self, deleted, unsupported, and non-text events", async () => {
    const data = raw(body([inbound("a", { is_echo: true }), inbound("b", { is_self: true }), inbound("c", { is_deleted: true }), inbound("d", { is_unsupported: true }), { ...inbound("e"), sender: { id: "123456789" } }, { ...inbound("f"), message: { mid: "f" } }]));
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toEqual({ accepted: true, processed: 0, duplicate: 0, ignored: 6 });
    expect(state.assets).not.toHaveBeenCalled();
  });

  it("skips one malformed event without discarding valid events in the same signed batch", async () => {
    const data = raw(body([{ sender: { id: "not-an-id" } }, inbound("valid-after-invalid")] as never));
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toEqual({ accepted: true, processed: 1, duplicate: 0, ignored: 1 });
    expect(state.eventCreate).toHaveBeenCalledOnce();
  });

  it("skips a malformed entry while retaining a valid account entry", async () => {
    const valid = raw({ object: "instagram", entry: [{ id: "bad-account" }, { id: "123456789", messaging: [inbound("good")] }] });
    await expect(new InstagramDmService().accept(valid, signed(valid))).resolves.toEqual({ accepted: true, processed: 1, duplicate: 0, ignored: 1 });
  });

  it("correlates a repeat sender to the existing organization inquiry", async () => {
    state.eventFind.mockResolvedValue({ resultId: "old-inquiry" });
    state.inquiryFind.mockResolvedValue({ id: "old-inquiry" });
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toMatchObject({ processed: 1 });
    expect(state.inquiryCreate).not.toHaveBeenCalled();
    expect(state.inquiryFind).toHaveBeenCalledWith({ where: { id: "old-inquiry", organizationId: "organization", deletedAt: null }, select: { id: true } });
    expect((state.timelineCreate.mock.calls[0]?.[0] as { data: { inquiryId: string; details: string } }).data).toMatchObject({ inquiryId: "old-inquiry", details: "What is the price?" });
  });

  it("deduplicates a provider retry by the account-qualified message id", async () => {
    state.eventCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    state.eventFind.mockResolvedValue({ id: "prior-event" });
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).resolves.toEqual({ accepted: true, processed: 0, duplicate: 1, ignored: 0 });
    expect(state.inquiryCreate).not.toHaveBeenCalled();
  });

  it("does not misclassify an unrelated unique constraint as a duplicate message", async () => {
    state.eventCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unrelated", { code: "P2002", clientVersion: "test" }));
    state.eventFind.mockResolvedValue(null);
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects total work above the bound before writing any event", async () => {
    const data = raw({ object: "instagram", entry: Array.from({ length: 5 }, () => ({ id: "123456789", messaging: Array.from({ length: 50 }, (_, n) => inbound(`batch-${n}`)) })) });
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INSTAGRAM_WEBHOOK_BATCH_LIMIT" });
    expect(state.eventCreate).not.toHaveBeenCalled();
  });

  it("does not process an account without a unique active tenant mapping", async () => {
    state.assets.mockResolvedValue([]);
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    expect(state.eventCreate).not.toHaveBeenCalled();
  });
  it("does not create an event when disconnect releases routing before the transaction recheck", async () => {
    state.assets.mockResolvedValueOnce([{ id: "asset", connectorId: "connector", organizationId: "organization" }]).mockResolvedValueOnce([]);
    const data = raw(body());
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    expect(state.eventCreate).not.toHaveBeenCalled();
  });
  it("ignores old undelivered messages after reconnect but accepts a post-cutover delivery", async () => {
    const cutover = Date.now();
    state.binding.mockResolvedValue({ webhookCutoverAt: new Date(cutover) });
    const old = raw(body([{ ...inbound("old"), timestamp: cutover - 1 }]));
    await expect(new InstagramDmService().accept(old, signed(old))).resolves.toMatchObject({ processed: 0, ignored: 1 });
    expect(state.eventCreate).not.toHaveBeenCalled();
    const current = raw(body([{ ...inbound("current"), timestamp: cutover + 1 }]));
    await expect(new InstagramDmService().accept(current, signed(current))).resolves.toMatchObject({ processed: 1 });
  });
});
