BEGIN;

ALTER TABLE "IntegrationConnector"
  ADD COLUMN "credentialKeyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "credentialStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "credentialExpiresAt" TIMESTAMP(3),
  ADD COLUMN "credentialValidatedAt" TIMESTAMP(3),
  ADD COLUMN "reauthorizationReason" TEXT,
  ADD COLUMN "disconnectedAt" TIMESTAMP(3),
  ADD COLUMN "providerRevokedAt" TIMESTAMP(3);

ALTER TABLE "IntegrationAuthorizationState"
  ADD COLUMN "capability" TEXT,
  ADD COLUMN "loginVariant" TEXT;

ALTER TABLE "ProviderServiceRequest" ADD COLUMN "metaHelpCapability" TEXT;
CREATE UNIQUE INDEX "ProviderServiceRequest_open_meta_help_idx" ON "ProviderServiceRequest"("organizationId", "metaHelpCapability") WHERE "metaHelpCapability" IS NOT NULL AND "deletedAt" IS NULL AND "status" NOT IN ('COMPLETED', 'CANCELED');

CREATE TABLE "MetaConnectedAsset" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "connectorId" UUID NOT NULL,
  "capability" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "loginVariant" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "routingStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
  "grantedScopes" JSONB NOT NULL DEFAULT '[]',
  "lastValidatedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaConnectedAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MetaConnectedAsset_routingStatus_check" CHECK ("routingStatus" IN ('INACTIVE', 'ACTIVE')),
  CONSTRAINT "MetaConnectedAsset_active_unreleased_check" CHECK ("routingStatus" <> 'ACTIVE' OR "releasedAt" IS NULL),
  CONSTRAINT "MetaConnectedAsset_capability_check" CHECK ("capability" IN ('INSTAGRAM_MESSAGES', 'META_LEAD_ADS', 'META_ADVERTISING')),
  CONSTRAINT "MetaConnectedAsset_assetType_check" CHECK ("assetType" IN ('INSTAGRAM_ACCOUNT', 'PAGE', 'AD_ACCOUNT'))
);

CREATE INDEX "MetaConnectedAsset_org_connector_capability_idx" ON "MetaConnectedAsset"("organizationId", "connectorId", "capability");
CREATE INDEX "MetaConnectedAsset_route_idx" ON "MetaConnectedAsset"("provider", "assetType", "assetId", "capability", "routingStatus");
CREATE UNIQUE INDEX "MetaConnectedAsset_one_active_owner_idx" ON "MetaConnectedAsset"("provider", "assetType", "assetId") WHERE "routingStatus" = 'ACTIVE';
CREATE UNIQUE INDEX "MetaConnectedAsset_one_unreleased_owner_idx" ON "MetaConnectedAsset"("provider", "assetType", "assetId") WHERE "releasedAt" IS NULL;
CREATE UNIQUE INDEX "IntegrationConnector_one_open_meta_capability_idx" ON "IntegrationConnector"("organizationId", "provider") WHERE "type" = 'SOCIAL' AND "provider" IN ('META_INSTAGRAM_DM', 'META_LEAD_ADS', 'META_ADVERTISING') AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED';
CREATE UNIQUE INDEX "IntegrationConnector_id_organizationId_key" ON "IntegrationConnector"("id", "organizationId");
ALTER TABLE "MetaConnectedAsset" ADD CONSTRAINT "MetaConnectedAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaConnectedAsset" ADD CONSTRAINT "MetaConnectedAsset_connectorId_organizationId_fkey" FOREIGN KEY ("connectorId", "organizationId") REFERENCES "IntegrationConnector"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing references are preserved for ownership/history, but never become routable merely from migration.
INSERT INTO "MetaConnectedAsset" ("id", "organizationId", "connectorId", "capability", "provider", "loginVariant", "assetType", "assetId", "routingStatus", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "organizationId", "id", 'INSTAGRAM_MESSAGES', 'META', 'LEGACY_UNVERIFIED', 'INSTAGRAM_ACCOUNT', "externalAccountRef", 'INACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "IntegrationConnector" WHERE "type" = 'SOCIAL' AND "provider" = 'META_INSTAGRAM_DM' AND "externalAccountRef" IS NOT NULL;

INSERT INTO "MetaConnectedAsset" ("id", "organizationId", "connectorId", "capability", "provider", "loginVariant", "assetType", "assetId", "routingStatus", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "organizationId", "id", 'META_LEAD_ADS', 'META', 'LEGACY_UNVERIFIED', 'PAGE', "metaPageId", 'INACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "IntegrationConnector" WHERE "type" = 'SOCIAL' AND "provider" = 'META_LEAD_ADS' AND "metaPageId" IS NOT NULL;

UPDATE "IntegrationConnector" SET "credentialStatus" = 'LEGACY_UNVERIFIED' WHERE "accessTokenEncrypted" IS NOT NULL OR "appSecretEncrypted" IS NOT NULL;

COMMIT;
