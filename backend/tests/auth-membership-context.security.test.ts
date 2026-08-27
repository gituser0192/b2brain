import { describe, expect, it, vi } from "vitest";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";

describe("authenticated membership context", () => {
  it("selects only an active membership with an active user and organization", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new AuthRepository({ organizationMembership: { findFirst } } as never);
    await repository.findActiveContextForUser("user-a");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-a",
        status: "ACTIVE",
        user: { status: "ACTIVE", deletedAt: null },
        organization: { status: "ACTIVE", deletedAt: null },
      },
      orderBy: { joinedAt: "asc" },
    }));
  });

  it("reloads a token/session membership using the same active boundaries", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new AuthRepository({ organizationMembership: { findFirst } } as never);
    await repository.findActiveContextByMembership("membership-a");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "membership-a",
        status: "ACTIVE",
        user: { status: "ACTIVE", deletedAt: null },
        organization: { status: "ACTIVE", deletedAt: null },
      },
    }));
  });
});
