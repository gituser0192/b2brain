-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('MANUAL', 'WEBSITE', 'WHATSAPP', 'EMAIL', 'PHONE', 'SOCIAL', 'REFERRAL', 'STORE', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('UNCLASSIFIED', 'SALES', 'PRODUCT_QUESTION', 'SUPPORT', 'COMPLAINT', 'ORDER_REQUEST', 'PARTNERSHIP', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'REVIEWING', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED', 'SPAM');

-- CreateEnum
CREATE TYPE "InquiryTimelineType" AS ENUM ('CREATED', 'NOTE', 'STATUS_CHANGED', 'ASSIGNED', 'CLASSIFIED', 'CONVERTED');

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "source" "InquirySource" NOT NULL,
    "type" "InquiryType" NOT NULL DEFAULT 'UNCLASSIFIED',
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "customerId" UUID,
    "campaignId" UUID,
    "assignedEmployeeId" UUID,
    "convertedDealId" UUID,
    "convertedTicketId" UUID,
    "responseDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "disqualifiedReason" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryTimeline" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inquiryId" UUID NOT NULL,
    "type" "InquiryTimelineType" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_organizationId_status_priority_deletedAt_idx" ON "Inquiry"("organizationId", "status", "priority", "deletedAt");

-- CreateIndex
CREATE INDEX "Inquiry_organizationId_email_deletedAt_idx" ON "Inquiry"("organizationId", "email", "deletedAt");

-- CreateIndex
CREATE INDEX "Inquiry_organizationId_phone_deletedAt_idx" ON "Inquiry"("organizationId", "phone", "deletedAt");

-- CreateIndex
CREATE INDEX "Inquiry_organizationId_assignedEmployeeId_status_idx" ON "Inquiry"("organizationId", "assignedEmployeeId", "status");

-- CreateIndex
CREATE INDEX "Inquiry_organizationId_responseDueAt_status_idx" ON "Inquiry"("organizationId", "responseDueAt", "status");

-- CreateIndex
CREATE INDEX "InquiryTimeline_organizationId_inquiryId_createdAt_idx" ON "InquiryTimeline"("organizationId", "inquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_convertedDealId_fkey" FOREIGN KEY ("convertedDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_convertedTicketId_fkey" FOREIGN KEY ("convertedTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryTimeline" ADD CONSTRAINT "InquiryTimeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryTimeline" ADD CONSTRAINT "InquiryTimeline_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryTimeline" ADD CONSTRAINT "InquiryTimeline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
