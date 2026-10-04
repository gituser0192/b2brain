import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const fixture = vi.hoisted(() => ({
  organizationId: "11111111-1111-4111-8111-111111111111",
  otherOrganizationId: "22222222-2222-4222-8222-222222222222",
  secret: "synthetic-m3-signature-secret",
  key: "synthetic-m3-encryption-key-with-thirty-two-bytes",
}));
vi.mock("../src/config/env.js", () => ({ env: {
  NODE_ENV: "test", FRONTEND_URL: "http://localhost:3000",
  META_INSTAGRAM_CONNECT_ENABLED: true, META_INSTAGRAM_DM_ENABLED: true,
  META_INSTAGRAM_SIGNATURE_PROVEN: true, EXTERNAL_CHANNELS_ENABLED: true,
  META_INSTAGRAM_PRIVATE_ORGANIZATION_ID: fixture.organizationId,
  META_INSTAGRAM_APP_ID: "123456", META_INSTAGRAM_APP_SECRET: fixture.secret,
  META_INSTAGRAM_REDIRECT_URI: "https://example.test/api/v1/instagram-login/redirect",
  META_INSTAGRAM_API_VERSION: "v26.0", BRIDGE_ENCRYPTION_KEY_V2: fixture.key,
} }));

type LoginService = InstanceType<typeof import("../src/modules/automation-bridge/instagram-login.service.js").InstagramLoginService>;
type DmService = InstanceType<typeof import("../src/modules/automation-bridge/instagram-dm.service.js").InstagramDmService>;
let db: PrismaClient, login: LoginService, dm: DmService;
let userId: string, membershipId: string, connectorId: string;
const accountId = "12345678901234567", senderId = "98765432101234567";
const context = () => ({ organizationId: fixture.organizationId, membershipId, userId });
const signed = (raw: Buffer) => `sha256=${createHmac("sha256", fixture.secret).update(raw).digest("hex")}`;
function gate() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release };
}
function delivery(mid: string, timestamp: number, sender = senderId) {
  const raw = Buffer.from(JSON.stringify({ object: "instagram", entry: [{ id: accountId, messaging: [{ sender: { id: sender }, recipient: { id: accountId }, timestamp, message: { mid, text: "Synthetic question" } }] }] }));
  return dm.accept(raw, signed(raw));
}
async function draft(name: string) {
  return db.integrationConnector.create({ data: { organizationId: fixture.organizationId, name, type: "SOCIAL", provider: "META_INSTAGRAM_DM", mode: "ASSISTED", status: "DRAFT", configuration: {}, createdById: userId, updatedById: userId } });
}

