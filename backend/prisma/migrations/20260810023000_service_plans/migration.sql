CREATE TYPE "ServicePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "OrganizationPlanStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELED');
CREATE TYPE "ServiceOverrideType" AS ENUM ('ADD', 'REMOVE');

CREATE TABLE "ServicePlan" ("id" UUID NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT,"status" "ServicePlanStatus" NOT NULL DEFAULT 'DRAFT',"createdById" UUID NOT NULL,"updatedById" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"archivedAt" TIMESTAMP(3),CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ServicePlanItem" ("id" UUID NOT NULL,"planId" UUID NOT NULL,"serviceId" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ServicePlanItem_pkey" PRIMARY KEY ("id"));
CREATE TABLE "OrganizationPlan" ("id" UUID NOT NULL,"organizationId" UUID NOT NULL,"planId" UUID NOT NULL,"status" "OrganizationPlanStatus" NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"trialEndsAt" TIMESTAMP(3),"expiresAt" TIMESTAMP(3),"assignedById" UUID NOT NULL,"updatedById" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "OrganizationPlan_pkey" PRIMARY KEY ("id"));
CREATE TABLE "OrganizationServiceOverride" ("id" UUID NOT NULL,"organizationId" UUID NOT NULL,"serviceId" UUID NOT NULL,"type" "ServiceOverrideType" NOT NULL,"createdById" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OrganizationServiceOverride_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "ServicePlan_code_key" ON "ServicePlan"("code");
CREATE INDEX "ServicePlan_status_name_idx" ON "ServicePlan"("status","name");
CREATE INDEX "ServicePlan_createdById_idx" ON "ServicePlan"("createdById");
CREATE INDEX "ServicePlan_updatedById_idx" ON "ServicePlan"("updatedById");
CREATE UNIQUE INDEX "ServicePlanItem_planId_serviceId_key" ON "ServicePlanItem"("planId","serviceId");
CREATE INDEX "ServicePlanItem_serviceId_idx" ON "ServicePlanItem"("serviceId");
CREATE UNIQUE INDEX "OrganizationPlan_organizationId_key" ON "OrganizationPlan"("organizationId");
CREATE INDEX "OrganizationPlan_planId_status_idx" ON "OrganizationPlan"("planId","status");
CREATE INDEX "OrganizationPlan_status_trialEndsAt_expiresAt_idx" ON "OrganizationPlan"("status","trialEndsAt","expiresAt");
CREATE INDEX "OrganizationPlan_assignedById_idx" ON "OrganizationPlan"("assignedById");
CREATE INDEX "OrganizationPlan_updatedById_idx" ON "OrganizationPlan"("updatedById");
CREATE UNIQUE INDEX "OrganizationServiceOverride_organizationId_serviceId_key" ON "OrganizationServiceOverride"("organizationId","serviceId");
CREATE INDEX "OrganizationServiceOverride_serviceId_type_idx" ON "OrganizationServiceOverride"("serviceId","type");
CREATE INDEX "OrganizationServiceOverride_createdById_idx" ON "OrganizationServiceOverride"("createdById");

ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePlanItem" ADD CONSTRAINT "ServicePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePlanItem" ADD CONSTRAINT "ServicePlanItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationServiceOverride" ADD CONSTRAINT "OrganizationServiceOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationServiceOverride" ADD CONSTRAINT "OrganizationServiceOverride_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationServiceOverride" ADD CONSTRAINT "OrganizationServiceOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
