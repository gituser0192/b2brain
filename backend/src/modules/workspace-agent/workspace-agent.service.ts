import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { ServiceRequestService } from "../service-requests/service-request.service.js";
import type { WorkspaceAgentMessage } from "./workspace-agent.validation.js";
import { WorkspaceAgentProactiveService } from "./workspace-agent.proactive.service.js";
import { routeWorkspaceRequest } from "./workspace-agent.router.js";

type Context = {
  organizationId: string;
  userId: string;
  membershipId: string;
  roleCode: string;
  permissions: string[];
};
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
const normalizePhone = (value: string) => value.replace(/\D/g, "");

export class WorkspaceAgentService {
  private readonly proactive = new WorkspaceAgentProactiveService();
  private async connector(context: Context) {
    const existing = await prisma.integrationConnector.findFirst({
      where: {
        organizationId: context.organizationId,
        provider: "B2BRAIN_WORKSPACE_AGENT",
        deletedAt: null,
      },
    });
    if (existing) return existing;
    return prisma.integrationConnector.create({
      data: {
        organizationId: context.organizationId,
        name: "Ask B² Brain",
        type: "WEBSITE",
        status: "ACTIVE",
        mode: "ASSISTED",
        provider: "B2BRAIN_WORKSPACE_AGENT",
        configuration: { setupProgress: {} },
        signingSecretHash: createHash("sha256")
          .update(randomBytes(24))
          .digest("hex"),
        createdById: context.userId,
        updatedById: context.userId,
      },
    });
  }

