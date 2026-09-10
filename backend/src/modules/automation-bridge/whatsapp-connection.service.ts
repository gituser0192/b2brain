import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { decryptSecret, encryptSecret } from "./bridge.crypto.js";
import {
  FakeWhatsappConnectionProvider,
  WHATSAPP_REQUIRED_SCOPES,
  type WhatsappBusinessChoice,
  type WhatsappConnectionProvider,
} from "./whatsapp-connection.provider.js";
import type {
  WhatsappAccountSelectionInput,
  WhatsappConnectionCallbackInput,
  WhatsappConnectionStartInput,
  WhatsappNumberSelectionInput,
} from "./whatsapp-connection.validation.js";

type Context = { organizationId: string; membershipId: string; userId: string };
type SafeAccount = Omit<WhatsappBusinessChoice, "token">;
type Config = {
  whatsappSetupMode?: "TEST";
  whatsappSetupState?: string;
  whatsappAuthorizedAccounts?: SafeAccount[];
  whatsappSelectedWabaId?: string;
  whatsappVerifiedBusinessName?: string;
  whatsappMaskedDisplayNumber?: string;
  whatsappVerifiedNumberName?: string;
  whatsappGrantedScopes?: string[];
  whatsappScopesValid?: boolean;
  whatsappAuthorizationExpiresAt?: string;
  whatsappAuthorizationVerifiedAt?: string;
  whatsappNumberVerifiedAt?: string;
  whatsappWebhookReady?: boolean;
  whatsappLastTestAt?: string;
  whatsappDisconnectedAt?: string;
};

const providerName = "META_WHATSAPP_TEST";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const connectorWhere = (context: Context, id: string) => ({
  id,
  organizationId: context.organizationId,
  type: "WHATSAPP" as const,
  provider: "META_WHATSAPP_CLOUD",
  deletedAt: null,
  status: { not: "ARCHIVED" as const },
});

export class WhatsappConnectionService {
  constructor(private readonly provider: WhatsappConnectionProvider = new FakeWhatsappConnectionProvider()) {}

  async status(context: Context, connectorId: string) {
    const connector = await this.connector(context, connectorId);
    const config = connector.configuration as Config;
    const expired = Boolean(config.whatsappAuthorizationExpiresAt && new Date(config.whatsappAuthorizationExpiresAt) <= new Date());
    return {
      connectorId,
      connectorStatus: connector.status,
      mode: this.provider.mode,
      setupState: expired && config.whatsappSetupState !== "DISCONNECTED" ? "EXPIRED" : config.whatsappSetupState ?? "NOT_CONFIGURED",
      accounts: config.whatsappAuthorizedAccounts ?? [],
      selectedAccount: config.whatsappSelectedWabaId ? {
        id: config.whatsappSelectedWabaId,
        verifiedBusinessName: config.whatsappVerifiedBusinessName ?? "Synthetic business",
      } : null,
      selectedNumber: connector.whatsappPhoneNumberId ? {
        maskedDisplayNumber: config.whatsappMaskedDisplayNumber ?? "Masked number unavailable",
        verifiedName: config.whatsappVerifiedNumberName ?? "Synthetic WhatsApp number",
      } : null,
      grantedScopes: config.whatsappGrantedScopes ?? [],
      permissionsValid: !expired && Boolean(config.whatsappScopesValid),
      webhookReady: !expired && Boolean(config.whatsappWebhookReady),
      authorizationVerifiedAt: config.whatsappAuthorizationVerifiedAt ?? null,
      numberVerifiedAt: config.whatsappNumberVerifiedAt ?? null,
      lastTestAt: config.whatsappLastTestAt ?? null,
      outboundEnabled: false,
      canActivateProduction: false,
    };
  }

