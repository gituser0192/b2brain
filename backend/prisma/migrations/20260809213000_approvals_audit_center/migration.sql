CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELED', 'EXPIRED');
CREATE TYPE "ApprovalRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'INTEGRATION', 'AI_AGENT');

CREATE TABLE "ApprovalRequest" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "serviceCode" TEXT NOT NULL, "actionCode" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "riskLevel" "ApprovalRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING', "sourceType" TEXT NOT NULL, "sourceId" UUID NOT NULL,
  "requestedById" UUID NOT NULL, "decidedById" UUID, "decisionNote" TEXT, "dueAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3), "context" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "actorType" "AuditActorType" NOT NULL,
  "actorUserId" UUID, "serviceCode" TEXT NOT NULL, "actionCode" TEXT NOT NULL, "sourceType" TEXT NOT NULL,
  "sourceId" UUID, "summary" TEXT NOT NULL, "beforeState" JSONB, "afterState" JSONB, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalRequest_organizationId_sourceType_sourceId_key" ON "ApprovalRequest"("organizationId", "sourceType", "sourceId");
CREATE INDEX "ApprovalRequest_organizationId_status_dueAt_createdAt_idx" ON "ApprovalRequest"("organizationId", "status", "dueAt", "createdAt");
CREATE INDEX "ApprovalRequest_organizationId_serviceCode_riskLevel_createdAt_idx" ON "ApprovalRequest"("organizationId", "serviceCode", "riskLevel", "createdAt");
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");
CREATE INDEX "ApprovalRequest_decidedById_idx" ON "ApprovalRequest"("decidedById");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_organizationId_serviceCode_actionCode_createdAt_idx" ON "AuditEvent"("organizationId", "serviceCode", "actionCode", "createdAt");
CREATE INDEX "AuditEvent_organizationId_sourceType_sourceId_createdAt_idx" ON "AuditEvent"("organizationId", "sourceType", "sourceId", "createdAt");
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
