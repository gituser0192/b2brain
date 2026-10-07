import { createHmac } from "node:crypto";
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
  for (const [record] of state.proofLog.mock.calls) {
    const fields = record as Record<string, unknown>;
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(["signature", "bytes"]));
    expect(Object.keys(fields).every(key => ["signature", "payload", "bytes", "entries", "events"].includes(key))).toBe(true);
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
    expect(state.proofLog.mock.calls).toHaveLength(5);
    expect(state.proofLog.mock.calls.map(call => (call[0] as { payload: string }).payload)).toEqual(Array(5).fill("invalid"));
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
    expect(state.proofLog).toHaveBeenLastCalledWith({ signature: "valid", payload: "invalid", bytes: rejected.length, entries: 5, events: 201 }, "Instagram webhook signature proof");
    expectProofIsolated();
  });

  it("rejects aggregate work above 200 across multiple envelopes", async () => {
    enableProof();
    const data = raw(Array.from({ length: 5 }, (_, index) => ({ object: "instagram", entry: [{ id: "123456789", messaging: Array.from({ length: index === 4 ? 41 : 40 }, (_, n) => inbound(`envelope-${index}-${n}`)) }] })));
    await expect(new InstagramDmService().accept(data, signed(data))).rejects.toMatchObject({ code: "INSTAGRAM_WEBHOOK_BATCH_LIMIT" });
    expect(state.proofLog).toHaveBeenLastCalledWith({ signature: "valid", payload: "invalid", bytes: data.length, entries: 5, events: 201 }, "Instagram webhook signature proof");
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