describe.skipIf(!process.env.M3_TEST_DATABASE_URL)("M3 disposable PostgreSQL proof", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.M3_TEST_DATABASE_URL;
    const database = await import("../src/database/prisma.js"); db = database.prisma;
    const { InstagramLoginService } = await import("../src/modules/automation-bridge/instagram-login.service.js");
    const { InstagramDmService } = await import("../src/modules/automation-bridge/instagram-dm.service.js");
    const provider = {
      exchange: () => Promise.resolve({ token: "synthetic-access-token", expiresAt: new Date(Date.now() + 7 * 86400000), scopes: ["instagram_business_basic", "instagram_business_manage_messages"], accountId }),
      subscribe: () => Promise.resolve(true),
      refresh: () => Promise.resolve({ token: "synthetic-refreshed-token", expiresAt: new Date(Date.now() + 7 * 86400000) }),
    };
    login = new InstagramLoginService(provider); dm = new InstagramDmService();
    userId = randomUUID(); membershipId = randomUUID();
    await db.user.create({ data: { id: userId, firstName: "Synthetic", email: `${userId}@example.test`, passwordHash: "synthetic" } });
    for (const [id, slug] of [[fixture.organizationId, "m3-private"], [fixture.otherOrganizationId, "m3-other"]] as const)
      await db.organization.create({ data: { id, name: slug, slug } });
    const role = await db.role.create({ data: { code: "ORGANIZATION_OWNER", name: "Synthetic owner" } });
    const permission = await db.permission.create({ data: { code: "AUTOMATION_MANAGE", name: "Manage automation" } });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await db.organizationMembership.create({ data: { id: membershipId, organizationId: fixture.organizationId, userId, roleId: role.id } });
    for (const code of ["AUTOMATION", "LEADS"]) {
      const service = await db.service.create({ data: { code, name: code, status: "ACTIVE" } });
      await db.organizationService.create({ data: { organizationId: fixture.organizationId, serviceId: service.id, createdById: userId, updatedById: userId } });
    }
    connectorId = (await draft("Primary synthetic Instagram")).id;
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("consumes one callback generation and rejects an overlapping callback", async () => {
    const first = new URL((await login.start(context(), connectorId)).authorizationUrl).searchParams.get("state")!;
    const second = new URL((await login.start(context(), connectorId)).authorizationUrl).searchParams.get("state")!;
    const results = await Promise.allSettled([login.callbackFromRedirect(first, "synthetic-code-a"), login.callbackFromRedirect(second, "synthetic-code-b")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const connector = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    const asset = await db.metaConnectedAsset.findFirstOrThrow({ where: { connectorId, routingStatus: "ACTIVE" } });
    expect(connector.credentialStatus).toBe("PRIVATE_TEST_READY");
    expect(connector.externalAccountRef).toBe(accountId);
    expect(asset.webhookCutoverAt).toBeInstanceOf(Date);
    expect(await db.metaConnectedAsset.count({ where: { assetId: accountId, routingStatus: "ACTIVE" } })).toBe(1);
  });

  it("deduplicates simultaneous delivery and correlates repeat messages within the organization", async () => {
    const timestamp = Date.now() + 10;
    const results = await Promise.allSettled([delivery("duplicate-mid", timestamp), delivery("duplicate-mid", timestamp)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(2);
    expect(await db.integrationEvent.count({ where: { connectorId, externalEventId: `${accountId}:duplicate-mid` } })).toBe(1);
    expect(await db.inquiry.count({ where: { organizationId: fixture.organizationId } })).toBe(1);
    await delivery("second-mid", timestamp + 1);
    const events = await db.integrationEvent.findMany({ where: { connectorId, eventName: "INSTAGRAM_DM" }, select: { resultId: true } });
    expect(new Set(events.map(event => event.resultId)).size).toBe(1);
    expect(await db.inquiry.count({ where: { organizationId: fixture.otherOrganizationId } })).toBe(0);
  });

  it("cannot assign the active provider account to a second organization", async () => {
    const other = await db.integrationConnector.create({ data: { organizationId: fixture.otherOrganizationId, name: "Other synthetic", type: "SOCIAL", provider: "META_INSTAGRAM_DM", mode: "ASSISTED", configuration: {}, createdById: userId, updatedById: userId } });
    await expect(db.metaConnectedAsset.create({ data: { organizationId: fixture.otherOrganizationId, connectorId: other.id, provider: "META", capability: "INSTAGRAM_MESSAGES", loginVariant: "INSTAGRAM_LOGIN", assetType: "INSTAGRAM_ACCOUNT", assetId: accountId, routingStatus: "ACTIVE" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects a stale refresh after its credential has been replaced", async () => {
    const { encryptSecret } = await import("../src/modules/automation-bridge/bridge.crypto.js");
    const prior = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    await db.integrationConnector.update({ where: { id: connectorId }, data: { credentialValidatedAt: new Date(Date.now() - 2 * 86400000) } });
    const newer = encryptSecret("synthetic-newer-token", 2, { organizationId: fixture.organizationId, connectorId });
    await db.integrationConnector.update({ where: { id: connectorId }, data: { accessTokenEncrypted: newer } });
    expect(prior.accessTokenEncrypted).not.toBe(newer);
    // The old snapshot cannot win the exact credential compare-and-swap.
    const changed = await db.integrationConnector.updateMany({ where: { id: connectorId, organizationId: fixture.organizationId, accessTokenEncrypted: prior.accessTokenEncrypted }, data: { credentialStatus: "RECONNECT_REQUIRED" } });
    expect(changed.count).toBe(0);
    expect((await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } })).accessTokenEncrypted).toBe(newer);
  });

  it("rejects pre-reconnect deliveries and accepts post-reconnect deliveries", async () => {
    const { disconnectMetaAsset } = await import("../src/modules/automation-bridge/meta-assets.service.js");
    const before = (await db.metaConnectedAsset.findFirstOrThrow({ where: { connectorId, routingStatus: "ACTIVE" } })).webhookCutoverAt!.getTime();
    await disconnectMetaAsset(fixture.organizationId, connectorId, userId);
    await db.integrationConnector.update({ where: { id: connectorId }, data: { status: "DRAFT", credentialStatus: "NOT_CONFIGURED" } });
    const state = new URL((await login.start(context(), connectorId)).authorizationUrl).searchParams.get("state")!;
    await login.callbackFromRedirect(state, "synthetic-reconnect-code");
    const after = (await db.metaConnectedAsset.findFirstOrThrow({ where: { connectorId, routingStatus: "ACTIVE" } })).webhookCutoverAt!.getTime();
    expect(after).toBeGreaterThanOrEqual(before);
    const old = await delivery("old-undelivered-mid", before - 1);
    expect(old).toMatchObject({ processed: 0, ignored: 1 });
    expect(await db.integrationEvent.count({ where: { connectorId, externalEventId: `${accountId}:old-undelivered-mid` } })).toBe(0);
    const current = await delivery("post-reconnect-mid", after + 1);
    expect(current).toMatchObject({ processed: 1 });
  });

  it("does not mistake an unrelated database uniqueness failure for a duplicate message", async () => {
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX "m3proof_unrelated_event_name" ON "IntegrationEvent" ("eventName") WHERE "externalEventId" IN ('${accountId}:post-reconnect-mid', '${accountId}:unrelated-unique-mid')`);
    try {
      await expect(delivery("unrelated-unique-mid", Date.now() + 1000)).rejects.toMatchObject({ code: "P2002" });
      expect(await db.integrationEvent.count({ where: { connectorId, externalEventId: `${accountId}:unrelated-unique-mid` } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP INDEX "m3proof_unrelated_event_name"');
    }
  });

  it("rejects an oversized signed batch before making any database writes", async () => {
    const before = await db.integrationEvent.count({ where: { connectorId } });
    const raw = Buffer.from(JSON.stringify({ object: "instagram", entry: Array.from({ length: 5 }, () => ({ id: accountId, messaging: Array.from({ length: 41 }, (_, index) => ({ sender: { id: senderId }, recipient: { id: accountId }, timestamp: Date.now() + 1000, message: { mid: `batch-${index}`, text: "Synthetic question" } })) })) }));
    await expect(dm.accept(raw, signed(raw))).rejects.toMatchObject({ code: "INSTAGRAM_WEBHOOK_BATCH_LIMIT" });
    expect(await db.integrationEvent.count({ where: { connectorId } })).toBe(before);
  });

  it("does not write when disconnect releases routing while a webhook waits at the transaction lock", async () => {
    const { disconnectMetaAsset } = await import("../src/modules/automation-bridge/meta-assets.service.js");
    const { createHash } = await import("node:crypto");
    const key = createHash("sha256").update(`${fixture.organizationId}:${accountId}:${senderId}`).digest().readBigInt64BE();
    const hold = gate(), locked = gate();
    const blocker = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${key})::text`;
      locked.release();
      await hold.wait;
    });
    await locked.wait;
    const before = await db.integrationEvent.count({ where: { connectorId } });
    const pending = delivery("disconnect-race-mid", Date.now() + 1000);
    try {
      await vi.waitFor(async () => {
        const rows = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE '%pg_advisory_xact_lock%'`;
        expect(rows[0]!.count).toBeGreaterThan(0n);
      });
      await disconnectMetaAsset(fixture.organizationId, connectorId, userId);
    } finally { hold.release(); await blocker; }
    await expect(pending).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    expect(await db.integrationEvent.count({ where: { connectorId } })).toBe(before);
    expect(await db.inquiry.count({ where: { organizationId: fixture.organizationId } })).toBe(1);
  });

  it("keeps a committed webhook consistent when disconnect follows it", async () => {
    await db.integrationConnector.update({ where: { id: connectorId }, data: { status: "DRAFT", credentialStatus: "NOT_CONFIGURED" } });
    const state = new URL((await login.start(context(), connectorId)).authorizationUrl).searchParams.get("state")!;
    await login.callbackFromRedirect(state, "synthetic-after-disconnect-code");
    const cutoff = (await db.metaConnectedAsset.findFirstOrThrow({ where: { connectorId, routingStatus: "ACTIVE" } })).webhookCutoverAt!.getTime();
    expect(await delivery("commit-before-disconnect-mid", cutoff + 1)).toMatchObject({ processed: 1 });
    const { disconnectMetaAsset } = await import("../src/modules/automation-bridge/meta-assets.service.js");
    await disconnectMetaAsset(fixture.organizationId, connectorId, userId);
    expect(await db.integrationEvent.count({ where: { connectorId, externalEventId: `${accountId}:commit-before-disconnect-mid`, status: "COMPLETED" } })).toBe(1);
    expect(await db.metaConnectedAsset.count({ where: { connectorId, routingStatus: "ACTIVE", releasedAt: null } })).toBe(0);
  });

  it("cannot let a paused callback generation replace a completed reconnect", async () => {
    const { disconnectMetaAsset } = await import("../src/modules/automation-bridge/meta-assets.service.js");
    const { InstagramLoginService } = await import("../src/modules/automation-bridge/instagram-login.service.js");
    const testConnector = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    const entered = gate(), continueA = gate();
    const stale = new InstagramLoginService({
      exchange: () => Promise.resolve({ token: "synthetic-stale-token", expiresAt: new Date(Date.now() + 86400000), scopes: ["instagram_business_basic", "instagram_business_manage_messages"], accountId: "33333333333333333" }),
      subscribe: () => { entered.release(); return continueA.wait.then(() => true); },
      refresh: () => Promise.reject(new Error("not used")),
    });
    const stateA = new URL((await stale.start(context(), testConnector.id)).authorizationUrl).searchParams.get("state")!;
    const pending = stale.callbackFromRedirect(stateA, "synthetic-stale-code");
    await entered.wait;
    await disconnectMetaAsset(fixture.organizationId, testConnector.id, userId);
    const winnerService = new InstagramLoginService({
      exchange: () => Promise.resolve({ token: "synthetic-winning-token", expiresAt: new Date(Date.now() + 86400000), scopes: ["instagram_business_basic", "instagram_business_manage_messages"], accountId: "44444444444444444" }),
      subscribe: () => Promise.resolve(true),
      refresh: () => Promise.reject(new Error("not used")),
    });
    const stateB = new URL((await winnerService.start(context(), testConnector.id)).authorizationUrl).searchParams.get("state")!;
    await winnerService.callbackFromRedirect(stateB, "synthetic-winning-code");
    const winner = await db.integrationConnector.findUniqueOrThrow({ where: { id: testConnector.id } });
    const binding = await db.metaConnectedAsset.findFirstOrThrow({ where: { connectorId: testConnector.id, routingStatus: "ACTIVE" } });
    continueA.release();
    await expect(pending).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    const final = await db.integrationConnector.findUniqueOrThrow({ where: { id: testConnector.id } });
    expect(final.accessTokenEncrypted).toBe(winner.accessTokenEncrypted);
    expect(final.credentialStatus).toBe("PRIVATE_TEST_READY");
    expect(final.externalAccountRef).toBe("44444444444444444");
    expect(await db.metaConnectedAsset.findFirstOrThrow({ where: { id: binding.id } })).toMatchObject({ webhookCutoverAt: binding.webhookCutoverAt, routingStatus: "ACTIVE" });
  });

  it("cannot let a paused successful refresh overwrite a newer credential", async () => {
    const { InstagramLoginService } = await import("../src/modules/automation-bridge/instagram-login.service.js");
    await db.integrationConnector.update({ where: { id: connectorId }, data: { credentialValidatedAt: new Date(Date.now() - 2 * 86400000) } });
    const entered = gate(), continueA = gate();
    const stale = new InstagramLoginService({
      exchange: () => Promise.reject(new Error("not used")), subscribe: () => Promise.reject(new Error("not used")),
      refresh: () => { entered.release(); return continueA.wait.then(() => ({ token: "synthetic-stale-refreshed-token", expiresAt: new Date(Date.now() + 8 * 86400000) })); },
    });
    const pending = stale.refresh(context(), connectorId);
    await entered.wait;
    await login.refresh(context(), connectorId);
    const winner = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    continueA.release();
    await expect(pending).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    const final = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    expect(final.accessTokenEncrypted).toBe(winner.accessTokenEncrypted);
    expect(final.credentialExpiresAt).toEqual(winner.credentialExpiresAt);
    expect(final.credentialStatus).toBe(winner.credentialStatus);
  });

  it("cannot let a stale invalid-token result mark a newer credential reconnect-required", async () => {
    const { InstagramLoginService } = await import("../src/modules/automation-bridge/instagram-login.service.js");
    const { AppError } = await import("../src/shared/errors/app-error.js");
    await db.integrationConnector.update({ where: { id: connectorId }, data: { credentialValidatedAt: new Date(Date.now() - 2 * 86400000) } });
    const entered = gate(), continueA = gate();
    const stale = new InstagramLoginService({
      exchange: () => Promise.reject(new Error("not used")), subscribe: () => Promise.reject(new Error("not used")),
      refresh: () => { entered.release(); return continueA.wait.then(() => { throw new AppError(409, "Synthetic invalid token", "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED"); }); },
    });
    const pending = stale.refresh(context(), connectorId);
    await entered.wait;
    await login.refresh(context(), connectorId);
    const winner = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    continueA.release();
    await expect(pending).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    const final = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    expect(final.accessTokenEncrypted).toBe(winner.accessTokenEncrypted);
    expect(final.credentialExpiresAt).toEqual(winner.credentialExpiresAt);
    expect(final.credentialStatus).toBe("PRIVATE_TEST_READY");
  });

  it("allows only one owner across two organizations under concurrent account claims", async () => {
    const other = await db.integrationConnector.findFirstOrThrow({ where: { organizationId: fixture.otherOrganizationId, provider: "META_INSTAGRAM_DM" } });
    const account = "55555555555555555";
    const common = { provider: "META" as const, capability: "INSTAGRAM_MESSAGES" as const, loginVariant: "INSTAGRAM_LOGIN", assetType: "INSTAGRAM_ACCOUNT" as const, assetId: account, routingStatus: "ACTIVE" };
    const result = await Promise.allSettled([
      db.metaConnectedAsset.create({ data: { ...common, organizationId: fixture.organizationId, connectorId } }),
      db.metaConnectedAsset.create({ data: { ...common, organizationId: fixture.otherOrganizationId, connectorId: other.id } }),
    ]);
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(result.filter(item => item.status === "rejected")).toHaveLength(1);
    expect(await db.metaConnectedAsset.count({ where: { assetId: account, routingStatus: "ACTIVE", releasedAt: null } })).toBe(1);
    const before = await db.integrationEvent.count({ where: { eventName: "INSTAGRAM_DM" } });
    const raw = Buffer.from(JSON.stringify({ object: "instagram", entry: [{ id: account, messaging: [{ sender: { id: senderId }, recipient: { id: account }, timestamp: Date.now() + 1000, message: { mid: "post-reconnect-mid", text: "Synthetic conflicting route" } }] }] }));
    const { AppError } = await import("../src/shared/errors/app-error.js");
    await expect(dm.accept(raw, signed(raw))).rejects.toBeInstanceOf(AppError);
    expect(await db.integrationEvent.count({ where: { eventName: "INSTAGRAM_DM" } })).toBe(before);
    expect(await db.inquiry.count({ where: { organizationId: fixture.otherOrganizationId } })).toBe(0);
  });

  it("cannot mark a reconnected credential expired using an older database snapshot", async () => {
    const { disconnectMetaAsset } = await import("../src/modules/automation-bridge/meta-assets.service.js");
    const { InstagramLoginService } = await import("../src/modules/automation-bridge/instagram-login.service.js");
    const old = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    await disconnectMetaAsset(fixture.organizationId, connectorId, userId);
    const newer = new InstagramLoginService({
      exchange: () => Promise.resolve({ token: "synthetic-reconnected-token", expiresAt: new Date(Date.now() + 86400000), scopes: ["instagram_business_basic", "instagram_business_manage_messages"], accountId: "66666666666666666" }),
      subscribe: () => Promise.resolve(true), refresh: () => Promise.reject(new Error("not used")),
    });
    const state = new URL((await newer.start(context(), connectorId)).authorizationUrl).searchParams.get("state")!;
    await newer.callbackFromRedirect(state, "synthetic-expiry-race-code");
    const winner = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    const changed = await db.integrationConnector.updateMany({ where: { id: connectorId, organizationId: fixture.organizationId, status: "ACTIVE", credentialKeyVersion: old.credentialKeyVersion, accessTokenEncrypted: old.accessTokenEncrypted, credentialExpiresAt: old.credentialExpiresAt }, data: { credentialStatus: "RECONNECT_REQUIRED" } });
    expect(changed.count).toBe(0);
    const final = await db.integrationConnector.findUniqueOrThrow({ where: { id: connectorId } });
    expect(final.accessTokenEncrypted).toBe(winner.accessTokenEncrypted);
    expect(final.credentialStatus).toBe("PRIVATE_TEST_READY");
    expect(final.externalAccountRef).toBe("66666666666666666");
  });
});
