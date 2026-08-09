ALTER TYPE "InquiryTimelineType" ADD VALUE 'CONTACT_LOGGED';
ALTER TYPE "InquiryTimelineType" ADD VALUE 'FOLLOW_UP_SCHEDULED';
ALTER TYPE "InquiryTimelineType" ADD VALUE 'FOLLOW_UP_COMPLETED';
ALTER TABLE "Inquiry" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3), ADD COLUMN "followUpNote" TEXT, ADD COLUMN "followUpCompletedAt" TIMESTAMP(3);
CREATE INDEX "Inquiry_organizationId_nextFollowUpAt_status_idx" ON "Inquiry"("organizationId", "nextFollowUpAt", "status");
