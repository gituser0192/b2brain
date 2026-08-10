CREATE TYPE "LeadAssignmentStrategy" AS ENUM ('FIXED', 'ROUND_ROBIN');
CREATE TYPE "LeadAssignmentAction" AS ENUM ('AUTO_ASSIGNED', 'MANUALLY_ASSIGNED', 'ESCALATED', 'UNASSIGNED');

CREATE TABLE "LeadAssignmentRule" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "source" "InquirySource",
  "inquiryType" "InquiryType",
  "priority" "ProjectPriority",
  "campaignId" UUID,
  "strategy" "LeadAssignmentStrategy" NOT NULL,
  "eligibleEmployeeIds" JSONB NOT NULL,
  "responseTimeMinutes" INTEGER NOT NULL,
  "escalationAfterMinutes" INTEGER,
  "escalationEmployeeId" UUID,
  "lastAssignedEmployeeId" UUID,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "LeadAssignmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAssignmentHistory" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "inquiryId" UUID NOT NULL,
  "ruleId" UUID,
  "action" "LeadAssignmentAction" NOT NULL,
  "fromEmployeeId" UUID,
  "toEmployeeId" UUID,
  "reason" TEXT NOT NULL,
  "responseDueAt" TIMESTAMP(3),
  "escalationDueAt" TIMESTAMP(3),
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAssignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadAssignmentRule_organizationId_isActive_sortOrder_archivedAt_idx" ON "LeadAssignmentRule"("organizationId", "isActive", "sortOrder", "archivedAt");
CREATE INDEX "LeadAssignmentRule_organizationId_campaignId_idx" ON "LeadAssignmentRule"("organizationId", "campaignId");
CREATE INDEX "LeadAssignmentHistory_organizationId_inquiryId_createdAt_idx" ON "LeadAssignmentHistory"("organizationId", "inquiryId", "createdAt");
CREATE INDEX "LeadAssignmentHistory_organizationId_escalationDueAt_action_idx" ON "LeadAssignmentHistory"("organizationId", "escalationDueAt", "action");
CREATE INDEX "LeadAssignmentHistory_actorUserId_idx" ON "LeadAssignmentHistory"("actorUserId");

ALTER TABLE "LeadAssignmentRule" ADD CONSTRAINT "LeadAssignmentRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentHistory" ADD CONSTRAINT "LeadAssignmentHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentHistory" ADD CONSTRAINT "LeadAssignmentHistory_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentHistory" ADD CONSTRAINT "LeadAssignmentHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
