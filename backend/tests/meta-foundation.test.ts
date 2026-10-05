import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ assets: vi.fn(), services: vi.fn(), plan: vi.fn(), connector: vi.fn(), connectorUpdate: vi.fn(), membership: vi.fn(), access: vi.fn(), stateCreate: vi.fn(), stateConsume: vi.fn(), stateInvalidate: vi.fn(), transaction: vi.fn() }));
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: db.access }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  metaConnectedAsset: { findMany: db.assets }, organizationService: { count: db.services }, organizationPlan: { findUnique: db.plan },
  organizationMembership: { findFirst: db.membership },
  integrationConnector: { findFirst: db.connector }, integrationAuthorizationState: { updateMany: db.stateConsume }, $transaction: db.transaction,
} }));
import { metaAsset, resolveMetaAsset } from "../src/modules/automation-bridge/meta-assets.service.js";
import { MetaAuthorizationStateService } from "../src/modules/automation-bridge/meta-authorization-state.service.js";

const orgA = crypto.randomUUID(), orgB = crypto.randomUUID(), userA = crypto.randomUUID(), memberA = crypto.randomUUID(), connectorId = crypto.randomUUID();
const account = { capability: "INSTAGRAM_MESSAGES" as const, provider: "META" as const, assetType: "INSTAGRAM_ACCOUNT" as const, assetId: "123456789" };
const context = { organizationId: orgA, userId: userA, membershipId: memberA };

