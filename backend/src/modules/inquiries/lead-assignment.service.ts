import type { Inquiry, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  LeadAssignmentRuleInput,
  ManualLeadAssignmentInput,
} from "./lead-assignment.validation.js";

const employeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  linkedUserId: true,
  jobTitle: true,
} as const;
const employeeName = (employee: {
  firstName: string;
  lastName: string | null;
}) => `${employee.firstName} ${employee.lastName ?? ""}`.trim();
const idsFromJson = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export class LeadAssignmentService {
  async list(organizationId: string, actorUserId: string) {
    await this.escalateDue(organizationId, actorUserId);
    const [rules, employees, campaigns, followUpSequences] = await Promise.all([
      prisma.leadAssignmentRule.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.employee.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        select: employeeSelect,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.marketingCampaign.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.followUpSequence.findMany({
        where: { organizationId, isActive: true, archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      rules: rules.map((rule) => ({
        ...rule,
        eligibleEmployeeIds: idsFromJson(rule.eligibleEmployeeIds),
      })),
      employees,
      campaigns,
      followUpSequences,
    };
  }

  private async validateEmployees(
    organizationId: string,
    input: LeadAssignmentRuleInput,
  ) {
    const ids = [
      ...new Set([
        ...input.eligibleEmployeeIds,
        ...(input.escalationEmployeeId ? [input.escalationEmployeeId] : []),
      ]),
    ];
    const count = await prisma.employee.count({
      where: {
        organizationId,
        id: { in: ids },
        deletedAt: null,
        status: "ACTIVE",
      },
    });
    if (count !== ids.length)
      throw new AppError(
        400,
        "Assignment rules can use only active employees from this organization.",
        "INVALID_ASSIGNMENT_EMPLOYEE",
      );
    if (
      input.campaignId &&
      !(await prisma.marketingCampaign.findFirst({
        where: { id: input.campaignId, organizationId, deletedAt: null },
      }))
    )
      throw new AppError(
        400,
        "The selected campaign is unavailable.",
        "INVALID_ASSIGNMENT_CAMPAIGN",
      );
    if (
      input.followUpSequenceId &&
      !(await prisma.followUpSequence.findFirst({
        where: {
          id: input.followUpSequenceId,
          organizationId,
          isActive: true,
          archivedAt: null,
        },
      }))
    )
      throw new AppError(
        400,
        "The selected follow-up sequence is unavailable.",
        "INVALID_FOLLOW_UP_SEQUENCE",
      );
  }

  async saveRule(
    organizationId: string,
    actorUserId: string,
    id: string | null,
    input: LeadAssignmentRuleInput,
  ) {
    await this.validateEmployees(organizationId, input);
    const data = {
      ...input,
      eligibleEmployeeIds: [...new Set(input.eligibleEmployeeIds)],
      updatedById: actorUserId,
    };
    if (!id)
      return prisma.leadAssignmentRule.create({
        data: { ...data, organizationId, createdById: actorUserId },
      });
    const result = await prisma.leadAssignmentRule.updateMany({
      where: { id, organizationId, archivedAt: null },
      data,
    });
    if (result.count !== 1)
      throw new AppError(
        404,
        "Assignment rule was not found.",
        "ASSIGNMENT_RULE_NOT_FOUND",
      );
    return prisma.leadAssignmentRule.findFirst({
      where: { id, organizationId },
    });
  }

  async archiveRule(organizationId: string, actorUserId: string, id: string) {
    if (
      (
        await prisma.leadAssignmentRule.updateMany({
          where: { id, organizationId, archivedAt: null },
          data: {
            archivedAt: new Date(),
            isActive: false,
            updatedById: actorUserId,
          },
        })
      ).count !== 1
    )
      throw new AppError(
        404,
        "Assignment rule was not found.",
        "ASSIGNMENT_RULE_NOT_FOUND",
      );
  }

  async assignNewInquiry(
    organizationId: string,
    actorUserId: string,
    inquiry: Inquiry,
  ) {
    if (inquiry.assignedEmployeeId) return null;
    return prisma.$transaction(async (tx) => {
      const rules = await tx.leadAssignmentRule.findMany({
        where: {
          organizationId,
          isActive: true,
          archivedAt: null,
          AND: [
            { OR: [{ source: null }, { source: inquiry.source }] },
            { OR: [{ inquiryType: null }, { inquiryType: inquiry.type }] },
            { OR: [{ priority: null }, { priority: inquiry.priority }] },
            { OR: [{ campaignId: null }, { campaignId: inquiry.campaignId }] },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      for (const rule of rules) {
        const eligibleIds = idsFromJson(rule.eligibleEmployeeIds);
        const employees = await tx.employee.findMany({
          where: {
            organizationId,
            id: { in: eligibleIds },
            deletedAt: null,
            status: "ACTIVE",
          },
          select: employeeSelect,
        });
        if (!employees.length) continue;
        const ordered = eligibleIds.flatMap((id) =>
          employees.filter((employee) => employee.id === id),
        );
        const lastIndex = rule.lastAssignedEmployeeId
          ? ordered.findIndex(
              (employee) => employee.id === rule.lastAssignedEmployeeId,
            )
          : -1;
        const employee =
          rule.strategy === "ROUND_ROBIN"
            ? ordered[(lastIndex + 1) % ordered.length]
            : ordered[0];
        if (!employee) continue;
        const responseDueAt = new Date(
          Date.now() + rule.responseTimeMinutes * 60000,
        );
        const escalationDueAt = rule.escalationAfterMinutes
          ? new Date(Date.now() + rule.escalationAfterMinutes * 60000)
          : null;
        const reason = `Matched rule "${rule.name}" by ${[rule.source && `source ${rule.source}`, rule.inquiryType && `type ${rule.inquiryType}`, rule.priority && `priority ${rule.priority}`, rule.campaignId && "campaign"].filter(Boolean).join(", ") || "default conditions"}; ${rule.strategy.toLowerCase().replace("_", " ")} assignment.`;
        await tx.inquiry.update({
          where: { id: inquiry.id },
          data: {
            assignedEmployeeId: employee.id,
            responseDueAt,
            updatedById: actorUserId,
            timeline: {
              create: {
                organizationId,
                type: "ASSIGNED",
                summary: `Automatically assigned to ${employeeName(employee)}`,
                details: reason,
                createdById: actorUserId,
              },
            },
          },
        });
        await tx.leadAssignmentRule.update({
          where: { id: rule.id },
          data: {
            lastAssignedEmployeeId: employee.id,
            updatedById: actorUserId,
          },
        });
        await tx.leadAssignmentHistory.create({
          data: {
            organizationId,
            inquiryId: inquiry.id,
            ruleId: rule.id,
            action: "AUTO_ASSIGNED",
            toEmployeeId: employee.id,
            reason,
            responseDueAt,
            escalationDueAt,
            actorUserId,
          },
        });
        if (rule.followUpSequenceId) {
          const sequence = await tx.followUpSequence.findFirst({
            where: {
              id: rule.followUpSequenceId,
              organizationId,
              isActive: true,
              archivedAt: null,
            },
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          });
          const duplicate = sequence
            ? await tx.followUpEnrollment.findFirst({
                where: {
                  organizationId,
                  sequenceId: sequence.id,
                  inquiryId: inquiry.id,
                  status: "ACTIVE",
                },
              })
            : null;
          if (sequence && !duplicate && sequence.steps.length) {
            const render = (text: string) =>
              text
                .replaceAll("{contactName}", inquiry.contactName)
                .replaceAll("{companyName}", inquiry.companyName ?? "")
                .replaceAll("{subject}", inquiry.subject);
            let cursor = new Date();
            const executions = sequence.steps.map((step) => {
              cursor = new Date(cursor.getTime() + step.delayMinutes * 60000);
              return { step, dueAt: new Date(cursor) };
            });
            await tx.followUpEnrollment.create({
              data: {
                organizationId,
                sequenceId: sequence.id,
                inquiryId: inquiry.id,
                customerId: inquiry.customerId,
                assignedUserId: employee.linkedUserId ?? actorUserId,
                nextStepAt: executions[0]?.dueAt ?? null,
                createdById: actorUserId,
                updatedById: actorUserId,
                executions: {
                  create: executions.map(({ step, dueAt }) => ({
                    organizationId,
                    stepId: step.id,
                    status: "SCHEDULED",
                    scheduledAt: new Date(),
                    dueAt,
                    renderedTitle: render(step.title),
                    renderedMessage: render(step.messageTemplate),
                  })),
                },
              },
            });
            await tx.inquiryTimeline.create({
              data: {
                organizationId,
                inquiryId: inquiry.id,
                type: "FOLLOW_UP_SCHEDULED",
                summary: `Automatically enrolled in ${sequence.name}`,
                details: `Started by assignment rule "${rule.name}".`,
                createdById: actorUserId,
              },
            });
          }
        }
        if (employee.linkedUserId)
          await tx.notification.create({
            data: {
              organizationId,
              recipientId: employee.linkedUserId,
              type: "AGENT_ALERT",
              title: `New inquiry: ${inquiry.subject}`,
              message: `${inquiry.contactName} requires a response by ${responseDueAt.toISOString()}.`,
              sourceType: "INQUIRY",
              sourceId: inquiry.id,
              actionPath: "/dashboard?view=inquiries",
              availableAt: new Date(),
              createdById: actorUserId,
              updatedById: actorUserId,
            },
          });
        return employee.id;
      }
      return null;
    });
  }

  async manualAssign(
    organizationId: string,
    actorUserId: string,
    inquiryId: string,
    input: ManualLeadAssignmentInput,
  ) {
    const [inquiry, employee] = await Promise.all([
      prisma.inquiry.findFirst({
        where: { id: inquiryId, organizationId, deletedAt: null },
      }),
      input.employeeId
        ? prisma.employee.findFirst({
            where: {
              id: input.employeeId,
              organizationId,
              deletedAt: null,
              status: "ACTIVE",
            },
            select: employeeSelect,
          })
        : null,
    ]);
    if (!inquiry)
      throw new AppError(404, "Inquiry was not found.", "INQUIRY_NOT_FOUND");
    if (input.employeeId && !employee)
      throw new AppError(
        404,
        "Active employee was not found.",
        "EMPLOYEE_NOT_FOUND",
      );
    const responseDueAt = employee
      ? new Date(Date.now() + input.responseTimeMinutes * 60000)
      : null;
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id: inquiryId },
        data: {
          assignedEmployeeId: employee?.id ?? null,
          responseDueAt,
          updatedById: actorUserId,
          timeline: {
            create: {
              organizationId,
              type: "ASSIGNED",
              summary: employee
                ? `Manually assigned to ${employeeName(employee)}`
                : "Inquiry unassigned",
              details: input.reason,
              createdById: actorUserId,
            },
          },
        },
      });
      await tx.leadAssignmentHistory.create({
        data: {
          organizationId,
          inquiryId,
          action: employee ? "MANUALLY_ASSIGNED" : "UNASSIGNED",
          fromEmployeeId: inquiry.assignedEmployeeId,
          toEmployeeId: employee?.id ?? null,
          reason: input.reason,
          responseDueAt,
          actorUserId,
        },
      });
      if (employee?.linkedUserId)
        await tx.notification.create({
          data: {
            organizationId,
            recipientId: employee.linkedUserId,
            type: "AGENT_ALERT",
            title: `Inquiry assigned: ${inquiry.subject}`,
            message: input.reason,
            sourceType: "INQUIRY",
            sourceId: inquiry.id,
            actionPath: "/dashboard?view=inquiries",
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });
    });
  }

  async escalateDue(organizationId: string, actorUserId: string) {
    const due = await prisma.leadAssignmentHistory.findMany({
      where: {
        organizationId,
        action: "AUTO_ASSIGNED",
        escalationDueAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const handled = new Set<string>();
    for (const assignment of due) {
      if (handled.has(assignment.inquiryId)) continue;
      handled.add(assignment.inquiryId);
      const [inquiry, laterEscalation, rule] = await Promise.all([
        prisma.inquiry.findFirst({
          where: {
            id: assignment.inquiryId,
            organizationId,
            deletedAt: null,
            firstRespondedAt: null,
            status: { notIn: ["CONVERTED", "DISQUALIFIED", "SPAM"] },
          },
        }),
        prisma.leadAssignmentHistory.findFirst({
          where: {
            organizationId,
            inquiryId: assignment.inquiryId,
            action: "ESCALATED",
            createdAt: { gt: assignment.createdAt },
          },
        }),
        assignment.ruleId
          ? prisma.leadAssignmentRule.findFirst({
              where: {
                id: assignment.ruleId,
                organizationId,
                archivedAt: null,
              },
            })
          : null,
      ]);
      if (!inquiry || laterEscalation || !rule?.escalationEmployeeId) continue;
      const employee = await prisma.employee.findFirst({
        where: {
          id: rule.escalationEmployeeId,
          organizationId,
          deletedAt: null,
          status: "ACTIVE",
        },
        select: employeeSelect,
      });
      if (!employee) continue;
      const reason = `Escalated because the response deadline for rule "${rule.name}" was missed.`;
      await prisma.$transaction(async (tx) => {
        await tx.inquiry.update({
          where: { id: inquiry.id },
          data: {
            assignedEmployeeId: employee.id,
            updatedById: actorUserId,
            timeline: {
              create: {
                organizationId,
                type: "ASSIGNED",
                summary: `Escalated to ${employeeName(employee)}`,
                details: reason,
                createdById: actorUserId,
              },
            },
          },
        });
        await tx.leadAssignmentHistory.create({
          data: {
            organizationId,
            inquiryId: inquiry.id,
            ruleId: rule.id,
            action: "ESCALATED",
            fromEmployeeId: inquiry.assignedEmployeeId,
            toEmployeeId: employee.id,
            reason,
            responseDueAt: inquiry.responseDueAt,
            actorUserId,
          },
        });
        if (employee.linkedUserId)
          await tx.notification.create({
            data: {
              organizationId,
              recipientId: employee.linkedUserId,
              type: "AGENT_ALERT",
              title: `Escalated inquiry: ${inquiry.subject}`,
              message: reason,
              sourceType: "INQUIRY",
              sourceId: inquiry.id,
              actionPath: "/dashboard?view=inquiries",
              createdById: actorUserId,
              updatedById: actorUserId,
            },
          });
      });
    }
  }
}
