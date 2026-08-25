ALTER TABLE "AutomationMessageDraft"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "providerStatus" TEXT;
CREATE INDEX "AutomationMessageDraft_organizationId_status_nextRetryAt_idx" ON "AutomationMessageDraft"("organizationId", "status", "nextRetryAt");
