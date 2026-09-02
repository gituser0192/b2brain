import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "../src/middleware/auth.js";

function request(mode: "READ_ONLY" | "READ_WRITE"): Request {
  return { auth: { userId: "u", organizationId: "o", membershipId: "m", roleCode: "ORGANIZATION_MEMBER", permissions: ["CRM_VIEW", "CRM_CREATE"], isPlatformAdmin: false, serviceAccessMode: mode } } as Request;
}

describe("member service access modes", () => {
  it("allows view permissions in read-only mode", () => {
    const next = vi.fn() as NextFunction;
    requirePermission("CRM_VIEW")(request("READ_ONLY"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
  it("blocks write permissions in read-only mode", () => {
    const next = vi.fn();
    requirePermission("CRM_CREATE")(request("READ_ONLY"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "MEMBER_SERVICE_READ_ONLY", statusCode: 403 }));
  });
  it("allows role-authorized writes in read-write mode", () => {
    const next = vi.fn() as NextFunction;
    requirePermission("CRM_CREATE")(request("READ_WRITE"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
