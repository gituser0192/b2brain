import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  create: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({ prisma: { integrationConnector: database } }));
vi.mock("../src/modules/automation-bridge/bridge.crypto.js", () => ({ encryptSecret: vi.fn((value: string) => `encrypted:${value.length}`) }));

import { BridgeService } from "../src/modules/automation-bridge/bridge.service.js";

const org = "00000000-0000-4000-8000-00000000000a";
const user = "20000000-0000-4000-8000-00000000000a";
const connector = { id: "10000000-0000-4000-8000-00000000000a", webhookKey: "public-id" };

describe("website connector signing credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.create.mockResolvedValue(connector);
    database.findFirst.mockResolvedValue({ id: connector.id });
    database.update.mockResolvedValue(connector);
  });

  it("encrypts a connector-specific secret and returns plaintext only at creation", async () => {
    const result = await new BridgeService().createConnector(org, user, {
      name: "Synthetic Website", type: "WEBSITE", provider: "SERVER_WEBHOOK",
      externalAccountRef: null, status: "ACTIVE", mode: "MANUAL_APPROVAL",
    });
    const data = (database.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ organizationId: org, appSecretEncrypted: "encrypted:48" });
    expect(data).not.toHaveProperty("webhookSecret");
    expect(result.webhookSecret).toHaveLength(48);
    expect(JSON.stringify(data)).not.toContain(result.webhookSecret);
  });

  it("rotates only an organization-scoped website connector and returns the new secret once", async () => {
    const result = await new BridgeService().rotateWebsiteSecret(org, user, connector.id);
    expect(database.findFirst).toHaveBeenCalledWith({
      where: { id: connector.id, organizationId: org, type: "WEBSITE", deletedAt: null }, select: { id: true },
    });
    const data = (database.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ appSecretEncrypted: "encrypted:64", updatedById: user });
    expect(result.webhookSecret).toHaveLength(64);
    expect(JSON.stringify(data)).not.toContain(result.webhookSecret);
  });
});
