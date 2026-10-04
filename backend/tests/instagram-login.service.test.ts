import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/shared/errors/app-error.js";

const state = vi.hoisted(() => ({
  env: { META_INSTAGRAM_CONNECT_ENABLED: true, META_INSTAGRAM_PRIVATE_ORGANIZATION_ID: "11111111-1111-4111-8111-111111111111" },
  consume: vi.fn(), consumeRedirect: vi.fn(), access: vi.fn(), owner: vi.fn(), connector: vi.fn(), assetCreate: vi.fn(), assetFind: vi.fn(), assetUpdate: vi.fn(), assetActivate: vi.fn(), connectorUpdate: vi.fn(), connectorUpdateMany: vi.fn(), audit: vi.fn(), transaction: vi.fn(), encrypted: vi.fn(), decrypted: vi.fn(),
}));
vi.mock("../src/config/env.js", () => ({ env: state.env }));
vi.mock("../src/modules/automation-bridge/meta-authorization-state.service.js", () => ({
  MetaAuthorizationStateService: class { consume = state.consume; consumeRedirect = state.consumeRedirect; issue = vi.fn(); }, requireCurrentAccess: state.access,
}));
vi.mock("../src/modules/automation-bridge/instagram-login.provider.js", () => ({ instagramAuthorizationUrl: vi.fn(() => "https://www.instagram.com/oauth/authorize?synthetic=1"), OfficialInstagramLoginProvider: class {} }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({ encryptSecret: state.encrypted, decryptSecret: state.decrypted }));
vi.mock("../src/modules/automation-bridge/meta-assets.service.js", () => ({ disconnectMetaAsset: vi.fn() }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  metaConnectedAsset: { findFirst: state.owner }, integrationConnector: { findFirst: state.connector, updateMany: state.connectorUpdateMany },
  $transaction: state.transaction,
} }));
import { InstagramLoginService } from "../src/modules/automation-bridge/instagram-login.service.js";

const context = { organizationId: state.env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID, membershipId: "member", userId: "user" };
const grant = { token: "private-synthetic-token", expiresAt: new Date(Date.now() + 60_000), scopes: ["instagram_business_basic", "instagram_business_manage_messages"], accountId: "123456789", username: "test-account" };
const provider = { exchange: vi.fn(), subscribe: vi.fn(), refresh: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  state.owner.mockResolvedValue(null); state.connector.mockResolvedValue({ id: "connector", status: "DRAFT", configuration: {} });
  state.assetFind.mockResolvedValue(null); state.connectorUpdateMany.mockResolvedValue({ count: 1 });
  state.assetActivate.mockResolvedValue({ count: 1 });
  state.encrypted.mockReturnValue("ciphertext"); provider.exchange.mockResolvedValue(grant); provider.subscribe.mockResolvedValue(true);
  state.decrypted.mockReturnValue("synthetic-old-token"); state.consumeRedirect.mockResolvedValue({ context, connectorId: "connector" });
  state.transaction.mockImplementation((callback: (tx: object) => Promise<unknown>) => callback({
    integrationConnector: { findFirst: state.connector, update: state.connectorUpdate, updateMany: state.connectorUpdateMany },
    metaConnectedAsset: { findFirst: state.assetFind, create: state.assetCreate, update: state.assetUpdate, updateMany: state.assetActivate },
    auditEvent: { create: state.audit },
  }));
});

