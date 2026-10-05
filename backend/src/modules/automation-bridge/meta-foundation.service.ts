import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { ServiceRequestService } from "../service-requests/service-request.service.js";
import { disconnectMetaAsset, metaCapability, metaProviderFor, type MetaCapability } from "./meta-assets.service.js";

type Context = NonNullable<Express.Request["auth"]>;
const capabilities = metaCapability.options;
const relevantService = (capability: MetaCapability) => capability === "META_ADVERTISING" ? "MARKETING" : "LEADS";
export const metaHelpSchema = z.object({
  capability: metaCapability,
  step: z.enum(["START", "AUTHORIZATION", "ASSET_SELECTION", "VERIFICATION", "OTHER"]),
  category: z.enum(["ACCESS", "PERMISSION", "SETUP", "UNKNOWN"]),
  errorCategory: z.enum(["UNAVAILABLE", "EXPIRED", "MISSING_PERMISSION", "OTHER"]),
}).strict();
export type MetaHelpInput = z.infer<typeof metaHelpSchema>;

export class MetaFoundationService {
  private requests = new ServiceRequestService();
  private async access(context: Context, capability: MetaCapability, manage: boolean) {
    const automationMode = await verifyServiceAccess(context, "AUTOMATION", manage ? "AUTOMATION_MANAGE" : "AUTOMATION_VIEW");
    const mode = await verifyServiceAccess(context, relevantService(capability));
    if (manage && mode === "READ_ONLY") throw new AppError(403, "This service is assigned as read only.", "MEMBER_SERVICE_READ_ONLY");
    return automationMode === "READ_WRITE" && mode === "READ_WRITE";
  }

  async overview(context: Context) {
    const items = [];
    for (const capability of capabilities) {
      let writable = false;
      try { writable = await this.access(context, capability, false); }
      catch (error) {
        if (!(error instanceof AppError) || error.statusCode !== 403) throw error;
        items.push({ capability, state: "SERVICE_UNAVAILABLE", canManage: false, connectorId: null });
        continue;
      }
      const connector = await prisma.integrationConnector.findFirst({ where: { organizationId: context.organizationId, type: "SOCIAL", provider: metaProviderFor(capability), deletedAt: null, status: { not: "ARCHIVED" } }, select: { id: true, status: true, configuration: true, credentialStatus: true, credentialExpiresAt: true, credentialsConfiguredAt: true, accessTokenEncrypted: true, credentialKeyVersion: true, externalAccountRef: true } });
      const config = (connector?.configuration ?? {}) as { metaSetupMode?: string };
      const instagramReady = capability === "INSTAGRAM_MESSAGES" && connector?.status === "ACTIVE" && connector.credentialStatus === "PRIVATE_TEST_READY";
      const asset = instagramReady && connector.accessTokenEncrypted && connector.credentialKeyVersion === 2 && connector.credentialsConfiguredAt && connector.credentialExpiresAt && connector.credentialExpiresAt > new Date() && connector.externalAccountRef
        ? await prisma.metaConnectedAsset.findFirst({ where: { organizationId: context.organizationId, connectorId: connector.id, capability: "INSTAGRAM_MESSAGES", provider: "META", loginVariant: "INSTAGRAM_LOGIN", assetType: "INSTAGRAM_ACCOUNT", assetId: connector.externalAccountRef, routingStatus: "ACTIVE", releasedAt: null, webhookCutoverAt: { gte: connector.credentialsConfiguredAt } }, select: { grantedScopes: true } })
        : null;
      const scopes = asset?.grantedScopes;
      const scopesReady = Array.isArray(scopes) && ["instagram_business_basic", "instagram_business_manage_messages"].every(scope => scopes.includes(scope));
      const state = !connector ? "NOT_CONFIGURED" : connector.status === "PAUSED" ? "DISCONNECTED" : connector.credentialExpiresAt && connector.credentialExpiresAt <= new Date() ? "RECONNECT_REQUIRED" : connector.credentialStatus === "RECONNECT_REQUIRED" ? "RECONNECT_REQUIRED" : capability === "INSTAGRAM_MESSAGES" && connector.status === "ACTIVE" ? instagramReady && scopesReady ? "PRIVATE_TEST_READY" : "RESET_REQUIRED" : connector.credentialStatus === "NEEDS_ATTENTION" ? "NEEDS_ATTENTION" : config.metaSetupMode === "TEST" ? "TEST_MODE" : connector.status === "DRAFT" ? "SETUP_IN_PROGRESS" : "INTERNAL_FOUNDATION_READY";
      items.push({ capability, state, canManage: writable && context.permissions.includes("AUTOMATION_MANAGE"), connectorId: connector?.id ?? null });
    }
    return { providerAvailable: Boolean(env.META_INSTAGRAM_CONNECT_ENABLED && env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID === context.organizationId && env.META_INSTAGRAM_APP_ID && env.META_INSTAGRAM_APP_SECRET && env.META_INSTAGRAM_REDIRECT_URI && env.BRIDGE_ENCRYPTION_KEY_V2), inboundAvailable: Boolean(env.META_INSTAGRAM_DM_ENABLED && env.META_INSTAGRAM_SIGNATURE_PROVEN && env.EXTERNAL_CHANNELS_ENABLED), approvalReady: false, items };
  }

