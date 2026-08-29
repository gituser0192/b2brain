import type { BusinessGoal, BusinessGoalType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { BusinessGoalInput } from "./workspace-agent.proactive.validation.js";

type Context = {
  organizationId: string;
  userId: string;
  permissions: string[];
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

  async brief(context: Context) {
    const now = new Date(),
      today = new Date(now.getTime() - day),
      currentStart = new Date(now.getTime() - 30 * day),
      previousStart = new Date(now.getTime() - 60 * day),
      nearDeadline = new Date(now.getTime() + 7 * day);
    const canCrm = this.can(context, "CRM_VIEW"),
      canFollow = this.can(context, "CRM_ACTIVITY_VIEW"),
      canProjects = this.can(context, "PROJECT_VIEW"),
      canTasks = this.can(context, "TASK_VIEW"),
      canFinance = this.can(context, "FINANCE_VIEW"),
      canSupport = this.can(context, "SUPPORT_VIEW");
    const visibleRecommendationServices = [
      canCrm ? "LEADS" : null,
      canFinance ? "FINANCE" : null,
      canProjects ? "PROJECTS" : null,
      this.can(context, "DEAL_VIEW") ? "SALES" : null,
    ].filter((value): value is string => Boolean(value));
    const [
      newCustomers,
      newLeads,
      overdueFollowUps,
      overdueTasks,
      atRiskProjects,
      currentPayments,
      previousPayments,
      currentExpenses,
      previousExpenses,
      serviceRequests,
      savedRecommendations,
    ] = await Promise.all([
      canCrm
        ? prisma.customer.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              createdAt: { gte: today },
            },
          })
        : null,
      canCrm
        ? prisma.customer.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "LEAD",
              createdAt: { gte: today },
            },
          })
        : null,
      canFollow
        ? prisma.customerFollowUp.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "PENDING",
              dueAt: { lt: now },
            },
          })
        : null,
      canTasks
        ? prisma.projectTask.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: { notIn: ["COMPLETED", "CANCELED"] },
              dueDate: { lt: now },
            },
          })
        : null,
      canProjects
        ? prisma.project.findMany({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
              dueDate: { gte: now, lte: nearDeadline },
              tasks: {
                some: {
                  deletedAt: null,
                  status: { notIn: ["COMPLETED", "CANCELED"] },
                },
              },
            },
            select: { id: true, name: true, dueDate: true },
            take: 20,
          })
        : [],
      canFinance
        ? prisma.payment.findMany({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              paidAt: { gte: currentStart, lte: now },
            },
            select: { amount: true, refundedAmount: true },
          })
        : [],
      canFinance
        ? prisma.payment.findMany({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              paidAt: { gte: previousStart, lt: currentStart },
            },
            select: { amount: true, refundedAmount: true },
          })
        : [],
      canFinance
        ? prisma.expense.findMany({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "RECORDED",
              expenseDate: { gte: currentStart, lte: now },
            },
            select: { amount: true },
          })
        : [],
      canFinance
        ? prisma.expense.findMany({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "RECORDED",
              expenseDate: { gte: previousStart, lt: currentStart },
            },
            select: { amount: true },
          })
        : [],
      canSupport
        ? prisma.providerServiceRequest.count({
            where: {
              organizationId: context.organizationId,
              status: {
                in: [
                  "SUBMITTED",
                  "TRIAGED",
                  "IN_PROGRESS",
                  "WAITING_CUSTOMER",
                  "AWAITING_CUSTOMER_APPROVAL",
                ],
              },
              deletedAt: null,
            },
          })
        : null,
      context.permissions.includes("APPROVAL_VIEW") &&
      visibleRecommendationServices.length
        ? prisma.businessRecommendation.findMany({
            where: {
              organizationId: context.organizationId,
              status: "OPEN",
              serviceCode: { in: visibleRecommendationServices },
              OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
            },
            select: {
              recommendedAction: true,
              explanation: true,
              serviceCode: true,
            },
            orderBy: [{ priority: "desc" }, { lastDetectedAt: "desc" }],
            take: 10,
          })
        : [],
    ]);
    const sumPayments = (
      items: { amount: unknown; refundedAmount: unknown }[],
    ) =>
      items.reduce(
        (sum, item) => sum + Number(item.amount) - Number(item.refundedAmount),
        0,
      );
    const sumExpenses = (items: { amount: unknown }[]) =>
      items.reduce((sum, item) => sum + Number(item.amount), 0);
    const revenue = sumPayments(currentPayments),
      previousRevenue = sumPayments(previousPayments),
      expenses = sumExpenses(currentExpenses),
      previousExpense = sumExpenses(previousExpenses),
      profit = revenue - expenses,
      previousProfit = previousRevenue - previousExpense;
    const alerts: {
      code: string;
      title: string;
      why: string;
      evidence: string;
      period: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      action: string;
      view: string;
    }[] = [];
    if (overdueFollowUps)
      alerts.push({
        code: "OVERDUE_FOLLOW_UPS",
        title: "Customer follow-ups are overdue",
        why: "Delayed responses can reduce conversion and trust.",
        evidence: `${overdueFollowUps} pending follow-up${overdueFollowUps === 1 ? " is" : "s are"} past due.`,
        period: "Current unresolved records",
        severity: overdueFollowUps >= 5 ? "HIGH" : "MEDIUM",
        action: "Review and assign the overdue follow-ups.",
        view: "crm",
      });
    if (overdueTasks)
      alerts.push({
        code: "OVERDUE_TASKS",
        title: "Project tasks are overdue",
        why: "Overdue work can put delivery dates at risk.",
        evidence: `${overdueTasks} incomplete task${overdueTasks === 1 ? " is" : "s are"} past due.`,
        period: "Current unresolved records",
        severity: overdueTasks >= 5 ? "HIGH" : "MEDIUM",
        action: "Re-plan dates and assign owners.",
        view: "projects",
      });
    if (atRiskProjects.length)
      alerts.push({
        code: "PROJECT_RISK",
        title: "Projects are approaching deadlines",
        why: "Incomplete work remains close to a project due date.",
        evidence: `${atRiskProjects.length} active project${atRiskProjects.length === 1 ? " has" : "s have"} incomplete tasks and a due date within 7 days.`,
        period: `${now.toISOString().slice(0, 10)} to ${nearDeadline.toISOString().slice(0, 10)}`,
        severity: "HIGH",
        action: "Open the affected projects and confirm delivery owners.",
        view: "projects",
      });
    if (previousRevenue > 0 && revenue < previousRevenue * 0.85)
      alerts.push({
        code: "REVENUE_DECLINE",
        title: "Revenue has declined",
        why: "A sustained decline can reduce available cash.",
        evidence: `Last 30 days revenue is ${Math.round((1 - revenue / previousRevenue) * 100)}% below the preceding 30 days.`,
        period: "Last 30 days compared with preceding 30 days",
        severity: revenue < previousRevenue * 0.7 ? "HIGH" : "MEDIUM",
        action: "Review pipeline, collections and lost opportunities.",
        view: "finance",
      });
    if (previousExpense > 0 && expenses > previousExpense * 1.2)
      alerts.push({
        code: "EXPENSE_SPIKE",
        title: "Expenses have increased unusually",
        why: "Rapid cost growth can compress profit margin.",
        evidence: `Last 30 days expenses are ${Math.round((expenses / previousExpense - 1) * 100)}% above the preceding 30 days.`,
        period: "Last 30 days compared with preceding 30 days",
        severity: expenses > previousExpense * 1.5 ? "HIGH" : "MEDIUM",
        action: "Review expense categories and exceptional costs.",
        view: "finance",
      });
    if (revenue > 0 && profit < 0)
      alerts.push({
        code: "NEGATIVE_MARGIN",
        title: "Profit margin is negative",
        why: "Current expenses exceed collected revenue.",
        evidence: `Revenue ${revenue.toFixed(2)}, expenses ${expenses.toFixed(2)}, profit ${profit.toFixed(2)} during the last 30 days.`,
        period: "Last 30 days",
        severity: "HIGH",
        action: "Protect cash flow and inspect the largest expenses.",
        view: "finance",
      });
    const components = [
      canFinance ? (profit >= 0 ? 80 : 30) : null,
      overdueFollowUps === null
        ? null
        : Math.max(0, 100 - overdueFollowUps * 15),
      overdueTasks === null ? null : Math.max(0, 100 - overdueTasks * 12),
      atRiskProjects.length
        ? Math.max(20, 90 - atRiskProjects.length * 15)
        : canProjects
          ? 90
          : null,
    ].filter((value): value is number => value !== null);
    const healthScore = components.length
      ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
      : null;
    const recommendations = [
      ...alerts.map((alert) => ({
        title: alert.action,
        reason: alert.evidence,
        view: alert.view,
      })),
      ...savedRecommendations.map((item) => ({
        title: item.recommendedAction,
        reason: item.explanation,
        view: item.serviceCode.toLowerCase(),
      })),
    ].slice(0, 3);
    return {
      calculatedAt: now,
      period: "Today, with financial comparison across rolling 30-day periods",
      health: {
        score: healthScore,
        change: null,
        missingData: [
          ...(!canFinance ? ["Finance data is not permitted."] : []),
          ...(!canCrm ? ["CRM data is not permitted."] : []),
          ...(!canProjects ? ["Project data is not permitted."] : []),
        ],
      },
      finance: canFinance
        ? {
            revenue,
            expenses,
            profit,
            previousRevenue,
            previousExpenses: previousExpense,
            previousProfit,
          }
        : null,
      activity: {
        newCustomers,
        newLeads,
        overdueFollowUps,
        overdueTasks,
        atRiskProjects: atRiskProjects.length,
        importantServiceRequests: serviceRequests,
      },
      alerts,
      recommendations,
      meaningful:
        alerts.length > 0 ||
        Boolean(newCustomers || newLeads || serviceRequests),
    };
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
    return Promise.all(
      goals.map(async (goal) => {
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
    const required = (
      ["MONTHLY_REVENUE", "EXPENSE_LIMIT"] as BusinessGoalType[]
    ).includes(input.type as BusinessGoalType)
      ? "FINANCE_MANAGE"
      : input.type === "PROJECT_COMPLETION"
        ? "PROJECT_MANAGE"
        : "CRM_MANAGE";
    if (!this.can(context, required))
      throw new AppError(
        403,
        "You do not have permission to create this goal.",
        "FORBIDDEN",
      );
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
