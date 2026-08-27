import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AutomationPolicyInput, SimulatePolicyInput } from "./automation-policy.validation.js";

const policyInclude = { _count: { select: { executions: true } } } as const;

function matches(conditions: Record<string, unknown>, payload: Record<string, unknown>) {
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, payload);
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
}

export class AutomationPolicyService {
  async overview(organizationId: string) {
    const [policies, executions] = await Promise.all([
      prisma.automationPolicy.findMany({ where: { organizationId, archivedAt: null }, include: policyInclude, orderBy: [{ priority: "asc" }, { createdAt: "desc" }] }),
      prisma.automationPolicyExecution.findMany({ where: { organizationId }, include: { policy: { select: { id: true, name: true, actionCode: true, executionMode: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { policies, executions, metrics: { active: policies.filter((item) => item.status === "ACTIVE").length, awaitingApproval: executions.filter((item) => item.status === "AWAITING_APPROVAL").length, completed: executions.filter((item) => item.status === "COMPLETED").length, failed: executions.filter((item) => item.status === "FAILED").length } };
  }

  async save(organizationId: string, actorUserId: string, id: string | null, input: AutomationPolicyInput) {
    if (input.executionMode === "AUTOMATIC" && !["ROUTE_INQUIRY", "GENERATE_SCHOOL_COVERAGE_PLAN", "PREPARE_GUARDIAN_ABSENCE_ALERTS", "PREPARE_FEE_REMINDERS", "CREATE_INTERNAL_TASK", "CREATE_LEAD_TO_CASH_PIPELINE"].includes(input.actionCode))
      throw new AppError(400, "This action cannot run automatically. Use assisted or approval-required mode.", "UNSAFE_AUTOMATIC_ACTION");
    const data = { ...input, conditions: input.conditions as Prisma.InputJsonValue, actionConfig: input.actionConfig as Prisma.InputJsonValue, updatedById: actorUserId };
    if (!id) return prisma.automationPolicy.create({ data: { ...data, organizationId, createdById: actorUserId }, include: policyInclude });
    const current = await prisma.automationPolicy.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!current) throw new AppError(404, "Automation policy was not found.", "POLICY_NOT_FOUND");
    return prisma.automationPolicy.update({ where: { id: current.id }, data, include: policyInclude });
  }

  async archive(organizationId: string, actorUserId: string, id: string) {
    const result = await prisma.automationPolicy.updateMany({ where: { id, organizationId, archivedAt: null }, data: { status: "ARCHIVED", archivedAt: new Date(), updatedById: actorUserId } });
    if (result.count !== 1) throw new AppError(404, "Automation policy was not found.", "POLICY_NOT_FOUND");
  }

  async evaluate(organizationId: string, actorUserId: string, input: SimulatePolicyInput, options: { simulation?: boolean; forceApproval?: boolean; actionCodes?: string[] } = {}) {
    const policies = await prisma.automationPolicy.findMany({ where: { organizationId, eventCode: input.eventCode, status: "ACTIVE", archivedAt: null, ...(options.actionCodes?.length ? { actionCode: { in: options.actionCodes } } : {}) }, orderBy: { priority: "asc" } });
    const now = new Date();
    for (const policy of policies) {
      if (!matches(policy.conditions as Record<string, unknown>, input.payload)) continue;
      if (policy.cooldownMinutes && policy.lastTriggeredAt && now.getTime() - policy.lastTriggeredAt.getTime() < policy.cooldownMinutes * 60000) continue;
      if (input.dedupeKey) {
        const duplicate = await prisma.automationPolicyExecution.findFirst({ where: { organizationId, policyId: policy.id, dedupeKey: input.dedupeKey } });
        if (duplicate) return { matched: true, duplicate: true, execution: duplicate };
      }
      const simulation = options.simulation ?? true;
      const status = options.forceApproval || policy.executionMode === "APPROVAL_REQUIRED" ? "AWAITING_APPROVAL" : policy.executionMode === "AUTOMATIC" ? "COMPLETED" : "MATCHED";
      const execution = await prisma.$transaction(async (tx) => {
        const record = await tx.automationPolicyExecution.create({ data: { organizationId, policyId: policy.id, eventCode: input.eventCode, sourceType: input.sourceType, sourceId: input.sourceId, dedupeKey: input.dedupeKey, status, input: input.payload as Prisma.InputJsonValue, output: status === "COMPLETED" ? { actionCode: policy.actionCode, simulated: simulation } : Prisma.JsonNull, completedAt: status === "COMPLETED" ? now : null, createdById: actorUserId }, include: { policy: true } });
        await tx.automationPolicy.update({ where: { id: policy.id }, data: { lastTriggeredAt: now, updatedById: actorUserId } });
        await tx.auditEvent.create({ data: { organizationId, actorType: simulation ? "USER" : "SYSTEM", actorUserId: simulation ? actorUserId : null, serviceCode: policy.serviceCode, actionCode: "AUTOMATION_POLICY_MATCHED", sourceType: "AUTOMATION_POLICY_EXECUTION", sourceId: record.id, summary: `Policy ${policy.name} matched ${input.eventCode}.`, afterState: { status, actionCode: policy.actionCode }, metadata: { executionMode: policy.executionMode, simulation } } });
        return record;
      });
      return { matched: true, duplicate: false, execution };
    }
    return { matched: false, duplicate: false, execution: null };
  }
}
