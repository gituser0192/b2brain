CREATE TYPE "AutomationPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AutomationPolicyExecutionMode" AS ENUM ('ASSISTED', 'APPROVAL_REQUIRED', 'AUTOMATIC');
CREATE TYPE "AutomationPolicyExecutionStatus" AS ENUM ('MATCHED', 'AWAITING_APPROVAL', 'COMPLETED', 'SKIPPED', 'FAILED');

CREATE TABLE "AutomationPolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceCode" TEXT NOT NULL,
    "eventCode" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "status" "AutomationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "executionMode" "AutomationPolicyExecutionMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    "conditions" JSONB NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationPolicyExecution" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "eventCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "dedupeKey" TEXT,
    "status" "AutomationPolicyExecutionStatus" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "failureMessage" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AutomationPolicyExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationPolicy_organizationId_status_eventCode_priority_idx" ON "AutomationPolicy"("organizationId", "status", "eventCode", "priority");
CREATE INDEX "AutomationPolicy_organizationId_serviceCode_archivedAt_idx" ON "AutomationPolicy"("organizationId", "serviceCode", "archivedAt");
CREATE UNIQUE INDEX "AutomationPolicyExecution_organizationId_policyId_dedupeKey_key" ON "AutomationPolicyExecution"("organizationId", "policyId", "dedupeKey");
CREATE INDEX "AutomationPolicyExecution_organizationId_status_createdAt_idx" ON "AutomationPolicyExecution"("organizationId", "status", "createdAt");
CREATE INDEX "AutomationPolicyExecution_organizationId_sourceType_sourceId_idx" ON "AutomationPolicyExecution"("organizationId", "sourceType", "sourceId");

ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicyExecution" ADD CONSTRAINT "AutomationPolicyExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicyExecution" ADD CONSTRAINT "AutomationPolicyExecution_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AutomationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicyExecution" ADD CONSTRAINT "AutomationPolicyExecution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
