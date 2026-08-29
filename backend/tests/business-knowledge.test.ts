import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../src/database/prisma.js", () => ({
  prisma: {
    businessKnowledgeEntry: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      update: mocks.update,
      create: mocks.create,
    },
    $transaction: mocks.transaction,
  },
}));
import { BusinessKnowledgeService } from "../src/modules/business-knowledge/business-knowledge.service.js";

describe("business knowledge isolation and lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());
  it("retrieves approved knowledge only for the authenticated organization", async () => {
    mocks.findMany.mockResolvedValue([]);
    await new BusinessKnowledgeService().approvedForAgent("org-a");
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a", status: "APPROVED" },
      }),
    );
  });
  it("keeps only the latest approved version when titles conflict", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "new",
        organizationId: "org-a",
        category: "PRICING",
        title: "Monthly fee",
        content: "INR 2500",
        updatedAt: new Date("2026-08-28"),
      },
      {
        id: "old",
        organizationId: "org-a",
        category: "PRICING",
        title: "monthly fee",
        content: "INR 2000",
        updatedAt: new Date("2026-08-20"),
      },
    ]);
    const rows = await new BusinessKnowledgeService().approvedForAgent("org-a");
    expect(rows.map((row) => row.id)).toEqual(["new"]);
  });
  it("archives an earlier approved conflict when a draft is approved", async () => {
    const entry = {
      id: "draft",
      organizationId: "org-a",
      category: "FAQ",
      title: "Admissions",
    };
    mocks.findFirst.mockResolvedValue(entry);
    mocks.transaction.mockImplementation(
      (run: (tx: unknown) => unknown) =>
        Promise.resolve(run({
          businessKnowledgeEntry: {
            updateMany: mocks.updateMany,
            update: mocks.update,
          },
        })),
    );
    mocks.update.mockResolvedValue({ ...entry, status: "APPROVED" });
    await new BusinessKnowledgeService().approve("org-a", "user-a", "draft");
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          organizationId: "org-a",
          status: "APPROVED",
          id: { not: "draft" },
        }),
      }),
    );
  });
  it("returns 404 rather than touching another organization's entry", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      new BusinessKnowledgeService().archive("org-b", "user-b", "org-a-entry"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          id: "org-a-entry",
          organizationId: "org-b",
        }),
      }),
    );
  });
});
