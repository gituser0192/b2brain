CREATE TYPE "VoiceCallStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED');
CREATE TYPE "VoiceCallOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER', 'TRANSFERRED', 'OTHER');

CREATE TABLE "VoiceCallJob" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "agentId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "followUpId" UUID,
  "phoneNumber" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en-IN',
  "objective" TEXT NOT NULL,
  "approvedScript" TEXT NOT NULL,
  "status" "VoiceCallStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "outcome" "VoiceCallOutcome",
  "outcomeSummary" TEXT,
  "transcript" TEXT,
  "recordingUrl" TEXT,
  "provider" TEXT,
  "providerCallId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureMessage" TEXT,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "VoiceCallJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoiceCallJob_organizationId_status_scheduledAt_idx" ON "VoiceCallJob"("organizationId", "status", "scheduledAt");
CREATE INDEX "VoiceCallJob_organizationId_customerId_createdAt_idx" ON "VoiceCallJob"("organizationId", "customerId", "createdAt");
CREATE INDEX "VoiceCallJob_organizationId_followUpId_idx" ON "VoiceCallJob"("organizationId", "followUpId");
CREATE INDEX "VoiceCallJob_agentId_idx" ON "VoiceCallJob"("agentId");
CREATE INDEX "VoiceCallJob_createdById_idx" ON "VoiceCallJob"("createdById");
CREATE INDEX "VoiceCallJob_updatedById_idx" ON "VoiceCallJob"("updatedById");

ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "CustomerFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoiceCallJob" ADD CONSTRAINT "VoiceCallJob_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