  async initialize(context: Context, capability: MetaCapability) {
    await this.access(context, capability, true);
    const provider = metaProviderFor(capability);
    const where = { organizationId: context.organizationId, type: "SOCIAL" as const, provider, deletedAt: null, status: { not: "ARCHIVED" as const } };
    const existing = await prisma.integrationConnector.findFirst({ where, select: { id: true, status: true, credentialStatus: true } });
    if (existing) {
      if (existing.status === "PAUSED" && existing.credentialStatus === "DISCONNECTED") {
        const prepared = await prisma.integrationConnector.updateMany({ where: { id: existing.id, organizationId: context.organizationId, status: "PAUSED", credentialStatus: "DISCONNECTED" }, data: { status: "DRAFT", credentialStatus: "NOT_CONFIGURED", reauthorizationReason: "CUSTOMER_RECONNECT_REQUESTED", updatedById: context.userId } });
        if (prepared.count) await prisma.auditEvent.create({ data: { organizationId: context.organizationId, actorType: "USER", actorUserId: context.userId, serviceCode: "AUTOMATION", actionCode: "META_RECONNECT_PREPARED", sourceType: "INTEGRATION_CONNECTOR", sourceId: existing.id, summary: "Meta connection prepared for a new authorization; no provider access exists." } });
      }
      return { connectorId: existing.id, created: false, providerAvailable: false };
    }
    try {
      const connector = await prisma.integrationConnector.create({ data: { organizationId: context.organizationId, createdById: context.userId, updatedById: context.userId, name: { INSTAGRAM_MESSAGES: "Instagram Messages", META_LEAD_ADS: "Meta Lead Ads", META_ADVERTISING: "Meta Advertising" }[capability], type: "SOCIAL", provider, status: "DRAFT", mode: "MANUAL_APPROVAL", configuration: { metaFoundationCapability: capability }, credentialStatus: "NOT_CONFIGURED" }, select: { id: true } });
      await prisma.auditEvent.create({ data: { organizationId: context.organizationId, actorType: "USER", actorUserId: context.userId, serviceCode: "AUTOMATION", actionCode: "META_FOUNDATION_INITIALIZED", sourceType: "INTEGRATION_CONNECTOR", sourceId: connector.id, summary: "Internal Meta connection record prepared; provider authorization is unavailable.", metadata: { capability } } });
      return { connectorId: connector.id, created: true, providerAvailable: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const concurrent = await prisma.integrationConnector.findFirst({ where, select: { id: true } });
      if (!concurrent) throw error;
      return { connectorId: concurrent.id, created: false, providerAvailable: false };
    }
  }

  async disconnect(context: Context, capability: MetaCapability, connectorId: string) {
    await this.access(context, capability, true);
    const connector = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId: context.organizationId, provider: metaProviderFor(capability), deletedAt: null }, select: { id: true } });
    if (!connector) throw new AppError(404, "Meta connection is unavailable.", "META_CONNECTION_UNAVAILABLE");
    return disconnectMetaAsset(context.organizationId, connectorId, context.userId);
  }

  async requestHelp(context: Context, input: MetaHelpInput) {
    await this.access(context, input.capability, true);
    const subject = `Meta connection help: ${input.capability}`;
    const description = `Capability: ${input.capability}. Step: ${input.step}. Permission category: ${input.category}. Error category: ${input.errorCategory}. No credentials or message content attached.`;
    try {
      const request = await this.requests.create(context.organizationId, context.userId, { category: input.capability === "META_ADVERTISING" ? "MARKETING" : "AUTOMATION", subject, description, priority: "MEDIUM" }, input.capability);
      return { requestId: request.id, created: true, responseCommitmentHours: 24 };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await prisma.providerServiceRequest.findFirst({ where: { organizationId: context.organizationId, metaHelpCapability: input.capability, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELED"] } }, select: { id: true } });
      if (!existing) throw error;
      return { requestId: existing.id, created: false, responseCommitmentHours: 24 };
    }
  }
}
