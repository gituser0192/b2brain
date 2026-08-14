import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireProviderSensitiveCompletion } from "../src/middleware/auth.js";

function request(status: string, permissions: string[] = [], isPlatformAdmin = false) {
  return { body: { status }, auth: { userId: crypto.randomUUID(), organizationId: crypto.randomUUID(), membershipId: crypto.randomUUID(), roleCode: "B2_SUPPORT_AGENT", permissions, isPlatformAdmin } } as Request;
}

describe("provider service desk approval security", () => {
  it("allows ordinary progress without sensitive approval", () => {
    const next = vi.fn() as NextFunction;
    requireProviderSensitiveCompletion(request("IN_PROGRESS"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks completion without approval authority", () => {
    const next = vi.fn() as NextFunction;
    requireProviderSensitiveCompletion(request("COMPLETED", ["PROVIDER_REQUEST_MANAGE"]), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: "PROVIDER_APPROVAL_REQUIRED" }));
  });

  it("allows an authorized manager to complete work", () => {
    const next = vi.fn() as NextFunction;
    requireProviderSensitiveCompletion(request("COMPLETED", ["PROVIDER_SENSITIVE_APPROVE"]), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
