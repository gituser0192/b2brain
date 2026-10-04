import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ access: vi.fn(), find: vi.fn(), asset: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn(), help: vi.fn() }));
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: calls.access }));
vi.mock("../src/modules/service-requests/service-request.service.js", () => ({ ServiceRequestService: class { create = calls.help; } }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  integrationConnector: { findFirst: calls.find, updateMany: calls.update, create: calls.create },
  metaConnectedAsset: { findFirst: calls.asset },
  auditEvent: { create: calls.audit },
} }));
import { MetaFoundationService } from "../src/modules/automation-bridge/meta-foundation.service.js";

const context = { organizationId: randomUUID(), userId: randomUUID(), membershipId: randomUUID(), permissions: ["AUTOMATION_VIEW", "AUTOMATION_MANAGE"] };

describe("Meta connection preparation", () => {
  beforeEach(() => { vi.clearAllMocks(); calls.access.mockResolvedValue("READ_WRITE"); calls.audit.mockResolvedValue({}); });
  it("does not mutate while viewing capability status", async () => {
    calls.find.mockResolvedValue(null);
    const result = await new MetaFoundationService().overview(context as never);
    expect(result.providerAvailable).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
  });
  it.each([
    ["matching current asset", {}, "PRIVATE_TEST_READY"],
    ["no asset", null, "NEEDS_ATTENTION"],
    ["inactive asset", { routingStatus: "INACTIVE" }, "NEEDS_ATTENTION"],
    ["released asset", { releasedAt: new Date() }, "NEEDS_ATTENTION"],
    ["other connector", { connectorId: "other" }, "NEEDS_ATTENTION"],
    ["other organization", { organizationId: randomUUID() }, "NEEDS_ATTENTION"],
    ["missing cutover", { webhookCutoverAt: null }, "NEEDS_ATTENTION"],
    ["previous generation", { webhookCutoverAt: new Date("2026-01-01") }, "NEEDS_ATTENTION"],
    ["missing required scope", { grantedScopes: ["instagram_business_basic"] }, "NEEDS_ATTENTION"],
  ])("projects %s as %s", async (_name, changes, expected) => {
    const configuredAt = new Date("2026-09-01");
    const asset = changes === null ? null : { organizationId: context.organizationId, connectorId: "connector", capability: "INSTAGRAM_MESSAGES", provider: "META", loginVariant: "INSTAGRAM_LOGIN", assetType: "INSTAGRAM_ACCOUNT", assetId: "1234567890", routingStatus: "ACTIVE", releasedAt: null, webhookCutoverAt: new Date("2026-09-02"), grantedScopes: ["instagram_business_basic", "instagram_business_manage_messages"], ...changes };
    calls.find.mockImplementation(({ where }: { where: { provider: string } }) => where.provider === "META_INSTAGRAM_DM" ? { id: "connector", status: "ACTIVE", credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: new Date(Date.now() + 86400000), credentialsConfiguredAt: configuredAt, accessTokenEncrypted: "synthetic-encrypted", credentialKeyVersion: 2, externalAccountRef: "1234567890" } : null);
    calls.asset.mockImplementation(({ where }: { where: Record<string, unknown> }) => asset && Object.entries(where).every(([key, value]) => {
      if (key === "webhookCutoverAt") return asset.webhookCutoverAt instanceof Date && asset.webhookCutoverAt >= (value as { gte: Date }).gte;
      return Object.is(asset[key as keyof typeof asset], value);
    }) ? { grantedScopes: asset.grantedScopes } : null);
    const result = await new MetaFoundationService().overview(context as never);
    expect(result.items[0]?.state).toBe(expected);
    expect(calls.asset).toHaveBeenCalledOnce();
    expect(calls.asset.mock.calls[0]?.[0]).toMatchObject({ where: { organizationId: context.organizationId, connectorId: "connector", assetId: "1234567890", routingStatus: "ACTIVE", releasedAt: null } });
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
  });
  it.each(["NOT_CONFIGURED", "AUTHORIZING", "RECONNECT_REQUIRED"])("never reports ready with %s credential status", async credentialStatus => {
    calls.find.mockImplementation(({ where }: { where: { provider: string } }) => where.provider === "META_INSTAGRAM_DM" ? { id: "connector", status: "ACTIVE", credentialStatus } : null);
    const result = await new MetaFoundationService().overview(context as never);
    expect(result.items[0]?.state).not.toBe("PRIVATE_TEST_READY");
    expect(calls.asset).not.toHaveBeenCalled();
  });
  it("keeps a refreshed token ready against the unchanged authorization generation", async () => {
    const generation = new Date("2026-09-01T00:00:00.000Z");
    const cutover = new Date("2026-09-02T00:00:00.000Z");
    calls.find.mockImplementation(({ where }: { where: { provider: string } }) => where.provider === "META_INSTAGRAM_DM" ? { id: "connector", status: "ACTIVE", credentialStatus: "PRIVATE_TEST_READY", accessTokenEncrypted: "refreshed-ciphertext", credentialKeyVersion: 2, credentialExpiresAt: new Date(Date.now() + 86400000), credentialsConfiguredAt: generation, credentialValidatedAt: new Date(Date.now() - 1000), externalAccountRef: "1234567890" } : null);
    calls.asset.mockImplementation(({ where }: { where: { webhookCutoverAt: { gte: Date } } }) => cutover >= where.webhookCutoverAt.gte ? { grantedScopes: ["instagram_business_basic", "instagram_business_manage_messages"] } : null);
    const result = await new MetaFoundationService().overview(context as never);
    expect(result.items[0]?.state).toBe("PRIVATE_TEST_READY");
    expect(calls.asset).toHaveBeenCalledOnce();
    expect(calls.update).not.toHaveBeenCalled();
  });
  it("prepares a disconnected connector for a future fresh authorization", async () => {
    calls.find.mockResolvedValue({ id: "connector", status: "PAUSED", credentialStatus: "DISCONNECTED" });
    calls.update.mockResolvedValue({ count: 1 });
    await expect(new MetaFoundationService().initialize(context as never, "INSTAGRAM_MESSAGES")).resolves.toMatchObject({ connectorId: "connector", providerAvailable: false });
    expect((calls.update.mock.calls[0]?.[0] as { where: unknown; data: unknown })).toMatchObject({ where: { organizationId: context.organizationId, credentialStatus: "DISCONNECTED" }, data: { status: "DRAFT", credentialStatus: "NOT_CONFIGURED" } });
    expect(calls.audit).toHaveBeenCalledOnce();
  });
  it("does not bypass a missing service entitlement", async () => {
    calls.access.mockRejectedValueOnce(new Error("disabled"));
    await expect(new MetaFoundationService().initialize(context as never, "META_LEAD_ADS")).rejects.toThrow("disabled");
    expect(calls.find).not.toHaveBeenCalled();
  });
  it("stores only controlled help diagnostics with the 24-hour response commitment", async () => {
    calls.help.mockResolvedValue({ id: "synthetic-help" });
    const input = { capability: "INSTAGRAM_MESSAGES" as const, step: "VERIFICATION" as const, category: "PERMISSION" as const, errorCategory: "MISSING_PERMISSION" as const };
    await expect(new MetaFoundationService().requestHelp(context as never, input)).resolves.toMatchObject({ created: true, responseCommitmentHours: 24 });
    const args = calls.help.mock.calls[0] as unknown[];
    expect(args[0]).toBe(context.organizationId);
    expect(args[2]).toMatchObject({ category: "AUTOMATION", priority: "MEDIUM" });
    expect(JSON.stringify(args)).not.toMatch(/access[_ -]?token|password|secret|message body/i);
  });
});
