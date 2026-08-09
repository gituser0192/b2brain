-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CUSTOMER_APPOINTMENT', 'INTERNAL_MEETING', 'SALES_CALL', 'DEMO', 'PROJECT_MEETING', 'SUPPORT_APPOINTMENT', 'WEBSITE_CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EventLocationType" AS ENUM ('ONLINE', 'PHONE', 'ONSITE', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID,
    "projectId" UUID,
    "dealId" UUID,
    "ticketId" UUID,
    "websiteRequestId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "locationType" "EventLocationType" NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "recurrenceRule" TEXT,
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" UUID,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventAttendee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "employeeId" UUID,
    "externalName" TEXT,
    "externalEmail" TEXT,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "responseStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "CalendarEventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarReminder" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "CalendarReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_startAt_endAt_deletedAt_idx" ON "CalendarEvent"("organizationId", "startAt", "endAt", "deletedAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_status_startAt_idx" ON "CalendarEvent"("organizationId", "status", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_customerId_startAt_idx" ON "CalendarEvent"("organizationId", "customerId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEventAttendee_organizationId_employeeId_eventId_idx" ON "CalendarEventAttendee"("organizationId", "employeeId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventAttendee_eventId_employeeId_key" ON "CalendarEventAttendee"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "CalendarReminder_organizationId_sentAt_failedAt_idx" ON "CalendarReminder"("organizationId", "sentAt", "failedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarReminder_eventId_channel_minutesBefore_key" ON "CalendarReminder"("eventId", "channel", "minutesBefore");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_websiteRequestId_fkey" FOREIGN KEY ("websiteRequestId") REFERENCES "WebsiteChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarReminder" ADD CONSTRAINT "CalendarReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarReminder" ADD CONSTRAINT "CalendarReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
