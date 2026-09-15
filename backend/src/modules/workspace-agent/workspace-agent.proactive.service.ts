import type { BusinessGoal, BusinessGoalType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { BusinessGoalInput } from "./workspace-agent.proactive.validation.js";
import { requireWorkspaceAgentCapability, workspaceAgentCapabilityAvailability, type WorkspaceAgentCapability } from "./workspace-agent.capabilities.js";
import { composeOperatingBrief } from "./workspace-agent.brief.js";

type Context = {
  organizationId: string;
  userId: string;
  membershipId: string;
  roleCode: string;
  permissions: string[];
  isPlatformAdmin?: boolean;
};
const day = 86_400_000;
const percent = (current: number, target: number, inverse = false) =>
  Math.max(
    0,
    Math.min(
      999,
      target
        ? (inverse ? target / Math.max(current, 0.01) : current / target) * 100
        : 0,
    ),
  );

export class WorkspaceAgentProactiveService {
  private can(context: Context, permission: string) {
    return context.permissions.includes(permission);
  }

  private goalCapability(type: BusinessGoalType, write: boolean): WorkspaceAgentCapability {
    if (["MONTHLY_REVENUE", "EXPENSE_LIMIT"].includes(type)) return write ? "FINANCE_GOAL" : "FINANCE_GOAL_VIEW";
    if (type === "PROJECT_COMPLETION") return write ? "PROJECT_GOAL" : "PROJECT_GOAL_VIEW";
    if (type === "NEW_LEADS") return write ? "LEADS_GOAL" : "LEADS_GOAL_VIEW";
    if (type === "FOLLOW_UP_RESPONSE") return write ? "FOLLOW_UP_GOAL" : "FOLLOW_UP_GOAL_VIEW";
    return write ? "CRM_GOAL" : "CRM_GOAL_VIEW";
  }

  async brief(context: Context) {
    return composeOperatingBrief(context);
  }

  private async currentValue(context: Context, goal: BusinessGoal) {
    const range = { gte: goal.periodStart, lte: goal.periodEnd };
    switch (goal.type) {
      case "MONTHLY_REVENUE": {
        if (!this.can(context, "FINANCE_VIEW")) return null;
        const rows = await prisma.payment.findMany({
          where: {
            organizationId: context.organizationId,
            deletedAt: null,
            paidAt: range,
          },
          select: { amount: true, refundedAmount: true },
        });
        return rows.reduce(
          (sum, row) => sum + Number(row.amount) - Number(row.refundedAmount),
          0,
        );
      }
      case "EXPENSE_LIMIT": {
        if (!this.can(context, "FINANCE_VIEW")) return null;
        const rows = await prisma.expense.findMany({
          where: {
            organizationId: context.organizationId,
            deletedAt: null,
            status: "RECORDED",
            expenseDate: range,
          },
          select: { amount: true },
        });
        return rows.reduce((sum, row) => sum + Number(row.amount), 0);
      }
      case "NEW_LEADS":
        return this.can(context, "CRM_VIEW")
          ? prisma.customer.count({
              where: {
                organizationId: context.organizationId,
                deletedAt: null,
                status: "LEAD",
                createdAt: range,
              },
            })
          : null;
      case "PROJECT_COMPLETION":
        return this.can(context, "PROJECT_VIEW")
          ? prisma.project.count({
              where: {
                organizationId: context.organizationId,
                deletedAt: null,
                status: "COMPLETED",
                completedAt: range,
              },
            })
          : null;
      case "FOLLOW_UP_RESPONSE": {
        if (!this.can(context, "CRM_ACTIVITY_VIEW")) return null;
        const [all, completed] = await Promise.all([
          prisma.customerFollowUp.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              createdAt: range,
            },
          }),
          prisma.customerFollowUp.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              createdAt: range,
              status: "COMPLETED",
            },
          }),
        ]);
        return all ? (completed / all) * 100 : 0;
      }
      case "CUSTOMER_CONVERSION": {
        if (!this.can(context, "CRM_VIEW")) return null;
        const [all, active] = await Promise.all([
          prisma.customer.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              createdAt: range,
            },
          }),
          prisma.customer.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              createdAt: range,
              status: "ACTIVE",
            },
          }),
        ]);
        return all ? (active / all) * 100 : 0;
      }
    }
  }

  async goals(context: Context) {
    const goals = await prisma.businessGoal.findMany({
      where: { organizationId: context.organizationId, archivedAt: null },
      orderBy: [{ status: "asc" }, { periodEnd: "asc" }],
    });
    const visible = await Promise.all(goals.map(async (goal) => ({ goal, availability: await workspaceAgentCapabilityAvailability(context, this.goalCapability(goal.type, false)) })));
    return Promise.all(
      visible.filter(({ availability }) => availability === "VERIFIED").map(async ({ goal }) => {
        const currentValue = await this.currentValue(context, goal),
          target = Number(goal.targetValue),
          elapsed = Math.max(0, Date.now() - goal.periodStart.getTime()),
          total = Math.max(
            1,
            goal.periodEnd.getTime() - goal.periodStart.getTime(),
          ),
          expected = target * Math.min(1, elapsed / total),
          inverse = goal.type === "EXPENSE_LIMIT";
        return {
          ...goal,
          targetValue: target,
          currentValue,
          progress:
            currentValue === null
              ? null
              : percent(currentValue, target, inverse),
          requiredPace:
            currentValue === null
              ? null
              : Math.max(
                  0,
                  (target - currentValue) /
                    Math.max(
                      1,
                      Math.ceil((goal.periodEnd.getTime() - Date.now()) / day),
                    ),
                ),
          risk:
            currentValue === null
              ? "UNKNOWN"
              : inverse
                ? currentValue > expected * 1.1
                  ? "HIGH"
                  : "ON_TRACK"
                : currentValue < expected * 0.8
                  ? "HIGH"
                  : "ON_TRACK",
        };
      }),
    );
  }

  async createGoal(context: Context, input: BusinessGoalInput) {
    const capability = this.goalCapability(input.type as BusinessGoalType, true);
    await requireWorkspaceAgentCapability(context, capability);
    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.businessGoal.create({
        data: {
          organizationId: context.organizationId,
          type: input.type,
          title: input.title,
          targetValue: input.targetValue,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          createdById: context.userId,
          updatedById: context.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: context.organizationId,
          actorType: "USER",
          actorUserId: context.userId,
          serviceCode: "B2BRAIN_AGENT",
          actionCode: "BUSINESS_GOAL_CREATED",
          sourceType: "BUSINESS_GOAL",
          sourceId: created.id,
          summary: `Created business goal: ${created.title}`,
          afterState: {
            type: created.type,
            targetValue: Number(created.targetValue),
            periodEnd: created.periodEnd,
          },
        },
      });
      return created;
    });
    return goal;
  }

  async archiveGoal(context: Context, id: string) {
    const goal = await prisma.businessGoal.findFirst({ where: { id, organizationId: context.organizationId, archivedAt: null }, select: { type: true } });
    if (!goal) throw new AppError(404, "Goal was not found.", "GOAL_NOT_FOUND");
    const capability = this.goalCapability(goal.type, true);
    await requireWorkspaceAgentCapability(context, capability);
    const result = await prisma.businessGoal.updateMany({
      where: { id, organizationId: context.organizationId, archivedAt: null },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        updatedById: context.userId,
      },
    });
    if (result.count !== 1)
      throw new AppError(404, "Goal was not found.", "GOAL_NOT_FOUND");
  }
}