describe("Meta multi-tenant foundation", () => {
  beforeEach(() => { vi.clearAllMocks(); db.assets.mockResolvedValue([{ id: "asset-a", organizationId: orgA, connectorId }]); db.services.mockResolvedValue(2); db.plan.mockResolvedValue(null); db.connector.mockResolvedValue({ id: connectorId }); db.connectorUpdate.mockResolvedValue({ count: 1 }); db.membership.mockResolvedValue({ organizationId: orgA, userId: userA, role: { code: "ORGANIZATION_OWNER", permissions: [{ permission: { code: "AUTOMATION_MANAGE" } }] }, user: { isPlatformAdmin: false } }); db.access.mockResolvedValue("READ_WRITE"); db.stateCreate.mockResolvedValue({}); db.stateConsume.mockResolvedValue({ count: 1 }); db.transaction.mockImplementation((callback: (tx: object) => Promise<unknown>) => callback({ integrationConnector: { updateMany: db.connectorUpdate }, integrationAuthorizationState: { create: db.stateCreate, updateMany: db.stateInvalidate } })); });
  it("resolves only the signed asset's unique internal organization", async () => {
    await expect(resolveMetaAsset(account, orgA)).resolves.toMatchObject({ organizationId: orgA, connectorId });
    await expect(resolveMetaAsset(account, orgB)).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    expect((db.assets.mock.calls[0]?.[0] as { where: unknown }).where).toMatchObject({ routingStatus: "ACTIVE", connector: { status: "ACTIVE" } });
  });
  it("rejects missing, ambiguous, inactive and mismatched asset identifiers", async () => {
    expect(() => metaAsset.parse({ ...account, assetType: "PAGE" })).toThrow();
    expect(() => metaAsset.parse({ ...account, assetId: "../other" })).toThrow();
    db.assets.mockResolvedValueOnce([]).mockResolvedValueOnce([{ organizationId: orgA }, { organizationId: orgB }]);
    await expect(resolveMetaAsset(account)).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    await expect(resolveMetaAsset(account)).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
  });
  it("blocks disabled LEADS, AUTOMATION or MARKETING before downstream writes", async () => {
    db.services.mockResolvedValue(1);
    await expect(resolveMetaAsset(account)).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
    await expect(resolveMetaAsset({ capability: "META_ADVERTISING", provider: "META", assetType: "AD_ACCOUNT", assetId: "555555555" })).rejects.toMatchObject({ code: "META_ASSET_UNAVAILABLE" });
  });
  it("issues hashed, short-lived, capability-bound state and rejects arbitrary redirects", async () => {
    const service = new MetaAuthorizationStateService();
    const result = await service.issue(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "/automation");
    expect(result.state).toMatch(/^[A-Za-z0-9_-]{40,100}$/);
    expect((db.stateCreate.mock.calls[0]?.[0] as { data: unknown }).data).toMatchObject({ provider: "META", capability: "INSTAGRAM_MESSAGES", loginVariant: "INSTAGRAM_LOGIN", organizationId: orgA, connectorId, returnPath: "/automation" });
    expect(JSON.stringify(db.stateCreate.mock.calls)).not.toContain(result.state);
    expect(db.connectorUpdate.mock.calls[0]?.[0]).toMatchObject({ where: { organizationId: orgA, status: "DRAFT", credentialStatus: { in: ["NOT_CONFIGURED", "NEEDS_ATTENTION", "DISCONNECTED"] } }, data: { reauthorizationReason: (db.stateCreate.mock.calls[0]?.[0] as { data: { stateHash: string } }).data.stateHash } });
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    await expect(service.issue(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "https://evil.test")).rejects.toBeDefined();
  });
  it("atomically consumes state with exact user, org, provider, capability, variant and return path", async () => {
    const service = new MetaAuthorizationStateService(), raw = "x".repeat(43);
    await service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", raw, "/automation");
    const consumedWhere = (db.stateConsume.mock.calls[0]?.[0] as { where: { stateHash: string; connector: { reauthorizationReason: string }; expiresAt: { gt: Date } } }).where;
    expect(consumedWhere).toMatchObject({ organizationId: orgA, userId: userA, membershipId: memberA, provider: "META", capability: "INSTAGRAM_MESSAGES", loginVariant: "INSTAGRAM_LOGIN", returnPath: "/automation", consumedAt: null });
    expect(consumedWhere.connector).toMatchObject({ organizationId: orgA, reauthorizationReason: consumedWhere.stateHash });
    expect(consumedWhere.expiresAt.gt).toBeInstanceOf(Date);
    db.stateConsume.mockResolvedValue({ count: 0 });
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", raw, "/automation")).rejects.toMatchObject({ code: "META_STATE_INVALID" });
  });
  it("invalidates the first state when Connect is clicked again", async () => {
    const service = new MetaAuthorizationStateService();
    const first = await service.issue(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "/automation");
    const firstHash = (db.stateCreate.mock.calls[0]?.[0] as { data: { stateHash: string } }).data.stateHash;
    const second = await service.issue(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "/automation");
    const secondHash = (db.stateCreate.mock.calls[1]?.[0] as { data: { stateHash: string } }).data.stateHash;
    expect(firstHash).not.toBe(secondHash);
    expect(db.stateInvalidate).toHaveBeenCalledTimes(2);
    expect(db.stateInvalidate.mock.calls[1]?.[0]).toMatchObject({ where: { organizationId: orgA, connectorId, consumedAt: null } });
    db.stateConsume.mockImplementation(({ where }: { where: { stateHash: string; connector: { reauthorizationReason: string } } }) => ({ count: Number(where.stateHash === secondHash && where.connector.reauthorizationReason === secondHash) }));
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", first.state, "/automation")).rejects.toMatchObject({ code: "META_STATE_INVALID" });
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", second.state, "/automation")).resolves.toBeDefined();
  });
  it("does not replace a callback generation while authorization is processing", async () => {
    db.connectorUpdate.mockResolvedValueOnce({ count: 0 });
    await expect(new MetaAuthorizationStateService().issue(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "/automation")).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    expect(db.stateInvalidate).not.toHaveBeenCalled();
    expect(db.stateCreate).not.toHaveBeenCalled();
  });
  it("rechecks suspension, permission and service loss before consuming state", async () => {
    const service = new MetaAuthorizationStateService(), raw = "x".repeat(43);
    db.membership.mockResolvedValueOnce(null);
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", raw, "/automation")).rejects.toMatchObject({ code: "META_CONNECTION_UNAVAILABLE" });
    db.access.mockRejectedValueOnce(new Error("permission removed"));
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", raw, "/automation")).rejects.toThrow("permission removed");
    db.access.mockResolvedValueOnce("READ_WRITE").mockResolvedValueOnce("READ_ONLY");
    await expect(service.consume(context, connectorId, "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", raw, "/automation")).rejects.toMatchObject({ code: "META_CONNECTION_UNAVAILABLE" });
    expect(db.stateConsume).not.toHaveBeenCalled();
  });
});