  async start(context: Context, connectorId: string, input: WhatsappConnectionStartInput) {
    await this.connector(context, connectorId);
    const state = randomBytes(32).toString("base64url");
    const returnPath = input.returnPath ?? "/automation";
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await prisma.$transaction(async (tx) => {
      await tx.integrationAuthorizationState.create({
        data: { stateHash: hash(state), provider: providerName, ...context, connectorId, returnPath, expiresAt },
      });
      await tx.integrationConnector.update({
        where: { id: connectorId },
        data: { status: "DRAFT", configuration: { ...await this.config(tx, context, connectorId), whatsappSetupMode: "TEST", whatsappSetupState: "AUTHORIZATION_STARTED" } as Prisma.InputJsonValue, updatedById: context.userId },
      });
      await this.audit(tx, context, connectorId, "WHATSAPP_AUTHORIZATION_STARTED", "AUTHORIZATION_STARTED", "WhatsApp Business Test Mode authorization started.");
    });
    return { authorizationUrl: this.provider.authorize(state, returnPath, connectorId), expiresAt, mode: this.provider.mode };
  }

  async callback(context: Context, connectorId: string, input: WhatsappConnectionCallbackInput) {
    const now = new Date();
    const stateHash = hash(input.state);
    const authorization = await prisma.$transaction(async (tx) => {
      const consumed = await tx.integrationAuthorizationState.updateMany({
        where: {
          stateHash,
          provider: providerName,
          ...context,
          connectorId,
          consumedAt: null,
          expiresAt: { gt: now },
          organization: { status: "ACTIVE", deletedAt: null },
          user: { status: "ACTIVE", deletedAt: null },
          membership: { organizationId: context.organizationId, userId: context.userId, status: "ACTIVE" },
          connector: connectorWhere(context, connectorId),
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new AppError(400, "Authorization state is invalid or expired.", "WHATSAPP_AUTHORIZATION_STATE_INVALID");
      return tx.integrationAuthorizationState.findUniqueOrThrow({ where: { stateHash }, select: { returnPath: true } });
    });
    let exchanged: Awaited<ReturnType<WhatsappConnectionProvider["exchange"]>>;
    try {
      exchanged = await this.provider.exchange(input.code);
    } catch (error) {
      await this.failureAudit(context, connectorId, error instanceof AppError ? error.code : "WHATSAPP_AUTHORIZATION_FAILED");
      throw error instanceof AppError ? error : new AppError(400, "WhatsApp test authorization failed.", "WHATSAPP_AUTHORIZATION_FAILED");
    }
    const safeAccounts = exchanged.accounts.map(({ id, verifiedBusinessName, permissions, phoneNumbers }) => ({ id, verifiedBusinessName, permissions, phoneNumbers }));
    await prisma.$transaction(async (tx) => {
      const config = await this.config(tx, context, connectorId);
      await tx.integrationConnector.update({
        where: { id: connectorId },
        data: {
          status: "DRAFT",
          appSecretEncrypted: encryptSecret(JSON.stringify(exchanged.accounts.map(({ id, token }) => ({ id, token })))),
          configuration: { ...config, whatsappSetupMode: "TEST", whatsappSetupState: "AUTHORIZED", whatsappAuthorizedAccounts: safeAccounts, whatsappAuthorizationExpiresAt: exchanged.expiresAt, whatsappAuthorizationVerifiedAt: now.toISOString(), whatsappWebhookReady: false } as Prisma.InputJsonValue,
          updatedById: context.userId,
        },
      });
      await this.audit(tx, context, connectorId, "WHATSAPP_AUTHORIZATION_COMPLETED", "AUTHORIZED", "WhatsApp Business Test Mode authorization completed.");
    });
    return { returnPath: authorization.returnPath, accounts: safeAccounts, mode: this.provider.mode };
  }

  async selectAccount(context: Context, connectorId: string, input: WhatsappAccountSelectionInput) {
    const connector = await this.connector(context, connectorId);
    const config = connector.configuration as Config;
    const account = config.whatsappAuthorizedAccounts?.find((item) => item.id === input.wabaId);
    if (!account) throw new AppError(400, "The selected WhatsApp Business Account is unavailable.", "WHATSAPP_ACCOUNT_UNAVAILABLE");
    const validScopes = WHATSAPP_REQUIRED_SCOPES.every((scope) => account.permissions.includes(scope));
    await prisma.$transaction(async (tx) => {
      await tx.integrationConnector.update({ where: { id: connectorId }, data: { whatsappBusinessAccountId: account.id, whatsappPhoneNumberId: null, accessTokenEncrypted: null, credentialsConfiguredAt: null, status: "DRAFT", configuration: { ...config, whatsappSetupState: "ACCOUNT_SELECTED", whatsappSelectedWabaId: account.id, whatsappVerifiedBusinessName: account.verifiedBusinessName, whatsappGrantedScopes: account.permissions, whatsappScopesValid: validScopes, whatsappMaskedDisplayNumber: null, whatsappVerifiedNumberName: null, whatsappWebhookReady: false } as Prisma.InputJsonValue, updatedById: context.userId } });
      await this.audit(tx, context, connectorId, "WHATSAPP_ACCOUNT_SELECTED", "ACCOUNT_SELECTED", "A provider-authorized synthetic WhatsApp Business Account was selected.");
    });
    return { account: { id: account.id, verifiedBusinessName: account.verifiedBusinessName }, phoneNumbers: account.phoneNumbers, permissionsValid: validScopes };
  }

  async selectNumber(context: Context, connectorId: string, input: WhatsappNumberSelectionInput) {
    const connector = await this.connector(context, connectorId);
    const config = connector.configuration as Config;
    const account = config.whatsappAuthorizedAccounts?.find((item) => item.id === connector.whatsappBusinessAccountId);
    const phone = account?.phoneNumbers.find((item) => item.id === input.phoneNumberId);
    if (!account || !phone) throw new AppError(400, "The selected WhatsApp number is unavailable for this business account.", "WHATSAPP_NUMBER_UNAVAILABLE");
    if (!config.whatsappScopesValid || !connector.appSecretEncrypted) throw new AppError(409, "Required Test Mode permissions are missing.", "WHATSAPP_PERMISSIONS_MISSING");
    const tokens = JSON.parse(decryptSecret(connector.appSecretEncrypted)) as Array<{ id: string; token: string }>;
    const token = tokens.find((item) => item.id === account.id)?.token;
    if (!token) throw new AppError(409, "WhatsApp test authorization must be completed again.", "WHATSAPP_AUTHORIZATION_REQUIRED");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.integrationConnector.update({ where: { id: connectorId }, data: { whatsappPhoneNumberId: phone.id, accessTokenEncrypted: encryptSecret(token), appSecretEncrypted: null, credentialsConfiguredAt: new Date(), status: "DRAFT", configuration: { ...config, whatsappSetupState: "NUMBER_SELECTED", whatsappMaskedDisplayNumber: phone.maskedDisplayNumber, whatsappVerifiedNumberName: phone.verifiedName, whatsappNumberVerifiedAt: new Date().toISOString(), whatsappWebhookReady: false } as Prisma.InputJsonValue, updatedById: context.userId } });
        await this.audit(tx, context, connectorId, "WHATSAPP_NUMBER_SELECTED", "NUMBER_SELECTED", "A provider-authorized synthetic WhatsApp number was selected.");
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "This WhatsApp business number is already connected to another workspace or connector.", "WHATSAPP_NUMBER_ALREADY_CONNECTED");
      throw error;
    }
    return this.status(context, connectorId);
  }

  async test(context: Context, connectorId: string) {
    const connector = await this.connector(context, connectorId);
    const config = connector.configuration as Config;
    if (!connector.whatsappBusinessAccountId || !connector.whatsappPhoneNumberId || !config.whatsappScopesValid || !connector.accessTokenEncrypted) throw new AppError(409, "Complete account and number selection first.", "WHATSAPP_SETUP_INCOMPLETE");
    const ready = await this.provider.testSubscription(connector.whatsappBusinessAccountId, connector.whatsappPhoneNumberId);
    const at = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      await tx.integrationConnector.update({ where: { id: connectorId }, data: { status: ready ? "DRAFT" : "ERROR", configuration: { ...config, whatsappSetupState: ready ? "READY_TEST" : "ERROR", whatsappWebhookReady: ready, whatsappLastTestAt: at } as Prisma.InputJsonValue, updatedById: context.userId } });
      await this.audit(tx, context, connectorId, "WHATSAPP_READINESS_TESTED", ready ? "READY_TEST" : "ERROR", ready ? "WhatsApp Test Mode readiness check passed." : "WhatsApp Test Mode readiness check failed.");
    });
    if (!ready) throw new AppError(409, "WhatsApp Test Mode readiness check failed.", "WHATSAPP_TEST_NOT_READY");
    return { ready: true, mode: "TEST", externalActionPerformed: false, messageSent: false, customerCreated: false, inquiryCreated: false };
  }

  async reconnect(context: Context, connectorId: string) {
    await this.clear(context, connectorId, "WHATSAPP_RECONNECTION_STARTED", "NOT_CONFIGURED", "WhatsApp Test Mode reconnection started.");
    return this.start(context, connectorId, { returnPath: "/automation" });
  }

  async disconnect(context: Context, connectorId: string) {
    await this.clear(context, connectorId, "WHATSAPP_DISCONNECTED", "DISCONNECTED", "WhatsApp Test Mode connection disconnected.");
    return { disconnected: true, providerContacted: false, historyPreserved: true };
  }

  private async clear(context: Context, connectorId: string, actionCode: string, state: string, summary: string) {
    const connector = await this.connector(context, connectorId);
    const config = connector.configuration as Config;
    await prisma.$transaction(async (tx) => {
      await tx.integrationAuthorizationState.updateMany({ where: { connectorId, organizationId: context.organizationId, provider: providerName, consumedAt: null }, data: { consumedAt: new Date() } });
      await tx.integrationConnector.update({ where: { id: connectorId }, data: { status: "DRAFT", whatsappPhoneNumberId: null, whatsappBusinessAccountId: null, accessTokenEncrypted: null, appSecretEncrypted: null, credentialsConfiguredAt: null, configuration: { ...config, whatsappSetupState: state, whatsappAuthorizedAccounts: [], whatsappSelectedWabaId: null, whatsappVerifiedBusinessName: null, whatsappMaskedDisplayNumber: null, whatsappVerifiedNumberName: null, whatsappGrantedScopes: [], whatsappScopesValid: false, whatsappAuthorizationExpiresAt: null, whatsappAuthorizationVerifiedAt: null, whatsappNumberVerifiedAt: null, whatsappWebhookReady: false, whatsappLastTestAt: null, whatsappDisconnectedAt: new Date().toISOString() } as Prisma.InputJsonValue, updatedById: context.userId } });
      await this.audit(tx, context, connectorId, actionCode, state, summary);
    });
  }

  private async connector(context: Context, id: string) {
    const connector = await prisma.integrationConnector.findFirst({ where: connectorWhere(context, id), select: { id: true, status: true, whatsappPhoneNumberId: true, whatsappBusinessAccountId: true, accessTokenEncrypted: true, appSecretEncrypted: true, configuration: true } });
    if (!connector) throw new AppError(404, "Connector was not found.", "CONNECTOR_NOT_FOUND");
    return connector;
  }

  private async config(tx: Prisma.TransactionClient, context: Context, connectorId: string) {
    const connector = await tx.integrationConnector.findFirst({ where: connectorWhere(context, connectorId), select: { configuration: true } });
    if (!connector) throw new AppError(404, "Connector was not found.", "CONNECTOR_NOT_FOUND");
    return connector.configuration as Config;
  }

  private audit(tx: Prisma.TransactionClient, context: Context, connectorId: string, actionCode: string, step: string, summary: string) {
    return tx.auditEvent.create({ data: { organizationId: context.organizationId, actorType: "USER", actorUserId: context.userId, serviceCode: "AUTOMATION", actionCode, sourceType: "INTEGRATION_CONNECTOR", sourceId: connectorId, summary, metadata: { provider: providerName, mode: "TEST", setupStep: step, correlationId: randomBytes(12).toString("hex") } } });
  }

  private failureAudit(context: Context, connectorId: string, category: string) {
    return prisma.auditEvent.create({ data: { organizationId: context.organizationId, actorType: "USER", actorUserId: context.userId, serviceCode: "AUTOMATION", actionCode: "WHATSAPP_AUTHORIZATION_FAILED", sourceType: "INTEGRATION_CONNECTOR", sourceId: connectorId, summary: "WhatsApp Business Test Mode authorization failed.", metadata: { provider: providerName, mode: "TEST", failureCategory: category, correlationId: randomBytes(12).toString("hex") } } });
  }
}
