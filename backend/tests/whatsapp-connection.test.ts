/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const database = vi.hoisted(() => ({
  connector: vi.fn(), connectorUpdate: vi.fn(), stateCreate: vi.fn(), stateUpdateMany: vi.fn(),
  stateFind: vi.fn(), stateInvalidate: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
}));
const cryptoStore = vi.hoisted(() => ({ encrypted: "", plaintext: "" }));
const tx = {
  integrationAuthorizationState: { create: database.stateCreate, updateMany: database.stateUpdateMany, findUniqueOrThrow: database.stateFind },
  integrationConnector: { findFirst: database.connector, update: database.connectorUpdate },
  auditEvent: { create: database.audit },
};
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  integrationConnector: { findFirst: database.connector },
  integrationAuthorizationState: { updateMany: database.stateInvalidate },
  auditEvent: { create: database.audit },
  $transaction: database.transaction,
} }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({
  encryptSecret: vi.fn((value: string) => { cryptoStore.plaintext = value; cryptoStore.encrypted = `encrypted:${value.length}`; return cryptoStore.encrypted; }),
  decryptSecret: vi.fn(() => cryptoStore.plaintext),
}));

import { WhatsappConnectionService } from "../src/modules/automation-bridge/whatsapp-connection.service.js";
import { FakeWhatsappConnectionProvider, WHATSAPP_REQUIRED_SCOPES } from "../src/modules/automation-bridge/whatsapp-connection.provider.js";
import { whatsappConnectionReturnPath, whatsappNumberSelectionSchema } from "../src/modules/automation-bridge/whatsapp-connection.validation.js";

const context = { organizationId: crypto.randomUUID(), membershipId: crypto.randomUUID(), userId: crypto.randomUUID() };
const connectorId = crypto.randomUUID();
const baseConnector = { id: connectorId, status: "DRAFT", whatsappPhoneNumberId: null, whatsappBusinessAccountId: null, accessTokenEncrypted: null, appSecretEncrypted: null, configuration: {} };

