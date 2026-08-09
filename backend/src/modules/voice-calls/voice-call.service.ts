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
      const call = await transaction.voiceCallJob.create({ data: { organizationId, agentId: agent.id, customerId: customer.id, followUpId: followUp?.id ?? null, phoneNumber: customer.phone, language: input.language, objective: input.objective, approvedScript: input.approvedScript, scheduledAt: input.scheduledAt, status: "PENDING_APPROVAL", createdById: actorUserId, updatedById: actorUserId }, include: callInclude });
      const dueAt = new Date(); dueAt.setHours(dueAt.getHours() + 24);
      const approval = await transaction.approvalRequest.create({ data: { organizationId, serviceCode: "AUTOMATION", actionCode: "VOICE_CALL_EXECUTE", title: `AI voice call to ${call.customer.displayName}`, description: input.objective, riskLevel: "HIGH", sourceType: "VOICE_CALL_JOB", sourceId: call.id, requestedById: actorUserId, dueAt, context: { customerId: call.customerId, phoneNumber: call.phoneNumber, language: call.language, scheduledAt: call.scheduledAt?.toISOString() ?? null } } });
      await transaction.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "AUTOMATION", actionCode: "VOICE_CALL_REQUESTED", sourceType: "VOICE_CALL_JOB", sourceId: call.id, summary: `Voice call prepared for ${call.customer.displayName} and submitted for approval.`, afterState: { callStatus: call.status, approvalId: approval.id } } });
      return call;
    });
  }

  async cancel(organizationId: string, actorUserId: string, id: string) {
    return prisma.$transaction(async (transaction) => {
      const call = await transaction.voiceCallJob.findFirst({ where: { id, organizationId, deletedAt: null, status: { in: ["PENDING_APPROVAL", "APPROVED", "QUEUED"] } } });
      if (!call) throw new AppError(404, "Cancelable voice call was not found.", "VOICE_CALL_NOT_FOUND");
      await transaction.voiceCallJob.update({ where: { id }, data: { status: "CANCELED", updatedById: actorUserId } });
      await transaction.approvalRequest.updateMany({ where: { organizationId, sourceType: "VOICE_CALL_JOB", sourceId: id, status: "PENDING" }, data: { status: "CANCELED", decidedById: actorUserId, decidedAt: new Date(), decisionNote: "Source voice call canceled." } });
      await transaction.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "AUTOMATION", actionCode: "VOICE_CALL_CANCELED", sourceType: "VOICE_CALL_JOB", sourceId: id, summary: "Voice call and its pending approval were canceled.", beforeState: { status: call.status }, afterState: { status: "CANCELED" } } });
    });
  }
}
