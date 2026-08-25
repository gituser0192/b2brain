ALTER TABLE "LeadAssignmentRule" ADD COLUMN "followUpSequenceId" UUID;
CREATE INDEX "LeadAssignmentRule_organizationId_followUpSequenceId_idx" ON "LeadAssignmentRule"("organizationId", "followUpSequenceId");
ALTER TABLE "LeadAssignmentRule" ADD CONSTRAINT "LeadAssignmentRule_followUpSequenceId_fkey" FOREIGN KEY ("followUpSequenceId") REFERENCES "FollowUpSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
