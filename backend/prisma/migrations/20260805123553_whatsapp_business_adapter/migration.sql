-- CreateEnum
CREATE TYPE "MessageDraftStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "IntegrationConnector" ADD COLUMN     "accessTokenEncrypted" TEXT,
ADD COLUMN     "appSecretEncrypted" TEXT,
ADD COLUMN     "credentialsConfiguredAt" TIMESTAMP(3),
ADD COLUMN     "whatsappBusinessAccountId" TEXT,
ADD COLUMN     "whatsappPhoneNumberId" TEXT;

-- CreateTable
CREATE TABLE "AutomationMessageDraft" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "eventId" UUID,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageDraftStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "externalMessageId" TEXT,
    "failureMessage" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationMessageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationMessageDraft_organizationId_status_createdAt_idx" ON "AutomationMessageDraft"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationMessageDraft_organizationId_connectorId_recipient_idx" ON "AutomationMessageDraft"("organizationId", "connectorId", "recipient");

-- CreateIndex
CREATE INDEX "AutomationMessageDraft_organizationId_eventId_idx" ON "AutomationMessageDraft"("organizationId", "eventId");

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "IntegrationConnector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IntegrationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationMessageDraft" ADD CONSTRAINT "AutomationMessageDraft_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
