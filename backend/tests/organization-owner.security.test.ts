import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireOrganizationOwner } from "../src/middleware/auth.js";

function request(roleCode: string): Request {
  return { auth: { userId: "user-1", organizationId: "org-1", membershipId: "membership-1", roleCode, permissions: ["MEMBERSHIP_MANAGE", "ROLE_MANAGE", "ORGANIZATION_UPDATE"], isPlatformAdmin: false } } as Request;
}

describe("organization owner boundary", () => {
  it("rejects a non-owner even when their role has management permissions", () => {
    const next = vi.fn();
    requireOrganizationOwner(request("ORGANIZATION_ADMIN"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "ORGANIZATION_OWNER_REQUIRED" }));
  });

  it("allows the organization owner", () => {
    const next = vi.fn() as NextFunction;
    requireOrganizationOwner(request("ORGANIZATION_OWNER"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
