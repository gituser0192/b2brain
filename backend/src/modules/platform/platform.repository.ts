import { prisma } from "../../database/prisma.js";

export class PlatformRepository {
  listOrganizations() {
    return prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        memberships: {
          where: { role: { code: "ORGANIZATION_OWNER" }, status: { not: "REMOVED" } },
          select: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, isPlatformAdmin: true } } },
          take: 1,
        },
        organizationServices: {
          where: { status: "ENABLED", deletedAt: null },
          select: { serviceId: true, enabledAt: true },
        },
        organizationPlan: { include: { plan: { select: { id: true, code: true, name: true } } } },
        serviceOverrides: { select: { serviceId: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listServices() {
    return prisma.service.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { organizationServices: { where: { status: "ENABLED", deletedAt: null } } } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  listPlans() {
    return prisma.servicePlan.findMany({
      include: { services: { include: { service: { select: { id: true, code: true, name: true } } } }, _count: { select: { organizations: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  }

  listInvitations() {
    return prisma.platformInvitation.findMany({
      where: { status: "PENDING" },
      include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  expireDuePlans() {
    const now = new Date();
    return prisma.organizationPlan.updateMany({ where: { status: { in: ["ACTIVE", "TRIAL"] }, OR: [{ expiresAt: { lte: now } }, { status: "TRIAL", trialEndsAt: { lte: now } }] }, data: { status: "EXPIRED" } });
  }

  findAccountByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { role: { code: "ORGANIZATION_OWNER" }, status: { not: "REMOVED" } },
          include: { organization: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async createInvitation(email: string, organizationName: string, invitedById: string, tokenHash: string, expiresAt: Date, type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION", organizationId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.platformInvitation.updateMany({ where: { email, status: "PENDING" }, data: { status: "REVOKED" } });
      return tx.platformInvitation.create({ data: { email, organizationName, invitedById, tokenHash, expiresAt, type, ...(organizationId ? { organizationId } : {}) } });
    });
  }

  revokeInvitation(id: string) {
    return prisma.platformInvitation.updateMany({ where: { id, status: "PENDING" }, data: { status: "REVOKED" } });
  }

  findOrganization(id: string) {
    return prisma.organization.findFirst({ where: { id, deletedAt: null } });
  }

  organizationHasPlatformAdmin(organizationId: string) {
    return prisma.organizationMembership.findFirst({
      where: { organizationId, status: { not: "REMOVED" }, user: { isPlatformAdmin: true, deletedAt: null } },
      select: { id: true },
    });
  }

  findService(id: string) {
    return prisma.service.findFirst({ where: { id, archivedAt: null } });
  }

  setOrganizationAccess(organizationId: string, status: "ACTIVE" | "SUSPENDED") {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({ where: { id: organizationId, deletedAt: null }, data: { status } });
      if (status === "SUSPENDED") {
        const memberships = await tx.organizationMembership.findMany({ where: { organizationId }, select: { id: true } });
        await tx.refreshSession.updateMany({ where: { membershipId: { in: memberships.map((item) => item.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return organization;
    });
  }

  removeOrganization(organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const memberships = await tx.organizationMembership.findMany({ where: { organizationId }, select: { id: true } });
      await tx.refreshSession.updateMany({ where: { membershipId: { in: memberships.map((item) => item.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.organizationService.updateMany({ where: { organizationId, deletedAt: null }, data: { status: "DISABLED", disabledAt: new Date(), deletedAt: new Date() } });
      return tx.organization.update({ where: { id: organizationId, deletedAt: null }, data: { status: "DISABLED", deletedAt: new Date() } });
    });
  }

  async setOrganizationService(organizationId: string, serviceId: string, enabled: boolean, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const plan = await tx.organizationPlan.findUnique({ where: { organizationId }, include: { plan: { include: { services: { select: { serviceId: true } } } } } });
      if (plan) {
        const included = plan.plan.services.some((item) => item.serviceId === serviceId);
        if (included === enabled) await tx.organizationServiceOverride.deleteMany({ where: { organizationId, serviceId } });
        else await tx.organizationServiceOverride.upsert({ where: { organizationId_serviceId: { organizationId, serviceId } }, update: { type: enabled ? "ADD" : "REMOVE", createdById: actorUserId }, create: { organizationId, serviceId, type: enabled ? "ADD" : "REMOVE", createdById: actorUserId } });
      }
      const existing = await tx.organizationService.findUnique({ where: { organizationId_serviceId: { organizationId, serviceId } } });
      if (existing) return tx.organizationService.update({
        where: { organizationId_serviceId: { organizationId, serviceId } },
        data: enabled
          ? { status: "ENABLED", enabledAt: new Date(), disabledAt: null, deletedAt: null, updatedById: actorUserId }
          : { status: "DISABLED", disabledAt: new Date(), updatedById: actorUserId },
      });
      if (!enabled) return null;
      return tx.organizationService.create({ data: { organizationId, serviceId, createdById: actorUserId, updatedById: actorUserId } });
    });
  }

  savePlan(id: string | null, input: { code: string; name: string; description: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; serviceIds: string[] }, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const plan = id
        ? await tx.servicePlan.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description, status: input.status, archivedAt: input.status === "ARCHIVED" ? new Date() : null, updatedById: actorUserId } })
        : await tx.servicePlan.create({ data: { code: input.code, name: input.name, description: input.description, status: input.status, archivedAt: input.status === "ARCHIVED" ? new Date() : null, createdById: actorUserId, updatedById: actorUserId } });
      await tx.servicePlanItem.deleteMany({ where: { planId: plan.id } });
      if (input.serviceIds.length) await tx.servicePlanItem.createMany({ data: [...new Set(input.serviceIds)].map((serviceId) => ({ planId: plan.id, serviceId })) });
      const subscriptions = await tx.organizationPlan.findMany({ where: { planId: plan.id } });
      for (const subscription of subscriptions) {
        const overrides = await tx.organizationServiceOverride.findMany({ where: { organizationId: subscription.organizationId } });
        const effective = new Set(input.status === "ACTIVE" && ["ACTIVE", "TRIAL"].includes(subscription.status) ? input.serviceIds : []);
        if (input.status === "ACTIVE" && ["ACTIVE", "TRIAL"].includes(subscription.status)) {
          for (const override of overrides) {
            if (override.type === "ADD") effective.add(override.serviceId);
            else effective.delete(override.serviceId);
          }
        }
        const existing = await tx.organizationService.findMany({ where: { organizationId: subscription.organizationId } });
        for (const serviceId of effective) {
          const record = existing.find((item) => item.serviceId === serviceId);
          if (record) await tx.organizationService.update({ where: { id: record.id }, data: { status: "ENABLED", enabledAt: new Date(), disabledAt: null, deletedAt: null, updatedById: actorUserId } });
          else await tx.organizationService.create({ data: { organizationId: subscription.organizationId, serviceId, createdById: actorUserId, updatedById: actorUserId } });
        }
        await tx.organizationService.updateMany({ where: { organizationId: subscription.organizationId, serviceId: { notIn: [...effective] }, status: "ENABLED" }, data: { status: "DISABLED", disabledAt: new Date(), updatedById: actorUserId } });
      }
      return plan;
    });
  }

  assignPlan(organizationId: string, input: { planId: string; status: "TRIAL" | "ACTIVE" | "CANCELED"; startsAt: Date; trialEndsAt: Date | null; expiresAt: Date | null; additionalServiceIds: string[]; removedServiceIds: string[] }, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const plan = await tx.servicePlan.findFirst({ where: { id: input.planId, status: "ACTIVE", archivedAt: null }, include: { services: { select: { serviceId: true } } } });
      if (!plan) throw new Error("PLAN_NOT_ACTIVE");
      const base = new Set(plan.services.map((item) => item.serviceId));
      const effective = new Set([...base, ...input.additionalServiceIds]);
      for (const serviceId of input.removedServiceIds) effective.delete(serviceId);
      if (input.status === "CANCELED") effective.clear();
      await tx.organizationPlan.upsert({ where: { organizationId }, update: { planId: plan.id, status: input.status, startsAt: input.startsAt, trialEndsAt: input.trialEndsAt, expiresAt: input.expiresAt, updatedById: actorUserId }, create: { organizationId, planId: plan.id, status: input.status, startsAt: input.startsAt, trialEndsAt: input.trialEndsAt, expiresAt: input.expiresAt, assignedById: actorUserId, updatedById: actorUserId } });
      await tx.organizationServiceOverride.deleteMany({ where: { organizationId } });
      const overrides = [
        ...input.additionalServiceIds.filter((id) => !base.has(id)).map((serviceId) => ({ organizationId, serviceId, type: "ADD" as const, createdById: actorUserId })),
        ...input.removedServiceIds.filter((id) => base.has(id)).map((serviceId) => ({ organizationId, serviceId, type: "REMOVE" as const, createdById: actorUserId })),
      ];
      if (overrides.length) await tx.organizationServiceOverride.createMany({ data: overrides });
      const existing = await tx.organizationService.findMany({ where: { organizationId } });
      for (const serviceId of effective) {
        const record = existing.find((item) => item.serviceId === serviceId);
        if (record) await tx.organizationService.update({ where: { id: record.id }, data: { status: "ENABLED", enabledAt: new Date(), disabledAt: null, deletedAt: null, updatedById: actorUserId } });
        else await tx.organizationService.create({ data: { organizationId, serviceId, createdById: actorUserId, updatedById: actorUserId } });
      }
      await tx.organizationService.updateMany({ where: { organizationId, serviceId: { notIn: [...effective] }, status: "ENABLED" }, data: { status: "DISABLED", disabledAt: new Date(), updatedById: actorUserId } });
      return tx.organizationPlan.findUnique({ where: { organizationId }, include: { plan: true } });
    });
  }
}
