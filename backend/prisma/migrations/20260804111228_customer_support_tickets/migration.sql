-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PHONE', 'WEBSITE', 'SOCIAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketMessageType" AS ENUM ('CUSTOMER_MESSAGE', 'AGENT_REPLY', 'INTERNAL_NOTE', 'SYSTEM_EVENT');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "assignedEmployeeId" UUID,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "responseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "satisfactionRating" INTEGER,
    "satisfactionComment" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" "TicketMessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "messageId" UUID,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_status_priority_deletedAt_idx" ON "SupportTicket"("organizationId", "status", "priority", "deletedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_customerId_deletedAt_idx" ON "SupportTicket"("organizationId", "customerId", "deletedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_assignedEmployeeId_status_idx" ON "SupportTicket"("organizationId", "assignedEmployeeId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_responseDueAt_resolutionDueAt_idx" ON "SupportTicket"("organizationId", "responseDueAt", "resolutionDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_organizationId_ticketNumber_key" ON "SupportTicket"("organizationId", "ticketNumber");

-- CreateIndex
CREATE INDEX "TicketMessage_organizationId_ticketId_createdAt_idx" ON "TicketMessage"("organizationId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_organizationId_ticketId_deletedAt_idx" ON "TicketAttachment"("organizationId", "ticketId", "deletedAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_messageId_idx" ON "TicketAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
