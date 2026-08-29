import {
  type BusinessKnowledgeCategory,
  type BusinessKnowledgeStatus,
} from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { KnowledgeInput } from "./business-knowledge.validation.js";

export type ApprovedAgentKnowledge = {
  id: string;
  title: string;
  category: BusinessKnowledgeCategory;
  content: string;
  updatedAt: Date;
};

export class BusinessKnowledgeService {
  list(
    organizationId: string,
    query: { status?: string; category?: string; search?: string },
  ) {
    return prisma.businessKnowledgeEntry.findMany({
      where: {
        organizationId,
        ...(query.status
          ? { status: query.status as BusinessKnowledgeStatus }
          : {}),
        ...(query.category
          ? { category: query.category as BusinessKnowledgeCategory }
          : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                { content: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      include: { approvedBy: { select: { firstName: true, lastName: true } } },
    });
  }
  create(organizationId: string, userId: string, input: KnowledgeInput) {
    return prisma.businessKnowledgeEntry.create({
      data: {
        ...input,
        organizationId,
        createdById: userId,
        updatedById: userId,
      },
    });
  }
  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: KnowledgeInput,
  ) {
    const result = await prisma.businessKnowledgeEntry.updateMany({
      where: { id, organizationId, status: { not: "ARCHIVED" } },
      data: {
        ...input,
        status: "DRAFT",
        approvedAt: null,
        approvedById: null,
        updatedById: userId,
      },
    });
    if (result.count !== 1)
      throw new AppError(
        404,
        "Knowledge entry was not found.",
        "KNOWLEDGE_NOT_FOUND",
      );
    return prisma.businessKnowledgeEntry.findFirst({
      where: { id, organizationId },
    });
  }
  async approve(organizationId: string, userId: string, id: string) {
    const entry = await prisma.businessKnowledgeEntry.findFirst({
      where: { id, organizationId, status: "DRAFT" },
    });
    if (!entry)
      throw new AppError(
        404,
        "Draft knowledge entry was not found.",
        "KNOWLEDGE_NOT_FOUND",
      );
    return prisma.$transaction(async (tx) => {
      await tx.businessKnowledgeEntry.updateMany({
        where: {
          organizationId,
          category: entry.category,
          title: { equals: entry.title, mode: "insensitive" },
          status: "APPROVED",
          id: { not: id },
        },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedById: userId,
        },
      });
      return tx.businessKnowledgeEntry.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: userId,
          archivedAt: null,
          updatedById: userId,
        },
      });
    });
  }
  async archive(organizationId: string, userId: string, id: string) {
    const result = await prisma.businessKnowledgeEntry.updateMany({
      where: { id, organizationId, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedById: userId },
    });
    if (result.count !== 1)
      throw new AppError(
        404,
        "Knowledge entry was not found.",
        "KNOWLEDGE_NOT_FOUND",
      );
  }
  async approvedForAgent(
    organizationId: string,
  ): Promise<ApprovedAgentKnowledge[]> {
    const rows = await prisma.businessKnowledgeEntry.findMany({
      where: { organizationId, status: "APPROVED" },
      orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        const key = `${row.category}:${row.title.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ id, title, category, content, updatedAt }) => ({
        id,
        title,
        category,
        content,
        updatedAt,
      }));
  }
}
