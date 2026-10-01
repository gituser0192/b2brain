import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ access: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn(), help: vi.fn() }));
vi.mock("../src/middleware/auth.js", () => ({ verifyServiceAccess: calls.access }));
vi.mock("../src/modules/service-requests/service-request.service.js", () => ({ ServiceRequestService: class { create = calls.help; } }));
vi.mock("../src/database/prisma.js", () => ({ prisma: {
  integrationConnector: { findFirst: calls.find, updateMany: calls.update, create: calls.create },
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
