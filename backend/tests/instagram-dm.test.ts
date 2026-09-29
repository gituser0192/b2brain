import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: { EXTERNAL_CHANNELS_ENABLED: true, META_INSTAGRAM_DM_ENABLED: true, META_INSTAGRAM_VERIFY_TOKEN: "synthetic-verify-token", META_INSTAGRAM_APP_SECRET: "synthetic-app-secret", META_INSTAGRAM_ACCOUNT_ID: "123456789" },
  findMany: vi.fn(), transaction: vi.fn(), eventCreate: vi.fn(), inquiryCreate: vi.fn(), eventUpdate: vi.fn(), connectorUpdate: vi.fn(),
}));
vi.mock("../src/config/env.js", () => ({ env: state.env }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  integrationConnector: { findMany: state.findMany },
  $transaction: state.transaction,
} }));
import { InstagramDmService } from "../src/modules/automation-bridge/instagram-dm.service.js";

const body = { object: "instagram", entry: [{ id: "123456789", messaging: [{ sender: { id: "987654321" }, recipient: { id: "123456789" }, message: { mid: "m-1", text: "What is the price?" } }] }] };
const signed = (raw: Buffer) => `sha256=${createHmac("sha256", state.env.META_INSTAGRAM_APP_SECRET).update(raw).digest("hex")}`;

describe("Instagram DM intake", () => {
  it("requires the verify token and a valid Meta signature before creating a lead", async () => {
    const service = new InstagramDmService();
    expect(service.verify("subscribe", state.env.META_INSTAGRAM_VERIFY_TOKEN, "challenge")).toBe("challenge");
    expect(() => service.verify("subscribe", "wrong", "challenge")).toThrow();
    const raw = Buffer.from(JSON.stringify(body));
    await expect(service.accept(raw, "sha256=bad", body)).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(state.findMany).not.toHaveBeenCalled();
    state.findMany.mockResolvedValue([{ id: "connector", organizationId: "organization", createdById: "user" }]);
    state.eventCreate.mockResolvedValue({ id: "event", traceId: "trace" });
    state.inquiryCreate.mockResolvedValue({ id: "lead" });
    state.transaction.mockImplementation((callback: (tx: object) => Promise<unknown>) => callback({ integrationEvent: { create: state.eventCreate, update: state.eventUpdate }, inquiry: { create: state.inquiryCreate }, integrationConnector: { update: state.connectorUpdate } }));
    await expect(service.accept(raw, signed(raw), body)).resolves.toEqual({ accepted: true, processed: 1, duplicate: 0 });
    expect(JSON.stringify(state.inquiryCreate.mock.calls)).toContain('"source":"SOCIAL"');
    expect(JSON.stringify(state.inquiryCreate.mock.calls)).toContain('"message":"What is the price?"');
    expect(JSON.stringify(state.eventCreate.mock.calls)).toContain('"externalEventId":"m-1"');
    expect(JSON.stringify(state.eventCreate.mock.calls)).toContain('"signatureVerified":true');
  });
});
