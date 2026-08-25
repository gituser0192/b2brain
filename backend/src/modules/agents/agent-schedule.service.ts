import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { logger } from "../../config/logger.js";
import { AgentService } from "./agent.service.js";
import { nextDailyOccurrence } from "./agent-schedule.engine.js";
import type { AgentScheduleInput } from "./agent.validation.js";

export class AgentScheduleService {
  private readonly agents = new AgentService();
  async get(organizationId: string, agentId: string) { return prisma.agentSchedule.findFirst({ where: { organizationId, agentId }, select: { id: true, enabled: true, timezone: true, localTime: true, maxInvoicesPerRun: true, nextRunAt: true, lastRunAt: true, lastStatus: true, lastError: true } }); }
  async save(organizationId: string, actorUserId: string, agentId: string, input: AgentScheduleInput) {
    const agent = await prisma.agentDefinition.findFirst({ where: { id: agentId, organizationId, supportedService: "FINANCE", deletedAt: null } });
    if (!agent) throw new AppError(404, "Finance collection agent not found.", "AGENT_NOT_FOUND");
    if (!agent.requiresApproval) throw new AppError(409, "Scheduled collection requires human approval.", "SCHEDULE_APPROVAL_REQUIRED");
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(new Date()); } catch { throw new AppError(400, "Select a valid IANA timezone.", "INVALID_TIMEZONE"); }
    const nextRunAt = nextDailyOccurrence(input.timezone, input.localTime);
    return prisma.agentSchedule.upsert({ where: { organizationId_agentId: { organizationId, agentId } }, update: { ...input, nextRunAt, lockedAt: null, lastError: null, updatedById: actorUserId }, create: { ...input, organizationId, agentId, nextRunAt, createdById: actorUserId, updatedById: actorUserId }, select: { id: true, enabled: true, timezone: true, localTime: true, maxInvoicesPerRun: true, nextRunAt: true, lastRunAt: true, lastStatus: true, lastError: true } });
  }
  async execute(scheduleId: string) {
    const schedule = await prisma.agentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        agent: true,
        organization: {
          select: {
            status: true,
            organizationServices: {
              where: { deletedAt: null, status: "ENABLED", service: { code: { in: ["AUTOMATION", "FINANCE"] } } },
              select: { service: { select: { code: true } } },
            },
          },
        },
      },
    });
    if (!schedule || !schedule.enabled) return;
    const codes = new Set(schedule.organization.organizationServices.map((item) => item.service.code));
    if (schedule.organization.status !== "ACTIVE" || !codes.has("AUTOMATION") || !codes.has("FINANCE") || schedule.agent.status !== "ACTIVE") throw new Error("Organization, services, or collection agent is not active.");
    let prepared = 0;
    for (let index = 0; index < schedule.maxInvoicesPerRun; index += 1) {
      const result = await this.agents.runCollection(schedule.organizationId, schedule.createdById, schedule.agentId, null, "SCHEDULED_COLLECTION_SCAN");
      if (!result.matched) break;
      prepared += 1;
    }
    await prisma.agentSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date(), lastStatus: prepared ? `PREPARED_${prepared}` : "NO_ACTION", lastError: null, lockedAt: null, nextRunAt: nextDailyOccurrence(schedule.timezone, schedule.localTime) } });
  }
  async tick() {
    const now = new Date(), stale = new Date(now.getTime() - 15 * 60_000);
    const due = await prisma.agentSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: stale } }] }, select: { id: true }, take: 25, orderBy: { nextRunAt: "asc" } });
    for (const item of due) {
      const claimed = await prisma.agentSchedule.updateMany({ where: { id: item.id, enabled: true, nextRunAt: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: stale } }] }, data: { lockedAt: now } });
      if (!claimed.count) continue;
      try { await this.execute(item.id); } catch (error) {
        const message = error instanceof Error ? error.message : "Scheduled collection failed.";
        logger.error({ err: error, scheduleId: item.id }, "Collection schedule failed");
        const current = await prisma.agentSchedule.findUnique({ where: { id: item.id }, select: { timezone: true, localTime: true } });
        if (current) await prisma.agentSchedule.update({ where: { id: item.id }, data: { lastRunAt: now, lastStatus: "FAILED", lastError: message.slice(0, 1000), lockedAt: null, nextRunAt: nextDailyOccurrence(current.timezone, current.localTime) } });
      }
    }
  }
}

export function startAgentScheduler() {
  const service = new AgentScheduleService();
  const timer = setInterval(() => void service.tick().catch((error) => logger.error({ err: error }, "Agent scheduler tick failed")), 60_000);
  timer.unref();
  void service.tick().catch((error) => logger.error({ err: error }, "Initial agent scheduler tick failed"));
  return () => clearInterval(timer);
}