  private async finance(context: Context) {
    if (!context.permissions.includes("FINANCE_VIEW"))
      throw new AppError(
        403,
        "Finance access is not assigned to your account.",
        "FORBIDDEN",
      );
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const historyStart = new Date(start);
    historyStart.setUTCMonth(historyStart.getUTCMonth() - 5);
    const [organization, payments, expenses] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: context.organizationId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { currency: true },
      }),
      prisma.payment.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: null,
          paidAt: { gte: historyStart },
        },
        select: { amount: true, refundedAmount: true, paidAt: true },
      }),
      prisma.expense.findMany({
        where: {
          organizationId: context.organizationId,
          deletedAt: null,
          status: "RECORDED",
          expenseDate: { gte: historyStart },
        },
        select: { amount: true, expenseDate: true },
      }),
    ]);
    const monthly = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(historyStart);
      date.setUTCMonth(date.getUTCMonth() + index);
      const next = new Date(date);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const revenue = payments
        .filter((item) => item.paidAt >= date && item.paidAt < next)
        .reduce(
          (sum, item) =>
            sum + Number(item.amount) - Number(item.refundedAmount),
          0,
        );
      const spent = expenses
        .filter((item) => item.expenseDate >= date && item.expenseDate < next)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        month: date.toISOString().slice(0, 7),
        revenue,
        expenses: spent,
        profit: revenue - spent,
      };
    });
    const current = monthly.at(-1)!;
    const monthsWithData = monthly.filter(
      (item) => item.revenue !== 0 || item.expenses !== 0,
    );
    const margin =
      current.revenue > 0 ? (current.profit / current.revenue) * 100 : null;
    const score =
      monthsWithData.length < 2
        ? null
        : Math.max(
            0,
            Math.min(
              100,
              Math.round(
                50 + (margin ?? 0) * 0.8 + (current.profit >= 0 ? 15 : -20),
              ),
            ),
          );
    return {
      currency: organization?.currency ?? "INR",
      current,
      monthly,
      monthsWithData: monthsWithData.length,
      margin,
      score,
    };
  }

  private async health(context: Context) {
    const can = (permission: string) =>
      context.permissions.includes(permission);
    const [
      customers,
      overdueFollowUps,
      projects,
      pendingTasks,
      overdueTasks,
      finance,
    ] = await Promise.all([
      can("CRM_VIEW")
        ? prisma.customer.count({
            where: { organizationId: context.organizationId, deletedAt: null },
          })
        : null,
      can("CRM_ACTIVITY_VIEW")
        ? prisma.customerFollowUp.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "PENDING",
              dueAt: { lt: new Date() },
            },
          })
        : null,
      can("PROJECT_VIEW")
        ? prisma.project.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: "ACTIVE",
            },
          })
        : null,
      can("TASK_VIEW")
        ? prisma.projectTask.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: { notIn: ["COMPLETED", "CANCELED"] },
            },
          })
        : null,
      can("TASK_VIEW")
        ? prisma.projectTask.count({
            where: {
              organizationId: context.organizationId,
              deletedAt: null,
              status: { notIn: ["COMPLETED", "CANCELED"] },
              dueDate: { lt: new Date() },
            },
          })
        : null,
      can("FINANCE_VIEW") ? this.finance(context) : null,
    ]);
    const components = [
      finance?.score === null || finance?.score === undefined
        ? null
        : {
            name: "Financial health",
            score: finance.score,
            evidence: `${money(finance.current.revenue, finance.currency)} revenue and ${money(finance.current.profit, finance.currency)} profit this month.`,
          },
      customers === null
        ? null
        : {
            name: "Customer foundation",
            score: Math.min(100, 35 + customers * 5),
            evidence: `${customers} CRM customer${customers === 1 ? "" : "s"}.`,
          },
      overdueFollowUps === null
        ? null
        : {
            name: "Follow-up discipline",
            score: Math.max(0, 100 - overdueFollowUps * 15),
            evidence: `${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? "" : "s"}.`,
          },
      pendingTasks === null || overdueTasks === null
        ? null
        : {
            name: "Project execution",
            score:
              pendingTasks === 0
                ? 70
                : Math.max(0, 100 - (overdueTasks / pendingTasks) * 100),
            evidence: `${projects ?? 0} active projects, ${overdueTasks} overdue of ${pendingTasks} open tasks.`,
          },
    ].filter(
      (item): item is { name: string; score: number; evidence: string } =>
        Boolean(item),
    );
    const overall = components.length
      ? Math.round(
          components.reduce((sum, item) => sum + item.score, 0) /
            components.length,
        )
      : null;
    return {
      overall,
      components,
      period: "Current organization data through today",
      warnings: [
        ...(finance?.monthsWithData !== undefined && finance.monthsWithData < 2
          ? ["Insufficient financial history for a reliable trend score."]
          : []),
        ...(components.length < 3
          ? [
              "Some components are unavailable because data or permissions are missing.",
            ]
          : []),
      ],
      recommendations: [
        ...(overdueFollowUps
          ? ["Clear overdue customer follow-ups first."]
          : []),
        ...(overdueTasks
          ? ["Re-plan overdue project tasks and assign owners."]
          : []),
        ...(finance && finance.current.profit < 0
          ? [
              "Review the largest expense categories and protect near-term cash flow.",
            ]
          : []),
        ...(customers === 0
          ? ["Add real CRM customers and leads to improve visibility."]
          : []),
      ].slice(0, 3),
    };
  }

  private async createCustomer(context: Context, message: string) {
    if (!context.permissions.includes("CRM_CREATE"))
      throw new AppError(
        403,
        "You do not have permission to add CRM customers.",
        "FORBIDDEN",
      );
    const match = message.match(
      /add\s+([a-z][a-z .'-]{1,80}?)\s+(?:with\s+)?(?:phone(?:\s+number)?\s*)?(\+?\d[\d -]{6,16})\s*(?:to\s+crm)?/i,
    );
    if (!match)
      return {
        needsConfirmation: true,
        answer:
          "Please provide the customer name and phone number, for example: “Add Rahul with phone number 9876543210 to CRM.”",
      };
    const displayName = match[1]!.trim();
    const phone = normalizePhone(match[2]!);
    const existing = await prisma.customer.findFirst({
      where: { organizationId: context.organizationId, phone, deletedAt: null },
      select: { id: true, displayName: true },
    });
    if (existing)
      return {
        answer: `${existing.displayName} already exists in CRM with this phone number.`,
        records: [
          { type: "CUSTOMER", id: existing.id, label: existing.displayName },
        ],
      };
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          organizationId: context.organizationId,
          type: "PERSON",
          displayName,
          firstName: displayName,
          phone,
          status: "LEAD",
          notes: "Created by Ask B² Brain after an explicit user request.",
          createdById: context.userId,
          updatedById: context.userId,
        },
        select: { id: true, displayName: true },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: context.organizationId,
          actorType: "SYSTEM",
          actorUserId: context.userId,
          serviceCode: "CRM",
          actionCode: "WORKSPACE_AGENT_CUSTOMER_CREATED",
          sourceType: "CUSTOMER",
          sourceId: created.id,
          summary: `Ask B² Brain created CRM customer ${created.displayName} after an explicit request.`,
          metadata: {
            membershipId: context.membershipId,
            phoneLastFour: phone.slice(-4),
          },
        },
      });
      return created;
    });
    return {
      answer: `${customer.displayName} was added to CRM as a lead.`,
      records: [
        { type: "CUSTOMER", id: customer.id, label: customer.displayName },
      ],
    };
  }

  async message(context: Context, input: WorkspaceAgentMessage) {
    const startedAt = Date.now(),
      route = routeWorkspaceRequest(input.message);
    const connector = await this.connector(context);
    const duplicate = await prisma.integrationEvent.findFirst({
      where: {
        organizationId: context.organizationId,
        connectorId: connector.id,
        externalEventId: input.externalMessageId,
      },
      select: { id: true, payload: true, status: true },
    });
    if (duplicate && (duplicate.payload as { output?: object }).output)
      return {
        duplicate: true,
        eventId: duplicate.id,
        ...((duplicate.payload as { output?: object }).output ?? {}),
      };
    if (duplicate)
      throw new AppError(
        409,
        "This request is already being processed or previously failed safely.",
        "WORKSPACE_AGENT_REQUEST_RESERVED",
      );
    let event: { id: string };
    try {
      event = await prisma.integrationEvent.create({
        data: {
          organizationId: context.organizationId,
          connectorId: connector.id,
          externalEventId: input.externalMessageId,
          eventName: "workspace-agent.message",
          kind: "INQUIRY",
          status: "PROCESSING",
          signatureVerified: true,
          payload: {
            conversationId: input.conversationId,
            message: input.message,
          },
          payloadHash: createHash("sha256").update(input.message).digest("hex"),
          attemptCount: 1,
          createdById: context.userId,
          updatedById: context.userId,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "This request is already being processed.",
          "WORKSPACE_AGENT_REQUEST_RESERVED",
        );
      throw error;
    }
    const lower = input.message.toLowerCase();
    let output: Record<string, unknown>;
    if (route.intent === "CUSTOMER_CREATE")
      output = await this.createCustomer(context, input.message);
    else if (route.intent === "CUSTOMER_COUNT") {
      if (!context.permissions.includes("CRM_VIEW"))
        throw new AppError(
          403,
          "CRM access is not assigned to your account.",
          "FORBIDDEN",
        );
      const count = await prisma.customer.count({
        where: { organizationId: context.organizationId, deletedAt: null },
      });
      output = {
        answer: `Your organization has ${count} CRM customer${count === 1 ? "" : "s"}.`,
        metrics: [{ label: "CRM customers", value: count }],
      };
    } else if (route.intent === "DAILY_BRIEF") {
      const brief = await this.proactive.brief(context);
      output = {
        answer: brief.meaningful
          ? `Today's brief found ${brief.alerts.length} explainable alert${brief.alerts.length === 1 ? "" : "s"} and ${brief.recommendations.length} priority action${brief.recommendations.length === 1 ? "" : "s"}.`
          : "Today's brief found no meaningful changes requiring attention.",
        metrics: [
          { label: "Business health", value: brief.health.score ?? 0 },
          { label: "New customers", value: brief.activity.newCustomers ?? 0 },
          {
            label: "Overdue follow-ups",
            value: brief.activity.overdueFollowUps ?? 0,
          },
          { label: "Overdue tasks", value: brief.activity.overdueTasks ?? 0 },
        ],
        warnings: brief.health.missingData,
        managementSection: "brief",
      };
    } else if (route.intent === "GOAL_CREATE") {
      output = {
        answer:
          "Open Goals to choose a measurable goal type, target and date range. I will calculate progress and risk from your permitted organization data.",
        managementSection: "goals",
      };
    } else if (route.intent === "GOAL_LIST") {
      const goals = await this.proactive.goals(context);
      output = {
        answer: goals.length
          ? `You have ${goals.length} business goal${goals.length === 1 ? "" : "s"}. ${goals.filter((goal) => goal.risk === "HIGH").length} ${goals.filter((goal) => goal.risk === "HIGH").length === 1 ? "is" : "are"} currently at high risk.`
          : "No measurable business goals have been created yet.",
        metrics: [
          { label: "Goals", value: goals.length },
          {
            label: "High risk",
            value: goals.filter((goal) => goal.risk === "HIGH").length,
          },
        ],
        managementSection: "goals",
      };
    } else if (route.intent === "NEW_CUSTOMERS") {
      const brief = await this.proactive.brief(context);
      output = {
        answer: `Today your organization added ${brief.activity.newCustomers ?? 0} new customer${brief.activity.newCustomers === 1 ? "" : "s"}, including ${brief.activity.newLeads ?? 0} new lead${brief.activity.newLeads === 1 ? "" : "s"}.`,
        metrics: [
          {
            label: "New customers today",
            value: brief.activity.newCustomers ?? 0,
          },
          { label: "New leads today", value: brief.activity.newLeads ?? 0 },
        ],
        managementSection: "brief",
      };
    } else if (route.intent === "OVERDUE_WORK") {
      const brief = await this.proactive.brief(context);
      output = {
        answer: `There are ${brief.activity.overdueFollowUps ?? 0} overdue customer follow-up${brief.activity.overdueFollowUps === 1 ? "" : "s"} and ${brief.activity.overdueTasks ?? 0} overdue project task${brief.activity.overdueTasks === 1 ? "" : "s"}.`,
        metrics: [
          {
            label: "Overdue follow-ups",
            value: brief.activity.overdueFollowUps ?? 0,
          },
          { label: "Overdue tasks", value: brief.activity.overdueTasks ?? 0 },
        ],
        managementSection: "brief",
      };
    } else if (route.intent === "BUSINESS_HEALTH") {
      const health = await this.health(context);
      output = {
        answer:
          health.overall === null
            ? "There is not enough permitted business data to calculate a useful health score yet."
            : `Your explainable business health score is ${health.overall}/100.`,
        health,
      };
    } else if (route.intent === "FINANCE_SUMMARY") {
      const value = await this.finance(context);
      output = {
        answer: `This month: ${money(value.current.revenue, value.currency)} revenue, ${money(value.current.expenses, value.currency)} expenses and ${money(value.current.profit, value.currency)} profit.`,
        finance: value,
        warnings:
          value.monthsWithData < 2
            ? [
                "More financial history is needed for a reliable score or trend.",
              ]
            : [],
      };
    } else if (route.intent === "FORECAST") {
      const value = await this.finance(context);
      const observed = value.monthly.filter(
        (item) => item.revenue || item.expenses,
      );
      if (observed.length < 3)
        output = {
          answer:
            "I cannot produce a responsible forecast yet because fewer than three months contain financial data.",
          warnings: [
            "Add at least three months of real revenue and expense history.",
          ],
        };
      else {
        const recent = observed.slice(-3);
        const revenue =
          recent.reduce((sum, item) => sum + item.revenue, 0) / recent.length;
        const expenses =
          recent.reduce((sum, item) => sum + item.expenses, 0) / recent.length;
        output = {
          answer: `Based on the last ${recent.length} months, next-month revenue may be around ${money(revenue, value.currency)} with a cautious range of ${money(revenue * 0.8, value.currency)}–${money(revenue * 1.2, value.currency)}. This is not guaranteed.`,
          forecast: {
            method: "Three-month simple average",
            dateRange: `${recent[0]!.month} to ${recent.at(-1)!.month}`,
            revenueRange: [revenue * 0.8, revenue * 1.2],
            expenseRange: [expenses * 0.85, expenses * 1.15],
            confidence: "LOW_TO_MEDIUM",
            assumptions: [
              "Recent monthly patterns continue",
              "No exceptional events",
            ],
          },
        };
      }
    } else if (route.intent === "PRODUCT_HELP")
      output = {
        answer:
          "Open CRM from the left menu, choose “Add customer”, enter the real customer details and save. You can also tell me: “Add Rahul with phone number 9876543210 to CRM.”",
        records: [{ type: "NAVIGATION", id: "crm", label: "Open CRM" }],
      };
    else if (route.intent === "SETUP_GUIDANCE")
      output = {
        answer:
          "Let’s set up your business agent. Start by adding your business description, industry, services, pricing, hours, locations, goals and escalation preferences in the guided setup.",
        setup: { step: "BUSINESS_DESCRIPTION", completed: false },
      };
    else if (route.intent === "HUMAN_ESCALATION") {
      const request = await new ServiceRequestService().create(
        context.organizationId,
        context.userId,
        {
          category:
            lower.includes("refund") || lower.includes("payment")
              ? "FINANCE"
              : "TECHNICAL_SUPPORT",
          subject: "Ask B² Brain escalation",
          description: input.message,
          priority: lower.includes("security") ? "URGENT" : "HIGH",
        },
      );
      output = {
        answer:
          "This request requires the B² Brain human team. I created a tracked escalation without performing the sensitive action.",
        escalation: {
          id: request.id,
          requestNumber: request.requestNumber,
          status: "OPEN",
        },
      };
    } else
      output = {
        answer:
          "I can check business health, summarize finances, count CRM customers, forecast cautiously, explain B² Brain, create a customer from an explicit request, or escalate sensitive issues to the B² Brain team.",
        suggestions: [
          "Check my business health",
          "Summarize revenue, expenses and profit",
          "Count all CRM customers",
          "How do I add a customer in CRM?",
        ],
      };
    const payload = {
      conversationId: input.conversationId,
      message: input.message,
      output,
      diagnostics: {
        route: route.intent,
        processingPath: route.path,
        aiCalled: false,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        toolCalls: route.path === "DETERMINISTIC_FALLBACK" ? 0 : 1,
        responseTimeMs: Date.now() - startedAt,
      },
    };
    await prisma.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: "COMPLETED",
        payload: payload as Prisma.InputJsonValue,
        payloadHash: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        processedAt: new Date(),
        updatedById: context.userId,
      },
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: context.organizationId,
        actorType: "SYSTEM",
        actorUserId: context.userId,
        serviceCode: "WORKSPACE_AGENT",
        actionCode: "WORKSPACE_AGENT_REQUEST_COMPLETED",
        sourceType: "INTEGRATION_EVENT",
        sourceId: event.id,
        summary:
          "Ask B² Brain completed an authenticated deterministic workspace request.",
        metadata: {
          membershipId: context.membershipId,
          externalActionPerformed: false,
          route: route.intent,
          processingPath: route.path,
          aiCalled: false,
          responseTimeMs: Date.now() - startedAt,
        },
      },
    });
    return { duplicate: false, eventId: event.id, ...output };
  }

  async history(context: Context, conversationId: string) {
    const connector = await this.connector(context);
    const events = await prisma.integrationEvent.findMany({
      where: {
        organizationId: context.organizationId,
        connectorId: connector.id,
        eventName: "workspace-agent.message",
      },
      select: { id: true, payload: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return events
      .filter(
        (event) =>
          (event.payload as { conversationId?: string }).conversationId ===
            conversationId &&
          Boolean((event.payload as { output?: object }).output),
      )
      .map((event) => ({
        id: event.id,
        createdAt: event.createdAt,
        ...(event.payload as object),
      }));
  }

  async usage(context: Context) {
    const connector = await this.connector(context),
      monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const events = await prisma.integrationEvent.findMany({
      where: {
        organizationId: context.organizationId,
        connectorId: connector.id,
        eventName: "workspace-agent.message",
        createdAt: { gte: monthStart },
      },
      select: { payload: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const diagnostics: Array<{
      status: string;
      aiCalled?: unknown;
      inputTokens?: unknown;
      outputTokens?: unknown;
      estimatedCostUsd?: unknown;
      toolCalls?: unknown;
      processingPath?: unknown;
      responseTimeMs?: unknown;
    }> = events.map((event) => ({
      status: event.status,
      ...((event.payload as { diagnostics?: Record<string, unknown> })
        .diagnostics ?? {}),
    }));
    const number = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : 0;
    return {
      periodStart: monthStart,
      requests: events.length,
      aiRequests: diagnostics.filter((item) => item.aiCalled === true).length,
      deterministicRequests: diagnostics.filter(
        (item) => item.aiCalled === false,
      ).length,
      inputTokens: diagnostics.reduce(
        (sum, item) => sum + number(item.inputTokens),
        0,
      ),
      outputTokens: diagnostics.reduce(
        (sum, item) => sum + number(item.outputTokens),
        0,
      ),
      estimatedCostUsd: diagnostics.reduce(
        (sum, item) => sum + number(item.estimatedCostUsd),
        0,
      ),
      toolCalls: diagnostics.reduce(
        (sum, item) => sum + number(item.toolCalls),
        0,
      ),
      providerFailures: 0,
      fallbackUsage: diagnostics.filter(
        (item) => item.processingPath === "DETERMINISTIC_FALLBACK",
      ).length,
      averageResponseTimeMs: diagnostics.length
        ? Math.round(
            diagnostics.reduce(
              (sum, item) => sum + number(item.responseTimeMs),
              0,
            ) / diagnostics.length,
          )
        : 0,
      capped: events.length === 5000,
    };
  }

  async markFailed(context: Context, externalMessageId: string) {
    const connector = await this.connector(context);
    await prisma.integrationEvent.updateMany({
      where: {
        organizationId: context.organizationId,
        connectorId: connector.id,
        externalEventId: externalMessageId,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
        failureMessage:
          "Processing failed safely. Reuse of this request ID is blocked to prevent duplicate actions.",
        processedAt: new Date(),
        updatedById: context.userId,
      },
    });
  }
}
