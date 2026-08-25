CREATE TYPE "SchoolGuardianAlertChannel" AS ENUM ('WHATSAPP', 'EMAIL');
CREATE TYPE "SchoolGuardianAlertStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED_READY', 'SENT', 'FAILED', 'CANCELED');
CREATE TABLE "SchoolGuardianAlert" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "channel" "SchoolGuardianAlertChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "SchoolGuardianAlertStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "policyExecutionId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureMessage" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolGuardianAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolGuardianAlert_org_student_guardian_date_channel_key" ON "SchoolGuardianAlert"("organizationId", "studentId", "guardianId", "attendanceDate", "channel");
CREATE INDEX "SchoolGuardianAlert_organizationId_attendanceDate_status_idx" ON "SchoolGuardianAlert"("organizationId", "attendanceDate", "status");
CREATE INDEX "SchoolGuardianAlert_organizationId_policyExecutionId_idx" ON "SchoolGuardianAlert"("organizationId", "policyExecutionId");
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "SchoolGuardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_policyExecutionId_fkey" FOREIGN KEY ("policyExecutionId") REFERENCES "AutomationPolicyExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolGuardianAlert" ADD CONSTRAINT "SchoolGuardianAlert_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
