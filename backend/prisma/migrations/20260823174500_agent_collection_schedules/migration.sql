CREATE TABLE "AgentSchedule" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "agentId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL,
  "localTime" TEXT NOT NULL,
  "maxInvoicesPerRun" INTEGER NOT NULL DEFAULT 5,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "lastError" TEXT,
  "lockedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentSchedule_organizationId_agentId_key" ON "AgentSchedule"("organizationId", "agentId");
CREATE INDEX "AgentSchedule_enabled_nextRunAt_lockedAt_idx" ON "AgentSchedule"("enabled", "nextRunAt", "lockedAt");
CREATE INDEX "AgentSchedule_organizationId_enabled_idx" ON "AgentSchedule"("organizationId", "enabled");
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
