-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationServiceStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "iconKey" TEXT,
    "routePath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationService" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "status" "OrganizationServiceStatus" NOT NULL DEFAULT 'ENABLED',
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "featureFlagId" UUID,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "Service_status_sortOrder_idx" ON "Service"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "OrganizationService_organizationId_status_deletedAt_idx" ON "OrganizationService"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "OrganizationService_serviceId_idx" ON "OrganizationService"("serviceId");

-- CreateIndex
CREATE INDEX "OrganizationService_createdById_idx" ON "OrganizationService"("createdById");

-- CreateIndex
CREATE INDEX "OrganizationService_updatedById_idx" ON "OrganizationService"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationService_organizationId_serviceId_key" ON "OrganizationService"("organizationId", "serviceId");

-- CreateIndex
CREATE INDEX "FeatureFlag_code_idx" ON "FeatureFlag"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_serviceId_code_key" ON "FeatureFlag"("serviceId", "code");

-- CreateIndex
CREATE INDEX "Entitlement_organizationId_enabled_deletedAt_idx" ON "Entitlement"("organizationId", "enabled", "deletedAt");

-- CreateIndex
CREATE INDEX "Entitlement_serviceId_idx" ON "Entitlement"("serviceId");

-- CreateIndex
CREATE INDEX "Entitlement_featureFlagId_idx" ON "Entitlement"("featureFlagId");

-- CreateIndex
CREATE INDEX "Entitlement_createdById_idx" ON "Entitlement"("createdById");

-- CreateIndex
CREATE INDEX "Entitlement_updatedById_idx" ON "Entitlement"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_organizationId_serviceId_key_key" ON "Entitlement"("organizationId", "serviceId", "key");

-- AddForeignKey
ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationService" ADD CONSTRAINT "OrganizationService_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
