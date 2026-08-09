-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('WHATSAPP', 'WEBSITE', 'COMMERCE', 'PAYMENT', 'EMAIL', 'SOCIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ERROR', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutomationMode" AS ENUM ('MANUAL_APPROVAL', 'ASSISTED', 'POLICY_LIMITED');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'QUARANTINED', 'IGNORED');

-- CreateEnum
CREATE TYPE "IntegrationEventKind" AS ENUM ('INQUIRY', 'SUPPORT_REQUEST', 'COMPLAINT', 'SALES_OPPORTUNITY', 'ORDER_REQUEST', 'ORDER', 'PAYMENT', 'REFUND', 'WEBSITE_CHANGE', 'UNKNOWN', 'SPAM');

-- CreateTable
CREATE TABLE "IntegrationConnector" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "AutomationMode" NOT NULL DEFAULT 'MANUAL_APPROVAL',
    "provider" TEXT NOT NULL,
    "externalAccountRef" TEXT,
    "webhookKey" TEXT NOT NULL,
    "signingSecretHash" TEXT,
    "configuration" JSONB NOT NULL,
    "lastReceivedAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "kind" "IntegrationEventKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "quarantinedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "resultType" TEXT,
    "resultId" UUID,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAttempt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnector_webhookKey_key" ON "IntegrationConnector"("webhookKey");

-- CreateIndex
CREATE INDEX "IntegrationConnector_organizationId_status_deletedAt_idx" ON "IntegrationConnector"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "IntegrationConnector_organizationId_type_deletedAt_idx" ON "IntegrationConnector"("organizationId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_organizationId_status_createdAt_idx" ON "IntegrationEvent"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_organizationId_traceId_idx" ON "IntegrationEvent"("organizationId", "traceId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_organizationId_nextRetryAt_status_idx" ON "IntegrationEvent"("organizationId", "nextRetryAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_organizationId_connectorId_externalEventId_key" ON "IntegrationEvent"("organizationId", "connectorId", "externalEventId");

-- CreateIndex
CREATE INDEX "AutomationAttempt_organizationId_status_createdAt_idx" ON "AutomationAttempt"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAttempt_eventId_attemptNumber_key" ON "AutomationAttempt"("eventId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "IntegrationConnector" ADD CONSTRAINT "IntegrationConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnector" ADD CONSTRAINT "IntegrationConnector_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnector" ADD CONSTRAINT "IntegrationConnector_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "IntegrationConnector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAttempt" ADD CONSTRAINT "AutomationAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAttempt" ADD CONSTRAINT "AutomationAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IntegrationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAttempt" ADD CONSTRAINT "AutomationAttempt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
