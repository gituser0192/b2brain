import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateVoiceCallInput } from "./voice-call.validation.js";

const callInclude = {
  customer: { select: { id: true, displayName: true, phone: true } },
  agent: { select: { id: true, name: true, status: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export class VoiceCallService {
  list(organizationId: string) {
    return prisma.voiceCallJob.findMany({ where: { organizationId, deletedAt: null }, include: callInclude, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async create(organizationId: string, actorUserId: string, input: CreateVoiceCallInput) {
    return prisma.$transaction(async (transaction) => {
      const [agent, customer, followUp] = await Promise.all([
        transaction.agentDefinition.findFirst({ where: { id: input.agentId, organizationId, deletedAt: null, status: "ACTIVE" } }),
        transaction.customer.findFirst({ where: { id: input.customerId, organizationId, deletedAt: null }, select: { id: true, phone: true } }),
        input.followUpId ? transaction.customerFollowUp.findFirst({ where: { id: input.followUpId, organizationId, customerId: input.customerId, deletedAt: null }, select: { id: true } }) : null,
      ]);
      if (!agent) throw new AppError(400, "Select an active CRM agent.", "ACTIVE_AGENT_REQUIRED");
      const actions = Array.isArray(agent.allowedActions) ? agent.allowedActions : [];
      if (!actions.includes("VOICE_CALL_PLAN") || !actions.includes("VOICE_CALL_REQUEST")) throw new AppError(403, "This agent is not allowed to prepare voice calls.", "VOICE_ACTION_NOT_ALLOWED");
      if (!customer) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
      if (!customer.phone) throw new AppError(400, "Add a phone number to the customer before planning a call.", "CUSTOMER_PHONE_REQUIRED");
      if (input.followUpId && !followUp) throw new AppError(404, "Follow-up was not found for this customer.", "FOLLOW_UP_NOT_FOUND");
      return transaction.voiceCallJob.create({ data: { organizationId, agentId: agent.id, customerId: customer.id, followUpId: followUp?.id ?? null, phoneNumber: customer.phone, language: input.language, objective: input.objective, approvedScript: input.approvedScript, scheduledAt: input.scheduledAt, status: "PENDING_APPROVAL", createdById: actorUserId, updatedById: actorUserId }, include: callInclude });
    });
  }

  async approve(organizationId: string, actorUserId: string, id: string) {
    const result = await prisma.voiceCallJob.updateMany({ where: { id, organizationId, deletedAt: null, status: "PENDING_APPROVAL" }, data: { status: "APPROVED", approvedById: actorUserId, approvedAt: new Date(), updatedById: actorUserId } });
    if (result.count !== 1) throw new AppError(404, "Pending voice call was not found.", "VOICE_CALL_NOT_FOUND");
  }

  async cancel(organizationId: string, actorUserId: string, id: string) {
    const result = await prisma.voiceCallJob.updateMany({ where: { id, organizationId, deletedAt: null, status: { in: ["PENDING_APPROVAL", "APPROVED", "QUEUED"] } }, data: { status: "CANCELED", updatedById: actorUserId } });
    if (result.count !== 1) throw new AppError(404, "Cancelable voice call was not found.", "VOICE_CALL_NOT_FOUND");
  }
}
