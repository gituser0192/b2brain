import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

export const metaCapability = z.enum(["INSTAGRAM_MESSAGES", "META_LEAD_ADS", "META_ADVERTISING"]);
export type MetaCapability = z.infer<typeof metaCapability>;
export const metaAsset = z.object({
  capability: metaCapability,
  provider: z.literal("META"),
  assetType: z.enum(["INSTAGRAM_ACCOUNT", "PAGE", "AD_ACCOUNT"]),
  assetId: z.string().regex(/^\d{5,32}$/),
}).strict().superRefine((value, ctx) => {
  const required = { INSTAGRAM_MESSAGES: "INSTAGRAM_ACCOUNT", META_LEAD_ADS: "PAGE", META_ADVERTISING: "AD_ACCOUNT" }[value.capability];
  if (value.assetType !== required) ctx.addIssue({ code: "custom", path: ["assetType"], message: "Asset type does not match capability." });
});

export const metaProviderFor = (capability: MetaCapability) => ({ INSTAGRAM_MESSAGES: "META_INSTAGRAM_DM", META_LEAD_ADS: "META_LEAD_ADS", META_ADVERTISING: "META_ADVERTISING" })[capability];
const servicesFor = (capability: MetaCapability) => capability === "META_ADVERTISING" ? ["AUTOMATION", "MARKETING"] : ["AUTOMATION", "LEADS"];

// Called only after the platform-level webhook signature has been verified.
export async function resolveMetaAsset(input: z.input<typeof metaAsset>, expectedOrganizationId?: string, db: Pick<PrismaClient, "metaConnectedAsset" | "organizationService" | "organizationPlan"> = prisma) {
  const asset = metaAsset.parse(input);
  const matches = await db.metaConnectedAsset.findMany({
    where: { ...asset, routingStatus: "ACTIVE", releasedAt: null, connector: { type: "SOCIAL", provider: metaProviderFor(asset.capability), status: "ACTIVE", deletedAt: null }, organization: { status: "ACTIVE", deletedAt: null } },
    select: { id: true, organizationId: true, connectorId: true }, take: 2,
  });
  if (matches.length !== 1 || (expectedOrganizationId && matches[0]!.organizationId !== expectedOrganizationId)) throw new AppError(404, "Meta connection is unavailable.", "META_ASSET_UNAVAILABLE");
  const match = matches[0]!;
  const [enabled, plan] = await Promise.all([
    db.organizationService.count({ where: { organizationId: match.organizationId, status: "ENABLED", deletedAt: null, service: { code: { in: servicesFor(asset.capability) }, status: "ACTIVE", archivedAt: null } } }),
    db.organizationPlan.findUnique({ where: { organizationId: match.organizationId }, select: { status: true, trialEndsAt: true, expiresAt: true } }),
  ]);
  if (enabled !== servicesFor(asset.capability).length || (plan && (["PAST_DUE", "CANCELED", "EXPIRED"].includes(plan.status) || (plan.status === "TRIAL" && plan.trialEndsAt && plan.trialEndsAt <= new Date()) || (plan.expiresAt && plan.expiresAt <= new Date())))) throw new AppError(404, "Meta connection is unavailable.", "META_ASSET_UNAVAILABLE");
  return match;
}

export async function disconnectMetaAsset(organizationId: string, connectorId: string, actorUserId: string) {
  return prisma.$transaction(async tx => {
    const connector = await tx.integrationConnector.findFirst({ where: { id: connectorId, organizationId, type: "SOCIAL", provider: { in: ["META_INSTAGRAM_DM", "META_LEAD_ADS", "META_ADVERTISING"] }, deletedAt: null }, select: { id: true } });
    if (!connector) throw new AppError(404, "Meta connection is unavailable.", "META_ASSET_UNAVAILABLE");
    await tx.metaConnectedAsset.updateMany({ where: { organizationId, connectorId, releasedAt: null }, data: { routingStatus: "INACTIVE", disconnectedAt: new Date(), releasedAt: new Date() } });
    await tx.integrationAuthorizationState.updateMany({ where: { organizationId, connectorId, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.integrationConnector.update({ where: { id: connectorId }, data: { status: "PAUSED", accessTokenEncrypted: null, appSecretEncrypted: null, credentialsConfiguredAt: null, credentialStatus: "DISCONNECTED", reauthorizationReason: "CUSTOMER_DISCONNECTED", disconnectedAt: new Date(), providerRevokedAt: null, updatedById: actorUserId } });
    await tx.auditEvent.create({ data: { organizationId, actorType: "USER", actorUserId, serviceCode: "AUTOMATION", actionCode: "META_CONNECTION_DISCONNECTED", sourceType: "INTEGRATION_CONNECTOR", sourceId: connectorId, summary: "Meta connection disabled locally. Provider revocation is not confirmed.", metadata: { providerRevoked: false } } });
    return { disconnected: true, providerRevoked: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
