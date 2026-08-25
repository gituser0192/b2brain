import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  ApprovalQuery,
  AuditQuery,
  DecisionInput,
} from "./governance.validation.js";

const person = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;
export class GovernanceService {
  async approvals(organizationId: string, query: ApprovalQuery) {
    await prisma.approvalRequest.updateMany({
      where: { organizationId, status: "PENDING", dueAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    const where = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceCode ? { serviceCode: query.serviceCode } : {}),
    };
    const [items, pending, overdue] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          requestedBy: { select: person },
          decidedBy: { select: person },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: query.limit,
      }),
      prisma.approvalRequest.count({
        where: { organizationId, status: "PENDING" },
      }),
      prisma.approvalRequest.count({
        where: { organizationId, status: "PENDING", dueAt: { lt: new Date() } },
      }),
    ]);
    return { items, metrics: { pending, overdue } };
  }
  audit(organizationId: string, query: AuditQuery) {
    return prisma.auditEvent.findMany({
      where: {
        organizationId,
        ...(query.serviceCode ? { serviceCode: query.serviceCode } : {}),
        ...(query.actionCode ? { actionCode: query.actionCode } : {}),
      },
      include: { actorUser: { select: person } },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
  }
  async decide(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: DecisionInput,
  ) {
    return prisma.$transaction(
      async (transaction) => {
        const approval = await transaction.approvalRequest.findFirst({
          where: { id, organizationId, status: "PENDING" },
        });
        if (!approval)
          throw new AppError(
            404,
            "Pending approval was not found.",
            "APPROVAL_NOT_FOUND",
          );
        if (approval.requestedById === actorUserId && !["AUTOMATION_POLICY_EXECUTION", "SCHOOL_GUARDIAN_ALERT_BATCH", "SCHOOL_FEE_REMINDER_BATCH", "COLLECTION_AGENT_RUN"].includes(approval.sourceType))
          throw new AppError(
            403,
            "The requester cannot decide their own approval.",
            "SELF_APPROVAL_FORBIDDEN",
          );
        const status =
          input.decision === "APPROVE"
            ? "APPROVED"
            : input.decision === "REJECT"
              ? "REJECTED"
              : "RETURNED";
        let updatedDescription = approval.description;
        let updatedContext = approval.context;
        if (approval.sourceType === "COLLECTION_AGENT_RUN") {
          const context = approval.context as { agentRunId?: string; invoiceId?: string; customerId?: string; outstanding?: number; currency?: string; proposedMessage?: string; externalDeliveryPerformed?: boolean; paymentStatusChanged?: boolean } | null;
          if (!context?.agentRunId || context.agentRunId !== approval.sourceId || !context.invoiceId || !context.customerId) throw new AppError(409, "The collection request is missing its verified context.", "INVALID_APPROVAL_CONTEXT");
          const [run, invoice] = await Promise.all([
            transaction.agentRun.findFirst({ where: { id: context.agentRunId, organizationId, status: "AWAITING_APPROVAL" }, include: { agent: { select: { supportedService: true } } } }),
            transaction.invoice.findFirst({ where: { id: context.invoiceId, organizationId, customerId: context.customerId, deletedAt: null }, select: { id: true, invoiceNumber: true, currency: true } }),
          ]);
          if (!run || run.agent.supportedService !== "FINANCE" || !invoice) throw new AppError(409, "The linked collection case changed after preparation.", "APPROVAL_SOURCE_CHANGED");
          const message = input.proposedMessage?.trim() || context.proposedMessage?.trim() || approval.description?.trim();
          if (input.decision === "APPROVE" && (!message || message.length < 10)) throw new AppError(400, "A valid reminder message is required before approval.", "COLLECTION_MESSAGE_REQUIRED");
          updatedDescription = message ?? approval.description;
          updatedContext = { ...context, proposedMessage: message ?? null, deliveryState: input.decision === "APPROVE" ? "READY_FOR_PROVIDER" : input.decision === "REJECT" ? "CANCELED" : "CHANGES_REQUESTED", externalDeliveryPerformed: false, paymentStatusChanged: false };
          await transaction.agentRun.update({ where: { id: run.id }, data: { status: input.decision === "APPROVE" ? "COMPLETED" : "CANCELED", completedAt: new Date(), summary: input.decision === "APPROVE" ? `${run.summary ?? "Collection reminder prepared."} Approved and ready for a configured delivery provider; no delivery was reported.` : input.decision === "REJECT" ? `Collection reminder rejected. ${input.note ?? ""}`.trim() : `Collection reminder returned for changes. Update the agent configuration and run it again. ${input.note ?? ""}`.trim() } });
          const followUpStatus = input.decision === "APPROVE" ? "PENDING" : "CANCELED";
          await transaction.customerFollowUp.updateMany({ where: { organizationId, customerId: context.customerId, deletedAt: null, status: "PENDING", OR: [{ invoiceId: context.invoiceId }, { invoiceId: null, title: { in: [`Collect ${invoice.invoiceNumber}`, `Payment follow-up: ${invoice.invoiceNumber}`] } }] }, data: { invoiceId: context.invoiceId, status: followUpStatus, description: input.decision === "APPROVE" ? `Approved reminder ready for delivery: ${message}` : input.decision === "RETURN" ? `Reminder requires changes: ${input.note}` : `Collection reminder rejected: ${input.note}`, updatedById: actorUserId, completedAt: null } });
          await transaction.notification.updateMany({ where: { organizationId, sourceType: "COLLECTION_AGENT_RUN", sourceId: run.id, deletedAt: null }, data: { type: "SYSTEM", title: input.decision === "APPROVE" ? "Collection reminder approved" : input.decision === "REJECT" ? "Collection reminder rejected" : "Collection reminder needs changes", message: input.decision === "APPROVE" ? `${invoice.invoiceNumber} is ready for a configured delivery provider. No message has been sent.` : `${invoice.invoiceNumber} was ${input.decision.toLowerCase()}. ${input.note ?? ""}`.trim(), actionPath: "/dashboard?view=automation", readAt: null, updatedById: actorUserId } });
        } else if (approval.sourceType === "VOICE_CALL_JOB") {
          const callStatus =
            input.decision === "APPROVE"
              ? "APPROVED"
              : input.decision === "REJECT"
                ? "CANCELED"
                : "DRAFT";
          const result = await transaction.voiceCallJob.updateMany({
            where: {
              id: approval.sourceId,
              organizationId,
              deletedAt: null,
              status: "PENDING_APPROVAL",
            },
            data: {
              status: callStatus,
              approvedById: input.decision === "APPROVE" ? actorUserId : null,
              approvedAt: input.decision === "APPROVE" ? new Date() : null,
              updatedById: actorUserId,
            },
          });
          if (result.count !== 1)
            throw new AppError(
              409,
              "The linked voice call is no longer awaiting approval.",
              "APPROVAL_SOURCE_CHANGED",
            );
        } else if (approval.sourceType === "PAYMENT_REFUND") {
          const refundStatus =
            input.decision === "APPROVE"
              ? "APPROVED"
              : input.decision === "REJECT"
                ? "REJECTED"
                : "CANCELED";
          const result = await transaction.paymentRefund.updateMany({
            where: {
              id: approval.sourceId,
              organizationId,
              status: "PENDING_APPROVAL",
            },
            data: { status: refundStatus, updatedById: actorUserId },
          });
          if (result.count !== 1)
            throw new AppError(
              409,
              "The linked refund is no longer awaiting approval.",
              "APPROVAL_SOURCE_CHANGED",
            );
        } else if (approval.sourceType === "SCHOOL_FEE_REMINDER_BATCH") {
          const execution=await transaction.automationPolicyExecution.findFirst({where:{id:approval.sourceId,organizationId,status:"AWAITING_APPROVAL"},include:{policy:{select:{actionCode:true}}}});if(!execution||execution.policy.actionCode!=="PREPARE_FEE_REMINDERS")throw new AppError(409,"The fee reminders are no longer awaiting approval.","APPROVAL_SOURCE_CHANGED");const context=approval.context as{draftIds?:string[]}|null;if(!context?.draftIds?.length)throw new AppError(409,"The fee reminder batch is missing context.","INVALID_APPROVAL_CONTEXT");const count=await transaction.schoolFeeReminderDraft.count({where:{organizationId,id:{in:context.draftIds},policyExecutionId:execution.id,status:"PENDING_APPROVAL"}});if(count!==context.draftIds.length)throw new AppError(409,"The fee reminder batch changed after preparation.","FEE_REMINDER_BATCH_STALE");const approved=input.decision==="APPROVE";await transaction.schoolFeeReminderDraft.updateMany({where:{organizationId,id:{in:context.draftIds},policyExecutionId:execution.id,status:"PENDING_APPROVAL"},data:{status:approved?"APPROVED_READY":"CANCELED",approvedById:approved?actorUserId:null,approvedAt:approved?new Date():null,failureMessage:approved?null:input.note??`Approval ${input.decision.toLowerCase()}.`,updatedById:actorUserId}});await transaction.automationPolicyExecution.update({where:{id:execution.id},data:{status:approved?"COMPLETED":input.decision==="REJECT"?"SKIPPED":"MATCHED",completedAt:approved?new Date():null,dedupeKey:approved?execution.dedupeKey:null,output:{draftIds:context.draftIds,deliveryPerformed:false,deliveryState:approved?"READY_FOR_PROVIDER":"CANCELED"}}});await transaction.notification.create({data:{organizationId,recipientId:approval.requestedById,type:"SYSTEM",title:approved?"Fee reminders approved":"Fee reminders need attention",message:approved?`${context.draftIds.length} fee reminder draft${context.draftIds.length===1?" is":"s are"} ready for a configured provider. No delivery was reported.`:`The fee reminder batch was ${input.decision.toLowerCase()}.`,sourceType:"SCHOOL_FEE_REMINDER_BATCH",sourceId:execution.id,actionPath:"/dashboard?view=school",createdById:actorUserId,updatedById:actorUserId}});
        } else if (approval.sourceType === "SCHOOL_GUARDIAN_ALERT_BATCH") {
          const execution = await transaction.automationPolicyExecution.findFirst({ where: { id: approval.sourceId, organizationId, status: "AWAITING_APPROVAL" }, include: { policy: { select: { actionCode: true } } } });
          if (!execution || execution.policy.actionCode !== "PREPARE_GUARDIAN_ABSENCE_ALERTS") throw new AppError(409, "The linked guardian alerts are no longer awaiting approval.", "APPROVAL_SOURCE_CHANGED");
          const context = approval.context as { date?: string; draftIds?: string[] } | null;
          if (!context?.date || !Array.isArray(context.draftIds) || !context.draftIds.length) throw new AppError(409, "The guardian alert batch is missing its verified context.", "INVALID_APPROVAL_CONTEXT");
          const expected = await transaction.schoolGuardianAlert.count({ where: { organizationId, id: { in: context.draftIds }, policyExecutionId: execution.id, status: "PENDING_APPROVAL" } });
          if (expected !== context.draftIds.length) throw new AppError(409, "One or more guardian alerts changed after preparation. Regenerate the batch.", "GUARDIAN_ALERT_BATCH_STALE");
          const approved = input.decision === "APPROVE";
          await transaction.schoolGuardianAlert.updateMany({ where: { organizationId, id: { in: context.draftIds }, policyExecutionId: execution.id, status: "PENDING_APPROVAL" }, data: { status: approved ? "APPROVED_READY" : "CANCELED", approvedById: approved ? actorUserId : null, approvedAt: approved ? new Date() : null, failureMessage: approved ? null : input.note ?? `Approval ${input.decision.toLowerCase()}.`, updatedById: actorUserId } });
          await transaction.automationPolicyExecution.update({ where: { id: execution.id }, data: { status: approved ? "COMPLETED" : input.decision === "REJECT" ? "SKIPPED" : "MATCHED", completedAt: approved ? new Date() : null, dedupeKey: approved ? execution.dedupeKey : null, output: { date: context.date, draftIds: context.draftIds, draftCount: context.draftIds.length, deliveryPerformed: false, deliveryState: approved ? "READY_FOR_PROVIDER" : "CANCELED" } } });
          await transaction.notification.create({ data: { organizationId, recipientId: approval.requestedById, type: "SYSTEM", title: approved ? "Guardian alerts approved" : "Guardian alerts need attention", message: approved ? `${context.draftIds.length} guardian alert draft${context.draftIds.length===1?" is":"s are"} ready for a configured delivery provider. No message has been reported as sent.` : `The guardian alert batch for ${context.date} was ${input.decision.toLowerCase()}.`, sourceType: "SCHOOL_GUARDIAN_ALERT_BATCH", sourceId: execution.id, actionPath: "/dashboard?view=school", createdById: actorUserId, updatedById: actorUserId } });
        } else if (approval.sourceType === "AUTOMATION_POLICY_EXECUTION") {
          const execution = await transaction.automationPolicyExecution.findFirst({ where: { id: approval.sourceId, organizationId, status: "AWAITING_APPROVAL" }, include: { policy: { select: { actionCode: true } } } });
          if (!execution || execution.policy.actionCode !== "GENERATE_SCHOOL_COVERAGE_PLAN") throw new AppError(409, "The linked automation is no longer awaiting approval.", "APPROVAL_SOURCE_CHANGED");
          const context = approval.context as { date?: string; assignments?: { timetableEntryId?: string; substituteTeacherId?: string; absentTeacherId?: string }[] } | null;
          if (!context?.date || !Array.isArray(context.assignments)) throw new AppError(409, "The substitute plan is missing its verified context.", "INVALID_APPROVAL_CONTEXT");
          if (input.decision === "APPROVE") {
            const attendanceDate = new Date(`${context.date}T00:00:00.000Z`), dayOfWeek = attendanceDate.getUTCDay();
            for (const item of context.assignments) {
              if (!item.timetableEntryId || !item.substituteTeacherId || !item.absentTeacherId) throw new AppError(409, "The substitute plan contains an invalid assignment.", "INVALID_APPROVAL_CONTEXT");
              const entry = await transaction.schoolTimetableEntry.findFirst({ where: { id: item.timetableEntryId, organizationId, teacherId: item.absentTeacherId, dayOfWeek, deletedAt: null }, select: { id: true, teacherId: true, startsAt: true, endsAt: true } });
              const teacher = await transaction.schoolTeacher.findFirst({ where: { id: item.substituteTeacherId, organizationId, status: "ACTIVE", deletedAt: null }, select: { id: true } });
              if (!entry || !teacher) throw new AppError(409, "A timetable period or substitute teacher changed after the plan was prepared.", "SCHOOL_COVERAGE_PLAN_STALE");
              const [unavailable, scheduled, substituteConflict] = await Promise.all([
                transaction.schoolTeacherAttendance.findFirst({ where: { organizationId, teacherId: teacher.id, attendanceDate, status: { in: ["ABSENT", "LEAVE"] } }, select: { id: true } }),
                transaction.schoolTimetableEntry.findFirst({ where: { organizationId, teacherId: teacher.id, dayOfWeek, deletedAt: null, startsAt: { lt: entry.endsAt }, endsAt: { gt: entry.startsAt } }, select: { id: true } }),
                transaction.schoolSubstituteAssignment.findFirst({ where: { organizationId, substituteTeacherId: teacher.id, attendanceDate, status: "ASSIGNED", timetableEntry: { startsAt: { lt: entry.endsAt }, endsAt: { gt: entry.startsAt } } }, select: { id: true } }),
              ]);
              if (unavailable || scheduled || substituteConflict) throw new AppError(409, "A proposed substitute is no longer available. Regenerate the plan.", "SCHOOL_COVERAGE_PLAN_STALE");
              await transaction.schoolSubstituteAssignment.upsert({ where: { timetableEntryId_attendanceDate: { timetableEntryId: entry.id, attendanceDate } }, update: { substituteTeacherId: teacher.id, status: "ASSIGNED", notes: "Approved from the B² Brain automated coverage plan.", updatedById: actorUserId }, create: { organizationId, timetableEntryId: entry.id, attendanceDate, absentTeacherId: entry.teacherId, substituteTeacherId: teacher.id, notes: "Approved from the B² Brain automated coverage plan.", createdById: actorUserId, updatedById: actorUserId } });
            }
          }
          await transaction.automationPolicyExecution.update({ where: { id: execution.id }, data: { status: input.decision === "APPROVE" ? "COMPLETED" : input.decision === "REJECT" ? "SKIPPED" : "MATCHED", completedAt: input.decision === "APPROVE" ? new Date() : null, failureMessage: input.decision === "REJECT" ? input.note : null, dedupeKey: input.decision === "APPROVE" ? execution.dedupeKey : null } });
          await transaction.notification.create({ data: { organizationId, recipientId: approval.requestedById, type: "SYSTEM", title: input.decision === "APPROVE" ? "Substitute plan approved" : "Substitute plan needs attention", message: input.decision === "APPROVE" ? `The automated substitute plan for ${context.date} is now applied to the daily timetable.` : `The automated substitute plan for ${context.date} was ${input.decision.toLowerCase()}.`, sourceType: "AUTOMATION_POLICY_EXECUTION", sourceId: execution.id, actionPath: "/dashboard?view=school", createdById: actorUserId, updatedById: actorUserId } });
        } else
          throw new AppError(
            400,
            "This approval action is not supported yet.",
            "UNSUPPORTED_APPROVAL_SOURCE",
          );
        const decided = await transaction.approvalRequest.update({
          where: { id },
          data: {
            status,
            decisionNote: input.note,
            decidedById: actorUserId,
            decidedAt: new Date(),
            description: updatedDescription,
            context: updatedContext === null ? Prisma.JsonNull : updatedContext,
          },
        });
        await transaction.auditEvent.create({
          data: {
            organizationId,
            actorType: "USER",
            actorUserId,
            serviceCode: approval.serviceCode,
            actionCode: `APPROVAL_${input.decision}`,
            sourceType: "APPROVAL_REQUEST",
            sourceId: approval.id,
            summary: `${input.decision.toLowerCase()} decision recorded for ${approval.title}.`,
            beforeState: { status: approval.status },
            afterState: { status },
            metadata: input.note || input.proposedMessage ? { ...(input.note ? { note: input.note } : {}), ...(input.proposedMessage ? { approvedMessageEdited: input.proposedMessage !== approval.description } : {}), externalDeliveryPerformed: false } : Prisma.JsonNull,
          },
        });
        return decided;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
