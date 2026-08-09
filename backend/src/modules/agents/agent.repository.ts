import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import type { AgentInput } from "./agent.validation.js";

const actor = { id: true, firstName: true, lastName: true } as const;
export class AgentRepository {
  list(organizationId: string) { return prisma.agentDefinition.findMany({ where: { organizationId, deletedAt: null }, include: { createdBy: { select: actor }, updatedBy: { select: actor }, _count: { select: { runs: true } } }, orderBy: { createdAt: "desc" } }); }
  find(organizationId: string, id: string) { return prisma.agentDefinition.findFirst({ where: { id, organizationId, deletedAt: null }, include: { createdBy: { select: actor }, updatedBy: { select: actor }, _count: { select: { runs: true } } } }); }
  create(organizationId: string, actorUserId: string, input: AgentInput) { return prisma.agentDefinition.create({ data: { ...input, allowedActions: input.allowedActions as Prisma.InputJsonValue, organizationId, createdById: actorUserId, updatedById: actorUserId }, include: { createdBy: { select: actor }, updatedBy: { select: actor }, _count: { select: { runs: true } } } }); }
  update(organizationId: string, id: string, actorUserId: string, input: AgentInput) { return prisma.agentDefinition.updateMany({ where: { id, organizationId, deletedAt: null }, data: { ...input, allowedActions: input.allowedActions as Prisma.InputJsonValue, updatedById: actorUserId } }); }
  archive(organizationId: string, id: string, actorUserId: string) { return prisma.agentDefinition.updateMany({ where: { id, organizationId, deletedAt: null }, data: { status: "ARCHIVED", deletedAt: new Date(), updatedById: actorUserId } }); }
  runs(organizationId: string, agentId: string) { return prisma.agentRun.findMany({ where: { organizationId, agentId }, orderBy: { createdAt: "desc" }, take: 100 }); }
}