describe("WhatsApp Business Test Mode connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cryptoStore.encrypted = "";
    cryptoStore.plaintext = "";
    database.connector.mockResolvedValue(baseConnector);
    database.connectorUpdate.mockResolvedValue(baseConnector);
    database.audit.mockResolvedValue({});
    database.stateInvalidate.mockResolvedValue({ count: 1 });
    database.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("stores only a ten-minute SHA-256 state bound to the authenticated context", async () => {
    let stored: Record<string, unknown> = {};
    database.stateCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => { stored = data; return Promise.resolve(data); });
    const result = await new WhatsappConnectionService().start(context, connectorId, { returnPath: "/automation" });
    const raw = new URL(result.authorizationUrl, "https://test.invalid").searchParams.get("wa_state")!;
    expect(stored).toMatchObject({ provider: "META_WHATSAPP_TEST", ...context, connectorId, returnPath: "/automation" });
    expect(stored.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(raw);
    expect((stored.expiresAt as Date).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    expect(database.connector).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: context.organizationId, type: "WHATSAPP", provider: "META_WHATSAPP_CLOUD", deletedAt: null }) }));
  });

  it("rejects unsafe return paths and preserves provider IDs as bounded strings", () => {
    expect(() => whatsappConnectionReturnPath.parse("https://evil.invalid/callback")).toThrow();
    expect(() => whatsappConnectionReturnPath.parse("//evil.invalid")).toThrow();
    const id = "710000000000001";
    expect(whatsappNumberSelectionSchema.parse({ phoneNumberId: id }).phoneNumberId).toBe(id);
    expect(() => whatsappNumberSelectionSchema.parse({ phoneNumberId: "+91 99999 00101" })).toThrow();
  });

  it("atomically rejects expired, replayed, concurrent or substituted callbacks", async () => {
    database.stateUpdateMany.mockResolvedValue({ count: 0 });
    await expect(new WhatsappConnectionService().callback(context, connectorId, { state: "x".repeat(43), code: "fake-approved" })).rejects.toMatchObject({ code: "WHATSAPP_AUTHORIZATION_STATE_INVALID" });
    expect(database.stateUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ...context, connectorId, consumedAt: null, expiresAt: { gt: expect.any(Date) } }) }));
    let claimed = false;
    database.stateUpdateMany.mockImplementation(() => Promise.resolve({ count: claimed ? 0 : (claimed = true, 1) }));
    database.stateFind.mockResolvedValue({ returnPath: "/automation" });
    const outcomes = await Promise.allSettled([1, 2].map(() => new WhatsappConnectionService().callback(context, connectorId, { state: "y".repeat(43), code: "fake-approved" })));
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  });

  it("uses an offline bounded provider with generated temporary credentials", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const provider = new FakeWhatsappConnectionProvider();
    const result = await provider.exchange("fake-approved");
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]?.permissions).toEqual(expect.arrayContaining([...WHATSAPP_REQUIRED_SCOPES]));
    expect(result.accounts[0]?.phoneNumbers[0]?.maskedDisplayNumber).not.toMatch(/\d{5,}/);
    expect(result.accounts[0]?.token).not.toContain("synthetic-whatsapp-token");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(provider.exchange("fake-timeout")).rejects.toMatchObject({ code: "WHATSAPP_TEST_PROVIDER_TIMEOUT" });
    await expect(provider.exchange("fake-malformed")).rejects.toMatchObject({ code: "WHATSAPP_TEST_PROVIDER_INVALID" });
  });

  it("accepts only provider-returned WABAs and filters numbers to that account", async () => {
    const provider = new FakeWhatsappConnectionProvider();
    const exchanged = await provider.exchange("fake-approved");
    const safeAccounts = exchanged.accounts.map(({ id, verifiedBusinessName, permissions, phoneNumbers }) => ({ id, verifiedBusinessName, permissions, phoneNumbers }));
    database.connector.mockResolvedValue({ ...baseConnector, appSecretEncrypted: "encrypted", configuration: { whatsappAuthorizedAccounts: safeAccounts } });
    await expect(new WhatsappConnectionService(provider).selectAccount(context, connectorId, { wabaId: "799999999999999" })).rejects.toMatchObject({ code: "WHATSAPP_ACCOUNT_UNAVAILABLE" });
    const selected = await new WhatsappConnectionService(provider).selectAccount(context, connectorId, { wabaId: safeAccounts[0]!.id });
    expect(selected.phoneNumbers).toEqual(safeAccounts[0]!.phoneNumbers);
    expect(selected.phoneNumbers).not.toEqual(expect.arrayContaining(safeAccounts[1]!.phoneNumbers));
  });

  it("rejects arbitrary numbers and missing required scopes", async () => {
    const provider = new FakeWhatsappConnectionProvider();
    const exchanged = await provider.exchange("fake-approved");
    const safeAccounts = exchanged.accounts.map(({ id, verifiedBusinessName, permissions, phoneNumbers }) => ({ id, verifiedBusinessName, permissions, phoneNumbers }));
    const account = safeAccounts[0]!;
    database.connector.mockResolvedValue({ ...baseConnector, whatsappBusinessAccountId: account.id, appSecretEncrypted: "encrypted", configuration: { whatsappAuthorizedAccounts: safeAccounts, whatsappScopesValid: true } });
    await expect(new WhatsappConnectionService(provider).selectNumber(context, connectorId, { phoneNumberId: "799999999999999" })).rejects.toMatchObject({ code: "WHATSAPP_NUMBER_UNAVAILABLE" });
    database.connector.mockResolvedValue({ ...baseConnector, whatsappBusinessAccountId: account.id, appSecretEncrypted: "encrypted", configuration: { whatsappAuthorizedAccounts: safeAccounts, whatsappScopesValid: false } });
    await expect(new WhatsappConnectionService(provider).selectNumber(context, connectorId, { phoneNumberId: account.phoneNumbers[0]!.id })).rejects.toMatchObject({ code: "WHATSAPP_PERMISSIONS_MISSING" });
  });

  it("encrypts temporary credentials, never returns them, and safely handles unique conflicts", async () => {
    const provider = new FakeWhatsappConnectionProvider();
    const exchanged = await provider.exchange("fake-approved");
    const safeAccounts = exchanged.accounts.map(({ id, verifiedBusinessName, permissions, phoneNumbers }) => ({ id, verifiedBusinessName, permissions, phoneNumbers }));
    database.stateUpdateMany.mockResolvedValue({ count: 1 });
    database.stateFind.mockResolvedValue({ returnPath: "/automation" });
    const callback = await new WhatsappConnectionService(provider).callback(context, connectorId, { state: "z".repeat(43), code: "fake-approved" });
    expect(JSON.stringify(callback)).not.toContain(exchanged.accounts[0]!.token);
    expect(database.connectorUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ appSecretEncrypted: expect.stringMatching(/^encrypted:/) }) }));
    expect(JSON.stringify(database.audit.mock.calls)).not.toContain(exchanged.accounts[0]!.token);

    const account = safeAccounts[0]!;
    cryptoStore.plaintext = JSON.stringify([{ id: account.id, token: "runtime-only" }]);
    database.connector.mockResolvedValue({ ...baseConnector, whatsappBusinessAccountId: account.id, appSecretEncrypted: "encrypted", configuration: { whatsappAuthorizedAccounts: safeAccounts, whatsappScopesValid: true } });
    database.connectorUpdate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2002", clientVersion: "6" }));
    await expect(new WhatsappConnectionService(provider).selectNumber(context, connectorId, { phoneNumberId: account.phoneNumbers[0]!.id })).rejects.toMatchObject({ code: "WHATSAPP_NUMBER_ALREADY_CONNECTED" });
  });

  it("runs a non-mutating offline readiness test and keeps the connector DRAFT", async () => {
    const provider = new FakeWhatsappConnectionProvider();
    const exchanged = await provider.exchange("fake-approved");
    const account = exchanged.accounts[0]!;
    database.connector.mockResolvedValue({ ...baseConnector, whatsappBusinessAccountId: account.id, whatsappPhoneNumberId: account.phoneNumbers[0]!.id, accessTokenEncrypted: "encrypted", configuration: { whatsappScopesValid: true } });
    const fetcher = vi.spyOn(globalThis, "fetch");
    const result = await new WhatsappConnectionService(provider).test(context, connectorId);
    expect(result).toEqual({ ready: true, mode: "TEST", externalActionPerformed: false, messageSent: false, customerCreated: false, inquiryCreated: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(database.connectorUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT" }) }));
  });

  it("disconnects without provider contact and clears only connector authorization state", async () => {
    database.connector.mockResolvedValue({ ...baseConnector, whatsappPhoneNumberId: "710000000000001", whatsappBusinessAccountId: "700000000000001", accessTokenEncrypted: "encrypted", appSecretEncrypted: "encrypted", configuration: { whatsappSetupState: "READY_TEST" } });
    const result = await new WhatsappConnectionService().disconnect(context, connectorId);
    expect(result).toEqual({ disconnected: true, providerContacted: false, historyPreserved: true });
    expect(database.connectorUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", whatsappPhoneNumberId: null, whatsappBusinessAccountId: null, accessTokenEncrypted: null, appSecretEncrypted: null }) }));
    expect(database.stateUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: context.organizationId, connectorId, consumedAt: null }) }));
  });

  it("reconnect invalidates incomplete authorization and creates a fresh state", async () => {
    const hashes: string[] = [];
    database.stateCreate.mockImplementation(({ data }: { data: { stateHash: string } }) => { hashes.push(data.stateHash); return Promise.resolve(data); });
    const service = new WhatsappConnectionService();
    await service.reconnect(context, connectorId);
    await service.reconnect(context, connectorId);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(database.stateUpdateMany).toHaveBeenCalledTimes(2);
  });
});
