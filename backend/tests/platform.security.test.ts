import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requirePlatformAdmin } from "../src/middleware/auth.js";
import { createPlatformInvitationSchema, organizationServiceAssignmentSchema } from "../src/modules/platform/platform.validation.js";
import { PlatformService } from "../src/modules/platform/platform.service.js";
import type { PlatformRepository } from "../src/modules/platform/platform.repository.js";

function request(isPlatformAdmin: boolean) {
  return {
    auth: {
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      membershipId: crypto.randomUUID(),
      roleCode: "ORGANIZATION_OWNER",
      permissions: [],
      isPlatformAdmin,
    },
  } as Request;
}

describe("platform administration security", () => {
  it("rejects an authenticated organization user without platform status", () => {
    const next = vi.fn() as NextFunction;
    requirePlatformAdmin(request(false), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "PLATFORM_ADMIN_REQUIRED" }));
  });

  it("allows a verified platform administrator", () => {
    const next = vi.fn() as NextFunction;
    requirePlatformAdmin(request(true), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("accepts only the service decision and rejects client-owned IDs", () => {
    expect(organizationServiceAssignmentSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(() => organizationServiceAssignmentSchema.parse({ enabled: true, organizationId: crypto.randomUUID(), updatedById: crypto.randomUUID() })).toThrow();
  });

  it("normalizes approved emails and rejects privilege fields", () => {
    expect(createPlatformInvitationSchema.parse({ email: " OWNER@EXAMPLE.COM ", organizationName: " Acme " })).toEqual({ email: "owner@example.com", organizationName: "Acme" });
    expect(() => createPlatformInvitationSchema.parse({ email: "owner@example.com", organizationName: "Acme", isPlatformAdmin: true })).toThrow();
  });

  it("protects an organization containing a platform administrator", async () => {
    const setAccessMock = vi.fn();
    const removeMock = vi.fn();
    const repository = {
      findOrganization: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      organizationHasPlatformAdmin: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      setOrganizationAccess: setAccessMock,
      removeOrganization: removeMock,
    } as unknown as PlatformRepository;
    const service = new PlatformService(repository);
    await expect(service.setOrganizationAccess(crypto.randomUUID(), { status: "SUSPENDED" })).rejects.toMatchObject({ code: "SUPER_ADMIN_ORGANIZATION_PROTECTED" });
    await expect(service.removeOrganization(crypto.randomUUID())).rejects.toMatchObject({ code: "SUPER_ADMIN_ORGANIZATION_PROTECTED" });
    expect(setAccessMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });
});
