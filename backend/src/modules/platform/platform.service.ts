import { AppError } from "../../shared/errors/app-error.js";
import { PlatformRepository } from "./platform.repository.js";
import { hashPlatformInvitationToken, newPlatformInvitationToken, platformInvitationExpiry } from "./platform.tokens.js";
import type { CreatePlatformInvitationInput, OrganizationPlanAssignmentInput, ServicePlanInput, SubscriptionPaymentInput } from "./platform.validation.js";
import type { OrganizationAccessInput } from "./platform.validation.js";
import { EmailService } from "../../shared/email/email.service.js";
import { env } from "../../config/env.js";

export class PlatformService {
  constructor(private readonly repository = new PlatformRepository(), private readonly email = new EmailService()) {}

  async overview() {
    await this.repository.expireDuePlans();
    const [organizations, services, invitations, plans] = await Promise.all([this.repository.listOrganizations(), this.repository.listServices(), this.repository.listInvitations(), this.repository.listPlans()]);
    return {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt,
        activeMemberCount: organization._count.memberships,
        enabledServiceIds: organization.organizationPlan && ["PAST_DUE", "EXPIRED", "CANCELED"].includes(organization.organizationPlan.status) ? [] : organization.organizationServices.map((item) => item.serviceId),
        owner: organization.memberships[0]?.user ?? null,
        plan: organization.organizationPlan ? { ...organization.organizationPlan, overrides: organization.serviceOverrides } : null,
      })),
      services: services.map((service) => ({
        id: service.id,
        code: service.code,
        name: service.name,
        description: service.description,
        status: service.status,
        iconKey: service.iconKey,
        routePath: service.routePath,
        enabledOrganizationCount: service._count.organizationServices,
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        organizationName: invitation.organizationName,
        status: invitation.expiresAt <= new Date() ? "EXPIRED" : invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        invitedBy: invitation.invitedBy,
        type: invitation.type,
      })),
      plans: plans.map((plan) => ({ id: plan.id, code: plan.code, name: plan.name, description: plan.description, status: plan.status, monthlyPrice: Number(plan.monthlyPrice), yearlyPrice: Number(plan.yearlyPrice), currency: plan.currency, serviceIds: plan.services.map((item) => item.serviceId), services: plan.services.map((item) => item.service), organizationCount: plan._count.organizations })),
    };
  }

  async createPlan(input: ServicePlanInput, actorUserId: string) {
    await this.validatePlanServices(input.serviceIds);
    return this.repository.savePlan(null, input, actorUserId);
  }

  async updatePlan(id: string, input: ServicePlanInput, actorUserId: string) {
    await this.validatePlanServices(input.serviceIds);
    return this.repository.savePlan(id, input, actorUserId).catch(() => { throw new AppError(404, "Service plan was not found or conflicts with an existing code.", "SERVICE_PLAN_NOT_SAVED"); });
  }

  private async validatePlanServices(serviceIds: string[]) {
    const services = await this.repository.listServices();
    const activeIds = new Set(services.filter((service) => service.status === "ACTIVE").map((service) => service.id));
    if (serviceIds.some((id) => !activeIds.has(id))) throw new AppError(400, "Plans can include only active platform services.", "INVALID_PLAN_SERVICE");
  }

  async assignPlan(organizationId: string, input: OrganizationPlanAssignmentInput, actorUserId: string) {
    const [organization, plans, services] = await Promise.all([this.repository.findOrganization(organizationId), this.repository.listPlans(), this.repository.listServices()]);
    if (!organization) throw new AppError(404, "Organization was not found.", "ORGANIZATION_NOT_FOUND");
    if (organization.status !== "ACTIVE") throw new AppError(409, "Approve the organization before assigning a plan.", "ORGANIZATION_NOT_ACTIVE");
    if (!plans.some((plan) => plan.id === input.planId && plan.status === "ACTIVE")) throw new AppError(400, "Select an active service plan.", "SERVICE_PLAN_NOT_ACTIVE");
    const serviceIds = new Set(services.filter((service) => service.status === "ACTIVE").map((service) => service.id));
    if ([...input.additionalServiceIds, ...input.removedServiceIds].some((id) => !serviceIds.has(id))) throw new AppError(400, "Plan overrides contain an unavailable service.", "INVALID_SERVICE_OVERRIDE");
    try { return await this.repository.assignPlan(organizationId, input, actorUserId); }
    catch (error) { if (error instanceof Error && error.message === "PLAN_NOT_ACTIVE") throw new AppError(409, "The selected plan is no longer active.", "SERVICE_PLAN_NOT_ACTIVE"); throw error; }
  }

  async recordPayment(organizationId: string, input: SubscriptionPaymentInput, actorUserId: string) {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw new AppError(404, "Organization was not found.", "ORGANIZATION_NOT_FOUND");
    if (organization.status !== "ACTIVE") throw new AppError(409, "Restore organization access before recording a renewal.", "ORGANIZATION_NOT_ACTIVE");
    try { return await this.repository.recordPayment(organizationId, input, actorUserId); }
    catch (error) { if (error instanceof Error && error.message === "PLAN_NOT_ASSIGNED") throw new AppError(409, "Assign a service plan before recording payment.", "PLAN_NOT_ASSIGNED"); throw error; }
  }

  async inviteOrganization(input: CreatePlatformInvitationInput, actorUserId: string) {
    const account = await this.repository.findAccountByEmail(input.email);
    const removedOwnerMembership = account?.memberships.find((membership) => membership.organization.status === "DISABLED" || membership.organization.deletedAt !== null);
    if (account?.isPlatformAdmin) throw new AppError(409, "A Super Admin account cannot be re-invited through organization onboarding.", "SUPER_ADMIN_ACCOUNT_PROTECTED");
    if (account && !removedOwnerMembership) throw new AppError(409, "This email already has an account. Restore its organization access instead.", "EMAIL_ALREADY_EXISTS", { email: "This email already belongs to an existing account." });
    const token = newPlatformInvitationToken();
    const type = removedOwnerMembership ? "REACTIVATE_ORGANIZATION" : "NEW_ORGANIZATION";
    const organizationName = removedOwnerMembership?.organization.name ?? input.organizationName;
    const invitation = await this.repository.createInvitation(input.email, organizationName, actorUserId, hashPlatformInvitationToken(token), platformInvitationExpiry(), type, removedOwnerMembership?.organizationId);
    const signupPath = `/signup?token=${encodeURIComponent(token)}`;
    const signupUrl = `${env.FRONTEND_URL}${signupPath}`;
    const delivery = await this.email.organizationInvitation(invitation.email, invitation.organizationName, signupPath);
    return {
      invitation: { id: invitation.id, email: invitation.email, organizationName: invitation.organizationName, status: invitation.status, expiresAt: invitation.expiresAt, type: invitation.type },
      signupPath,
      signupUrl,
      emailDelivered: delivery.delivered,
    };
  }

  async revokeInvitation(id: string) {
    const result = await this.repository.revokeInvitation(id);
    if (result.count !== 1) throw new AppError(404, "Pending organization invitation was not found.", "PLATFORM_INVITATION_NOT_FOUND");
  }

  async setOrganizationService(organizationId: string, serviceId: string, enabled: boolean, actorUserId: string) {
    const [organization, service] = await Promise.all([this.repository.findOrganization(organizationId), this.repository.findService(serviceId)]);
    if (!organization) throw new AppError(404, "Organization was not found.", "ORGANIZATION_NOT_FOUND");
    if (!service) throw new AppError(404, "Service was not found.", "SERVICE_NOT_FOUND");
    if (enabled && organization.status !== "ACTIVE") throw new AppError(409, "Approve the organization before assigning services.", "ORGANIZATION_NOT_ACTIVE");
    if (enabled && service.status !== "ACTIVE") throw new AppError(409, "Only active services can be enabled.", "SERVICE_NOT_ACTIVE");
    await this.repository.setOrganizationService(organizationId, serviceId, enabled, actorUserId);
    return { organizationId, serviceId, enabled };
  }

  async setOrganizationAccess(organizationId: string, input: OrganizationAccessInput) {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw new AppError(404, "Organization was not found.", "ORGANIZATION_NOT_FOUND");
    if (input.status === "SUSPENDED" && await this.repository.organizationHasPlatformAdmin(organizationId)) throw new AppError(409, "A Super Admin organization cannot be suspended. Add a separate recovery administrator before changing platform ownership.", "SUPER_ADMIN_ORGANIZATION_PROTECTED");
    await this.repository.setOrganizationAccess(organizationId, input.status);
    return { organizationId, status: input.status };
  }

  async removeOrganization(organizationId: string) {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw new AppError(404, "Organization was not found.", "ORGANIZATION_NOT_FOUND");
    if (await this.repository.organizationHasPlatformAdmin(organizationId)) throw new AppError(409, "A Super Admin organization cannot be removed.", "SUPER_ADMIN_ORGANIZATION_PROTECTED");
    await this.repository.removeOrganization(organizationId);
  }
}
