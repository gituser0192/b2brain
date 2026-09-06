import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  connector: vi.fn(), connectorRequired: vi.fn(), connectorUpdate: vi.fn(), stateCreate: vi.fn(), stateFindMany: vi.fn(), stateDeleteMany: vi.fn(), stateUpdateMany: vi.fn(), stateFind: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
}));
const tx = { integrationAuthorizationState: { create: database.stateCreate, findMany: database.stateFindMany, deleteMany: database.stateDeleteMany, updateMany: database.stateUpdateMany, findUniqueOrThrow: database.stateFind }, integrationConnector: { findFirstOrThrow: database.connectorRequired, update: database.connectorUpdate }, auditEvent: { create: database.audit } };
vi.mock("../src/database/prisma.js", () => ({ prisma: { integrationConnector: { findFirst: database.connector }, $transaction: database.transaction } }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({ encryptSecret: vi.fn(() => "encrypted"), decryptSecret: vi.fn(() => "[]") }));
import { MetaLeadConnectionService } from "../src/modules/automation-bridge/meta-lead-connection.service.js";
import { metaConnectionReturnPath } from "../src/modules/automation-bridge/meta-lead-connection.validation.js";
import { FakeMetaLeadConnectionProvider } from "../src/modules/automation-bridge/meta-lead-provider.js";

const context = { organizationId: crypto.randomUUID(), membershipId: crypto.randomUUID(), userId: crypto.randomUUID() }, connectorId = crypto.randomUUID();
type StoredState = { stateHash: string; expiresAt: Date; consumedAt?: Date };
let storedState: StoredState | undefined;
describe("Meta Lead authorization state", () => {
  beforeEach(() => { vi.clearAllMocks(); storedState = undefined; database.connector.mockResolvedValue({ id: connectorId, status: "DRAFT", metaPageId: null, appSecretEncrypted: null, configuration: {} }); database.stateFindMany.mockResolvedValue([]); database.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)); database.stateCreate.mockImplementation((input: { data: StoredState }) => { storedState = input.data; return Promise.resolve(input.data); }); database.audit.mockResolvedValue({}); });
  it("stores only a SHA-256 hash and uses a ten-minute single-use state", async () => { const result = await new MetaLeadConnectionService().start(context, connectorId, { returnPath: "/automation" }); const raw = new URL(result.authorizationUrl, "https://example.test").searchParams.get("meta_state")!; expect(storedState?.stateHash).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(storedState)).not.toContain(raw); expect((storedState?.expiresAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(9 * 60_000); expect(storedState?.consumedAt).toBeUndefined(); });
  it("atomically rejects expired, replayed or mismatched callbacks with one safe error", async () => { database.stateUpdateMany.mockResolvedValue({ count: 0 }); await expect(new MetaLeadConnectionService().callback(context, connectorId, { state: "x".repeat(43), code: "fake-approved" })).rejects.toMatchObject({ code: "META_AUTHORIZATION_STATE_INVALID" }); expect(database.stateUpdateMany).toHaveBeenCalledOnce(); });
  it("allows exactly one concurrent callback claim", async () => { let claimed = false; database.stateUpdateMany.mockImplementation(() => Promise.resolve({ count: claimed ? 0 : (claimed = true, 1) })); database.stateFind.mockResolvedValue({ returnPath: "/automation" }); database.connectorRequired.mockResolvedValue({ configuration: {} }); const service = new MetaLeadConnectionService(); const input = { state: "y".repeat(43), code: "fake-approved" }; const outcomes = await Promise.allSettled([service.callback(context, connectorId, input), service.callback(context, connectorId, input)]); expect(outcomes.filter(item => item.status === "fulfilled")).toHaveLength(1); });
  it("rejects unsafe return paths", () => { expect(() => metaConnectionReturnPath.parse("https://evil.example/callback")).toThrow(); expect(() => metaConnectionReturnPath.parse("//evil.example")).toThrow(); });
  it("keeps the deterministic provider synthetic and offline", async () => { const fetcher = vi.spyOn(globalThis, "fetch"); const provider = new FakeMetaLeadConnectionProvider(); expect(provider.mode).toBe("TEST"); await expect(provider.exchangeCode("fake-approved")).resolves.toMatchObject({ pages: [{ name: "Synthetic Test Page" }] }); expect(fetcher).not.toHaveBeenCalled(); });
});
