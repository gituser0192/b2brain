import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret, encryptSecret } from "./bridge.crypto.js";
import { disconnectMetaAsset } from "./meta-assets.service.js";
import { MetaAuthorizationStateService, requireCurrentAccess } from "./meta-authorization-state.service.js";
import { instagramAuthorizationUrl, OfficialInstagramLoginProvider, type InstagramLoginProvider } from "./instagram-login.provider.js";

type Context = { organizationId: string; membershipId: string; userId: string };
const capability = "INSTAGRAM_MESSAGES", variant = "INSTAGRAM_LOGIN";
const stateService = new MetaAuthorizationStateService();

export class InstagramLoginService {
  constructor(private readonly provider: InstagramLoginProvider = new OfficialInstagramLoginProvider()) {}

  private privateAccess(context: Context) {
    if (!env.META_INSTAGRAM_CONNECT_ENABLED || !env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID || env.META_INSTAGRAM_PRIVATE_ORGANIZATION_ID !== context.organizationId)
      throw new AppError(403, "Instagram connection is limited to the private test organization.", "INSTAGRAM_PRIVATE_ONLY");
  }

  async start(context: Context, connectorId: string) {
    this.privateAccess(context);
    await requireCurrentAccess(context, capability);
    // Check provider configuration before issuing a state that cannot be used.
    instagramAuthorizationUrl("configuration-check");
    const existing = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId: context.organizationId, provider: "META_INSTAGRAM_DM", deletedAt: null }, select: { status: true, credentialStatus: true, credentialExpiresAt: true } });
    if (existing?.status === "ACTIVE") {
      if (existing.credentialStatus !== "RECONNECT_REQUIRED" && (!existing.credentialExpiresAt || existing.credentialExpiresAt > new Date()))
        throw new AppError(409, "Disconnect the current connection before starting again.", "INSTAGRAM_ALREADY_CONNECTED");
      await disconnectMetaAsset(context.organizationId, connectorId, context.userId);
    }
    if (existing?.status === "PAUSED" || existing?.status === "ACTIVE") await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "PAUSED" }, data: { status: "DRAFT", credentialStatus: "NOT_CONFIGURED" } });
    const issued = await stateService.issue(context, connectorId, capability, variant, "/automation");
    return { authorizationUrl: instagramAuthorizationUrl(issued.state), expiresAt: issued.expiresAt };
  }

  async callback(context: Context, connectorId: string, state: string, code: string) {
    this.privateAccess(context);
    await stateService.consume(context, connectorId, capability, variant, state, "/automation");
    return this.completeConsumedCallback(context, connectorId, state, code);
  }

  async callbackFromRedirect(state: string, code: string) {
    const { context, connectorId } = await stateService.consumeRedirect(capability, variant, state, "/automation");
    this.privateAccess(context);
    return this.completeConsumedCallback(context, connectorId, state, code);
  }

  async cancelFromRedirect(state: string) {
    const { context } = await stateService.consumeRedirect(capability, variant, state, "/automation");
    this.privateAccess(context);
  }

  private async completeConsumedCallback(context: Context, connectorId: string, state: string, code: string) {
    const generation = createHash("sha256").update(state).digest("hex");
    const claimed = await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, provider: "META_INSTAGRAM_DM", status: "DRAFT", deletedAt: null, credentialStatus: { in: ["NOT_CONFIGURED", "NEEDS_ATTENTION", "DISCONNECTED"] } }, data: { credentialStatus: "AUTHORIZING", reauthorizationReason: generation } });
    if (claimed.count !== 1) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
    // No code/token/secret enters logs, audit metadata, frontend responses, or provider errors.
    let authorization;
    try { authorization = await this.provider.exchange(code); }
    catch (error) {
      await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "DRAFT", credentialStatus: "AUTHORIZING", reauthorizationReason: generation }, data: { credentialStatus: "NEEDS_ATTENTION", reauthorizationReason: "AUTHORIZATION_FAILED" } });
      throw error;
    }
    try {
    const owner = await prisma.metaConnectedAsset.findFirst({ where: { provider: "META", assetType: "INSTAGRAM_ACCOUNT", assetId: authorization.accountId, releasedAt: null }, select: { connectorId: true } });
    if (owner && owner.connectorId !== connectorId) throw new AppError(409, "This Instagram account already belongs to a connection.", "INSTAGRAM_ACCOUNT_OWNED");
    const encrypted = encryptSecret(authorization.token, 2, { organizationId: context.organizationId, connectorId });
    try {
      await prisma.$transaction(async tx => {
        const connector = await tx.integrationConnector.findFirst({ where: { id: connectorId, organizationId: context.organizationId, provider: "META_INSTAGRAM_DM", status: "DRAFT", credentialStatus: "AUTHORIZING", reauthorizationReason: generation, deletedAt: null }, select: { id: true, configuration: true } });
        if (!connector) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
        const existing = await tx.metaConnectedAsset.findFirst({ where: { connectorId, organizationId: context.organizationId, provider: "META", assetType: "INSTAGRAM_ACCOUNT", assetId: authorization.accountId, releasedAt: null }, select: { id: true } });
        if (existing) await tx.metaConnectedAsset.update({ where: { id: existing.id }, data: { loginVariant: variant, grantedScopes: authorization.scopes, routingStatus: "INACTIVE", lastValidatedAt: new Date(), webhookCutoverAt: null } });
        else await tx.metaConnectedAsset.create({ data: { organizationId: context.organizationId, connectorId, capability, provider: "META", loginVariant: variant, assetType: "INSTAGRAM_ACCOUNT", assetId: authorization.accountId, grantedScopes: authorization.scopes, routingStatus: "INACTIVE", lastValidatedAt: new Date() } });
        const stored = await tx.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, credentialStatus: "AUTHORIZING", reauthorizationReason: generation }, data: {
          accessTokenEncrypted: encrypted, credentialKeyVersion: 2, credentialStatus: "SUBSCRIPTION_PENDING", credentialExpiresAt: authorization.expiresAt,
          credentialsConfiguredAt: new Date(), credentialValidatedAt: new Date(), externalAccountRef: authorization.accountId,
          configuration: { ...(connector.configuration as object), instagramUsername: authorization.username ?? null, instagramScopes: authorization.scopes, instagramSubscriptionVerified: false } as Prisma.InputJsonValue,
          updatedById: context.userId,
        } });
        if (stored.count !== 1) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "This Instagram account already belongs to a connection.", "INSTAGRAM_ACCOUNT_OWNED");
      throw error;
    }
    let subscribed = false;
    try { subscribed = await this.provider.subscribe(authorization.accountId, authorization.token); } catch { /* Status remains honest. */ }
    if (!subscribed) {
      const failed = await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "DRAFT", credentialStatus: "SUBSCRIPTION_PENDING", reauthorizationReason: generation, accessTokenEncrypted: encrypted, externalAccountRef: authorization.accountId }, data: { credentialStatus: "NEEDS_ATTENTION", reauthorizationReason: "SUBSCRIPTION_FAILED" } });
      if (failed.count !== 1) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
      return { state: "NEEDS_ATTENTION", account: { username: authorization.username ?? null }, subscriptionVerified: false };
    }
    await prisma.$transaction(async tx => {
      const changed = await tx.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "DRAFT", credentialStatus: "SUBSCRIPTION_PENDING", reauthorizationReason: generation, accessTokenEncrypted: encrypted, credentialKeyVersion: 2, externalAccountRef: authorization.accountId }, data: { status: "ACTIVE", credentialStatus: "PRIVATE_TEST_READY", reauthorizationReason: null, credentialValidatedAt: new Date(), updatedById: context.userId } });
      if (changed.count !== 1) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
      const activated = await tx.metaConnectedAsset.updateMany({ where: { connectorId, organizationId: context.organizationId, provider: "META", assetType: "INSTAGRAM_ACCOUNT", assetId: authorization.accountId, routingStatus: "INACTIVE", releasedAt: null }, data: { routingStatus: "ACTIVE", lastValidatedAt: new Date(), webhookCutoverAt: new Date() } });
      if (activated.count !== 1) throw new AppError(409, "Connection setup changed; restart authorization.", "INSTAGRAM_SETUP_CHANGED");
      await tx.auditEvent.create({ data: { organizationId: context.organizationId, actorType: "USER", actorUserId: context.userId, serviceCode: "AUTOMATION", actionCode: "INSTAGRAM_PRIVATE_TEST_READY", sourceType: "INTEGRATION_CONNECTOR", sourceId: connectorId, summary: "Instagram account authorization and subscription completed for private testing." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { state: "PRIVATE_TEST_READY", account: { username: authorization.username ?? null }, subscriptionVerified: true };
    } catch (error) {
      await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "DRAFT", reauthorizationReason: generation, credentialStatus: { in: ["AUTHORIZING", "SUBSCRIPTION_PENDING"] } }, data: { credentialStatus: "NEEDS_ATTENTION", reauthorizationReason: "AUTHORIZATION_FAILED" } });
      throw error;
    }
  }

  async refresh(context: Context, connectorId: string) {
    this.privateAccess(context);
    await requireCurrentAccess(context, capability);
    const connector = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId: context.organizationId, provider: "META_INSTAGRAM_DM", status: "ACTIVE", deletedAt: null }, select: { accessTokenEncrypted: true, credentialKeyVersion: true, credentialValidatedAt: true, credentialExpiresAt: true, credentialStatus: true } });
    if (!connector?.accessTokenEncrypted || !["PRIVATE_TEST_READY", "NEEDS_ATTENTION"].includes(connector.credentialStatus)) throw new AppError(409, "Instagram reconnection is required.", "INSTAGRAM_RECONNECT_REQUIRED");
    const now = Date.now();
    if (!connector.credentialExpiresAt || connector.credentialExpiresAt.getTime() <= now) {
      const changed = await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "ACTIVE", credentialStatus: connector.credentialStatus, credentialKeyVersion: connector.credentialKeyVersion, accessTokenEncrypted: connector.accessTokenEncrypted, credentialExpiresAt: connector.credentialExpiresAt }, data: { credentialStatus: "RECONNECT_REQUIRED", reauthorizationReason: "TOKEN_EXPIRED" } });
      if (changed.count !== 1) throw new AppError(409, "Instagram connection changed during refresh.", "INSTAGRAM_SETUP_CHANGED");
      throw new AppError(409, "Instagram token expired. Reconnect the account.", "INSTAGRAM_RECONNECT_REQUIRED");
    }
    if (!connector.credentialValidatedAt || now - connector.credentialValidatedAt.getTime() < 24 * 60 * 60_000)
      throw new AppError(409, "Instagram token is not yet eligible for refresh.", "INSTAGRAM_REFRESH_NOT_ELIGIBLE");
    const token = decryptSecret(connector.accessTokenEncrypted, connector.credentialKeyVersion, { organizationId: context.organizationId, connectorId });
    let refreshed;
    try { refreshed = await this.provider.refresh(token); }
    catch (error) {
      const invalid = error instanceof AppError && error.code === "INSTAGRAM_PROVIDER_RECONNECT_REQUIRED";
      const changed = await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "ACTIVE", credentialStatus: connector.credentialStatus, credentialKeyVersion: connector.credentialKeyVersion, accessTokenEncrypted: connector.accessTokenEncrypted }, data: { credentialStatus: invalid ? "RECONNECT_REQUIRED" : "NEEDS_ATTENTION", reauthorizationReason: invalid ? "PROVIDER_CREDENTIAL_INVALID" : "PROVIDER_TEMPORARY_FAILURE" } });
      if (changed.count !== 1) throw new AppError(409, "Instagram connection changed during refresh.", "INSTAGRAM_SETUP_CHANGED");
      throw new AppError(invalid ? 409 : 502, invalid ? "Instagram reconnection is required." : "Instagram refresh is temporarily unavailable.", invalid ? "INSTAGRAM_RECONNECT_REQUIRED" : "INSTAGRAM_PROVIDER_FAILURE");
    }
    const changed = await prisma.integrationConnector.updateMany({ where: { id: connectorId, organizationId: context.organizationId, status: "ACTIVE", credentialStatus: connector.credentialStatus, credentialKeyVersion: connector.credentialKeyVersion, accessTokenEncrypted: connector.accessTokenEncrypted }, data: {
      accessTokenEncrypted: encryptSecret(refreshed.token, 2, { organizationId: context.organizationId, connectorId }), credentialKeyVersion: 2,
      credentialExpiresAt: refreshed.expiresAt, credentialValidatedAt: new Date(), credentialStatus: "PRIVATE_TEST_READY", reauthorizationReason: null,
    } });
    if (changed.count !== 1) throw new AppError(409, "Instagram connection changed during refresh.", "INSTAGRAM_SETUP_CHANGED");
    return { refreshed: true, expiresAt: refreshed.expiresAt };
  }
}
