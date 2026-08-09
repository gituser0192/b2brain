-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLLOW_UP_DUE', 'SYSTEM', 'AGENT_ALERT', 'APPROVAL_REQUIRED', 'AUTOMATION_FAILED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" UUID,
    "actionPath" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_organizationId_recipientId_deletedAt_available_idx" ON "Notification"("organizationId", "recipientId", "deletedAt", "availableAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_recipientId_readAt_availableAt_idx" ON "Notification"("organizationId", "recipientId", "readAt", "availableAt");

-- CreateIndex
CREATE INDEX "Notification_createdById_idx" ON "Notification"("createdById");

-- CreateIndex
CREATE INDEX "Notification_updatedById_idx" ON "Notification"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_recipientId_sourceType_sourceId_key" ON "Notification"("organizationId", "recipientId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
