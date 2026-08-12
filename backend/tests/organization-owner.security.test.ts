import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireOrganizationOwner } from "../src/middleware/auth.js";

function request(roleCode: string): Request {
  return { auth: { userId: "user-1", organizationId: "org-1", membershipId: "membership-1", roleCode, permissions: ["MEMBERSHIP_MANAGE", "ROLE_MANAGE", "ORGANIZATION_UPDATE"], isPlatformAdmin: false } } as Request;
}

describe("organization owner boundary", () => {
  it("rejects a non-owner even when their role has management permissions", () => {
    const next = vi.fn() as NextFunction;
    requireOrganizationOwner(request("ORGANIZATION_ADMIN"), {} as Response, next);
    const error = next.mock.calls[0]?.[0] as { statusCode: number; code: string };
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("ORGANIZATION_OWNER_REQUIRED");
  });

  it("allows the organization owner", () => {
    const next = vi.fn() as NextFunction;
    requireOrganizationOwner(request("ORGANIZATION_OWNER"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
