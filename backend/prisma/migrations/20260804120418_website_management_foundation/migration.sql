-- CreateEnum
CREATE TYPE "WebsitePlatform" AS ENUM ('WORDPRESS', 'SHOPIFY', 'WIX', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'PAUSED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "WebsiteRequestType" AS ENUM ('BANNER', 'CONTENT', 'PRODUCT', 'BUG_FIX', 'SEO', 'NEW_PAGE', 'DESIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "WebsiteRequestStatus" AS ENUM ('REQUESTED', 'CLARIFICATION', 'PLANNED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'APPROVED', 'DEPLOYED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChangeRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeploymentEnvironment" AS ENUM ('PREVIEW', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "ManagedWebsite" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID,
    "assignedEmployeeId" UUID,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "platform" "WebsitePlatform" NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "adminUrl" TEXT,
    "repositoryUrl" TEXT,
    "hostingProvider" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ManagedWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteChangeRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "projectId" UUID,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "WebsiteRequestType" NOT NULL,
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "risk" "ChangeRisk" NOT NULL DEFAULT 'LOW',
    "status" "WebsiteRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "deadline" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDeployment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "environment" "DeploymentEnvironment" NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PLANNED',
    "version" TEXT,
    "deploymentUrl" TEXT,
    "summary" TEXT NOT NULL,
    "verification" TEXT,
    "rollbackPlan" TEXT,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedWebsite_organizationId_status_deletedAt_idx" ON "ManagedWebsite"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "ManagedWebsite_organizationId_customerId_deletedAt_idx" ON "ManagedWebsite"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedWebsite_organizationId_domain_key" ON "ManagedWebsite"("organizationId", "domain");

-- CreateIndex
CREATE INDEX "WebsiteChangeRequest_organizationId_status_risk_deletedAt_idx" ON "WebsiteChangeRequest"("organizationId", "status", "risk", "deletedAt");

-- CreateIndex
CREATE INDEX "WebsiteChangeRequest_organizationId_websiteId_deadline_idx" ON "WebsiteChangeRequest"("organizationId", "websiteId", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteChangeRequest_organizationId_requestNumber_key" ON "WebsiteChangeRequest"("organizationId", "requestNumber");

-- CreateIndex
CREATE INDEX "WebsiteDeployment_organizationId_websiteId_createdAt_idx" ON "WebsiteDeployment"("organizationId", "websiteId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteDeployment_organizationId_requestId_status_idx" ON "WebsiteDeployment"("organizationId", "requestId", "status");

-- AddForeignKey
ALTER TABLE "ManagedWebsite" ADD CONSTRAINT "ManagedWebsite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedWebsite" ADD CONSTRAINT "ManagedWebsite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedWebsite" ADD CONSTRAINT "ManagedWebsite_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedWebsite" ADD CONSTRAINT "ManagedWebsite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedWebsite" ADD CONSTRAINT "ManagedWebsite_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "ManagedWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteChangeRequest" ADD CONSTRAINT "WebsiteChangeRequest_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDeployment" ADD CONSTRAINT "WebsiteDeployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDeployment" ADD CONSTRAINT "WebsiteDeployment_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "ManagedWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDeployment" ADD CONSTRAINT "WebsiteDeployment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WebsiteChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDeployment" ADD CONSTRAINT "WebsiteDeployment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
