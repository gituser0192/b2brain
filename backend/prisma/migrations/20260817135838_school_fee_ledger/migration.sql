-- CreateEnum
CREATE TYPE "SchoolFeeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "SchoolFeeChargeStatus" AS ENUM ('DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED', 'CANCELED');

-- CreateTable
CREATE TABLE "SchoolFeeStructure" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "classId" UUID,
    "name" TEXT NOT NULL,
    "frequency" "SchoolFeeFrequency" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolFeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolFeeCharge" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "feeStructureId" UUID NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SchoolFeeChargeStatus" NOT NULL DEFAULT 'DUE',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolFeeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolFeePayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolFeePaymentAllocation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolFeePaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolFeeReminderDraft" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "channel" "SchoolGuardianAlertChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SchoolGuardianAlertStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "policyExecutionId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolFeeReminderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolFeeStructure_organizationId_academicYearId_classId_is_idx" ON "SchoolFeeStructure"("organizationId", "academicYearId", "classId", "isActive", "archivedAt");

-- CreateIndex
CREATE INDEX "SchoolFeeCharge_organizationId_status_dueDate_idx" ON "SchoolFeeCharge"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SchoolFeeCharge_organizationId_studentId_dueDate_idx" ON "SchoolFeeCharge"("organizationId", "studentId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolFeeCharge_organizationId_enrollmentId_feeStructureId__key" ON "SchoolFeeCharge"("organizationId", "enrollmentId", "feeStructureId", "billingPeriod");

-- CreateIndex
CREATE INDEX "SchoolFeePayment_organizationId_studentId_paidAt_idx" ON "SchoolFeePayment"("organizationId", "studentId", "paidAt");

-- CreateIndex
CREATE INDEX "SchoolFeePayment_organizationId_reference_idx" ON "SchoolFeePayment"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolFeePayment_organizationId_receiptNumber_key" ON "SchoolFeePayment"("organizationId", "receiptNumber");

-- CreateIndex
CREATE INDEX "SchoolFeePaymentAllocation_organizationId_chargeId_idx" ON "SchoolFeePaymentAllocation"("organizationId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolFeePaymentAllocation_paymentId_chargeId_key" ON "SchoolFeePaymentAllocation"("paymentId", "chargeId");

-- CreateIndex
CREATE INDEX "SchoolFeeReminderDraft_organizationId_status_createdAt_idx" ON "SchoolFeeReminderDraft"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolFeeReminderDraft_organizationId_chargeId_createdAt_idx" ON "SchoolFeeReminderDraft"("organizationId", "chargeId", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolFeeReminderDraft_organizationId_policyExecutionId_idx" ON "SchoolFeeReminderDraft"("organizationId", "policyExecutionId");

-- AddForeignKey
ALTER TABLE "SchoolFeeStructure" ADD CONSTRAINT "SchoolFeeStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeStructure" ADD CONSTRAINT "SchoolFeeStructure_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "SchoolAcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeStructure" ADD CONSTRAINT "SchoolFeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeStructure" ADD CONSTRAINT "SchoolFeeStructure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeStructure" ADD CONSTRAINT "SchoolFeeStructure_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "SchoolFeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeCharge" ADD CONSTRAINT "SchoolFeeCharge_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeePayment" ADD CONSTRAINT "SchoolFeePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeePayment" ADD CONSTRAINT "SchoolFeePayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeePayment" ADD CONSTRAINT "SchoolFeePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeePaymentAllocation" ADD CONSTRAINT "SchoolFeePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SchoolFeePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeePaymentAllocation" ADD CONSTRAINT "SchoolFeePaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "SchoolFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "SchoolFeeCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "SchoolGuardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_policyExecutionId_fkey" FOREIGN KEY ("policyExecutionId") REFERENCES "AutomationPolicyExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeeReminderDraft" ADD CONSTRAINT "SchoolFeeReminderDraft_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AutomationPolicyExecution_organizationId_sourceType_sourceId_id" RENAME TO "AutomationPolicyExecution_organizationId_sourceType_sourceI_idx";

-- RenameIndex
ALTER INDEX "SchoolGuardianAlert_org_student_guardian_date_channel_key" RENAME TO "SchoolGuardianAlert_organizationId_studentId_guardianId_att_key";