describe("private Instagram authorization", () => {
  it("blocks all other organizations before consuming state or calling Meta", async () => {
    await expect(new InstagramLoginService(provider).callback({ ...context, organizationId: "other" }, "connector", "state", "code")).rejects.toMatchObject({ code: "INSTAGRAM_PRIVATE_ONLY" });
    expect(state.consume).not.toHaveBeenCalled(); expect(provider.exchange).not.toHaveBeenCalled();
  });
  it("consumes the M2 state, stores scoped ciphertext, and activates only after subscription success", async () => {
    await expect(new InstagramLoginService(provider).callback(context, "connector", "state", "code")).resolves.toMatchObject({ state: "PRIVATE_TEST_READY", subscriptionVerified: true });
    expect(state.consume).toHaveBeenCalledWith(context, "connector", "INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "state", "/automation");
    expect(state.encrypted).toHaveBeenCalledWith(grant.token, 2, { organizationId: context.organizationId, connectorId: "connector" });
    expect(JSON.stringify(state.connectorUpdate.mock.calls)).not.toContain(grant.token);
    expect(state.assetActivate).toHaveBeenCalledAfter(provider.subscribe);
    const configuredAt = (state.connectorUpdateMany.mock.calls.find(([input]) => (input as { data: { credentialStatus?: string } }).data.credentialStatus === "SUBSCRIPTION_PENDING")?.[0] as { data: { credentialsConfiguredAt: Date } }).data.credentialsConfiguredAt;
    expect(state.assetActivate.mock.calls[0]?.[0]).toMatchObject({ data: { webhookCutoverAt: expect.any(Date) as unknown as Date } });
    expect(configuredAt).toBeInstanceOf(Date);
    expect((state.assetActivate.mock.calls[0]?.[0] as { data: { webhookCutoverAt: Date } }).data.webhookCutoverAt.getTime()).toBeGreaterThanOrEqual(configuredAt.getTime());
  });
  it("rejects an account already owned by another connector", async () => {
    state.owner.mockResolvedValue({ connectorId: "another" });
    await expect(new InstagramLoginService(provider).callback(context, "connector", "state", "code")).rejects.toMatchObject({ code: "INSTAGRAM_ACCOUNT_OWNED" });
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("keeps routing inactive when provider subscription fails", async () => {
    provider.subscribe.mockResolvedValue(false);
    await expect(new InstagramLoginService(provider).callback(context, "connector", "state", "code")).resolves.toMatchObject({ state: "NEEDS_ATTENTION", subscriptionVerified: false });
    expect(state.assetActivate).not.toHaveBeenCalled();
    expect(state.connectorUpdateMany.mock.calls.some(([input]) => (input as { data: { credentialStatus: string } }).data.credentialStatus === "NEEDS_ATTENTION")).toBe(true);
  });
  it("does not persist a token when code exchange fails", async () => {
    provider.exchange.mockRejectedValue(new Error("synthetic provider error"));
    await expect(new InstagramLoginService(provider).callback(context, "connector", "state", "code")).rejects.toThrow();
    expect(state.transaction).not.toHaveBeenCalled(); expect(state.encrypted).not.toHaveBeenCalled();
  });
  it("consumes redirect state and exchanges the code without a frontend callback", async () => {
    await expect(new InstagramLoginService(provider).callbackFromRedirect("state", "code")).resolves.toMatchObject({ state: "PRIVATE_TEST_READY" });
    expect(state.consumeRedirect).toHaveBeenCalledWith("INSTAGRAM_MESSAGES", "INSTAGRAM_LOGIN", "state", "/automation");
    expect(provider.exchange).toHaveBeenCalledWith("code");
  });
  it("does not let a stale callback claim credentials", async () => {
    state.connectorUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(new InstagramLoginService(provider).callbackFromRedirect("state", "code")).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    expect(provider.exchange).not.toHaveBeenCalled();
  });
  it("does not report ready when asset activation changes no row", async () => {
    state.assetActivate.mockResolvedValueOnce({ count: 0 });
    await expect(new InstagramLoginService(provider).callbackFromRedirect("state", "code")).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
  });
  it("cannot mark a new credential expired after a reconnect race", async () => {
    state.connector.mockResolvedValueOnce({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: new Date(Date.now() - 1000) });
    state.connectorUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(new InstagramLoginService(provider).refresh(context, "connector")).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    expect(state.connectorUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2 } });
  });
  it("keeps a temporary refresh failure distinct from revoked credentials", async () => {
    state.connector.mockResolvedValueOnce({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: new Date(Date.now() + 100000), credentialValidatedAt: new Date(Date.now() - 2 * 86400000) });
    provider.refresh.mockRejectedValueOnce(new Error("synthetic network error"));
    await expect(new InstagramLoginService(provider).refresh(context, "connector")).rejects.toMatchObject({ code: "INSTAGRAM_PROVIDER_FAILURE" });
    expect(state.connectorUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { accessTokenEncrypted: "old-ciphertext" }, data: { credentialStatus: "NEEDS_ATTENTION" } });
  });
  it("refreshes token material without advancing authorization generation or cutover", async () => {
    const expiry = new Date("2027-01-01T00:00:00.000Z");
    state.connector.mockResolvedValueOnce({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: expiry, credentialValidatedAt: new Date("2026-01-01T00:00:00.000Z") });
    provider.refresh.mockResolvedValueOnce({ token: "synthetic-new-token", expiresAt: new Date("2027-02-01T00:00:00.000Z") });
    await expect(new InstagramLoginService(provider).refresh(context, "connector")).resolves.toMatchObject({ refreshed: true });
    const update = state.connectorUpdateMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(update.where).toMatchObject({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY" });
    expect(update.data).toMatchObject({ accessTokenEncrypted: "ciphertext", credentialExpiresAt: new Date("2027-02-01T00:00:00.000Z"), credentialStatus: "PRIVATE_TEST_READY", credentialValidatedAt: expect.any(Date) as unknown as Date });
    expect(update.data).not.toHaveProperty("credentialsConfiguredAt");
    expect(state.assetActivate).not.toHaveBeenCalled();
  });
  it("cannot let a stale refresh overwrite a newer credential", async () => {
    state.connector.mockResolvedValueOnce({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: new Date("2027-01-01"), credentialValidatedAt: new Date("2026-01-01") });
    provider.refresh.mockResolvedValueOnce({ token: "synthetic-new-token", expiresAt: new Date("2027-02-01") });
    state.connectorUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(new InstagramLoginService(provider).refresh(context, "connector")).rejects.toMatchObject({ code: "INSTAGRAM_SETUP_CHANGED" });
    expect(state.connectorUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { accessTokenEncrypted: "old-ciphertext" } });
  });
  it("marks only the old invalid credential as reconnect required without moving generation", async () => {
    state.connector.mockResolvedValueOnce({ accessTokenEncrypted: "old-ciphertext", credentialKeyVersion: 2, credentialStatus: "PRIVATE_TEST_READY", credentialExpiresAt: new Date("2027-01-01"), credentialValidatedAt: new Date("2026-01-01") });
    provider.refresh.mockRejectedValueOnce(new AppError(409, "Synthetic invalid token", "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED"));
    await expect(new InstagramLoginService(provider).refresh(context, "connector")).rejects.toMatchObject({ code: "INSTAGRAM_RECONNECT_REQUIRED" });
    expect(state.connectorUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { accessTokenEncrypted: "old-ciphertext" }, data: { credentialStatus: "RECONNECT_REQUIRED" } });
    expect((state.connectorUpdateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data).not.toHaveProperty("credentialsConfiguredAt");
  });
});
