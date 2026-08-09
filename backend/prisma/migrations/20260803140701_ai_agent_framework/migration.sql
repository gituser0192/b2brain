-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "instructions" TEXT,
    "supportedService" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowedActions" JSONB NOT NULL,
    "dailyRunLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyContactLimit" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "triggerType" TEXT NOT NULL,
    "summary" TEXT,
    "errorMessage" TEXT,
    "initiatedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentDefinition_organizationId_status_deletedAt_idx" ON "AgentDefinition"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "AgentDefinition_createdById_idx" ON "AgentDefinition"("createdById");

-- CreateIndex
CREATE INDEX "AgentDefinition_updatedById_idx" ON "AgentDefinition"("updatedById");

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_agentId_createdAt_idx" ON "AgentRun"("organizationId", "agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_status_createdAt_idx" ON "AgentRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_initiatedById_idx" ON "AgentRun"("initiatedById");

-- AddForeignKey
ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
