import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ApprovalQuery, AuditQuery, DecisionInput } from "./governance.validation.js";

const person = { id: true, firstName: true, lastName: true, email: true } as const;
export class GovernanceService {
  async approvals(organizationId: string, query: ApprovalQuery) {
    await prisma.approvalRequest.updateMany({ where: { organizationId, status: "PENDING", dueAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
    const where = { organizationId, ...(query.status ? { status: query.status } : {}), ...(query.serviceCode ? { serviceCode: query.serviceCode } : {}) };
    const [items, pending, overdue] = await Promise.all([
      prisma.approvalRequest.findMany({ where, include: { requestedBy: { select: person }, decidedBy: { select: person } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: query.limit }),
      prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
      prisma.approvalRequest.count({ where: { organizationId, status: "PENDING", dueAt: { lt: new Date() } } }),
    ]);
    return { items, metrics: { pending, overdue } };
  }
  audit(organizationId: string, query: AuditQuery) { return prisma.auditEvent.findMany({ where: { organizationId, ...(query.serviceCode ? { serviceCode: query.serviceCode } : {}), ...(query.actionCode ? { actionCode: query.actionCode } : {}) }, include: { actorUser: { select: person } }, orderBy: { createdAt: "desc" }, take: query.limit }); }
  async decide(organizationId: string, actorUserId: string, id: string, input: DecisionInput) {
    return prisma.$transaction(async (transaction) => {
      const approval = await transaction.approvalRequest.findFirst({ where: { id, organizationId, status: "PENDING" } });
      if (!approval) throw new AppError(404, "Pending approval was not found.", "APPROVAL_NOT_FOUND");
      if (approval.requestedById === actorUserId) throw new AppError(403, "The requester cannot decide their own approval.", "SELF_APPROVAL_FORBIDDEN");
      const status = input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "RETURNED";
      if (approval.sourceType === "VOICE_CALL_JOB") {
        const callStatus = input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "CANCELED" : "DRAFT";
        const result = await transaction.voiceCallJob.updateMany({ where: { id: approval.sourceId, organizationId, deletedAt: null, status: "PENDING_APPROVAL" }, data: { status: callStatus, approvedById: input.decision === "APPROVE" ? actorUserId : null, approvedAt: input.decision === "APPROVE" ? new Date() : null, updatedById: actorUserId } });
        if (result.count !== 1) throw new AppError(409, "The linked voice call is no longer awaiting approval.", "APPROVAL_SOURCE_CHANGED");
      } else throw new AppError(400, "This approval action is not supported yet.", "UNSUPPORTED_APPROVAL_SOURCE");
      const decided = await transaction.approvalRequest.update({ where: { id }, data: { status, decisionNote: input.note, decidedById: actorUserId, decidedAt: new Date() } });
      await transaction.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: approval.serviceCode, actionCode: `APPROVAL_${input.decision}`, sourceType: "APPROVAL_REQUEST", sourceId: approval.id, summary: `${input.decision.toLowerCase()} decision recorded for ${approval.title}.`, beforeState: { status: approval.status }, afterState: { status }, metadata: input.note ? { note: input.note } : Prisma.JsonNull } });
      return decided;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
