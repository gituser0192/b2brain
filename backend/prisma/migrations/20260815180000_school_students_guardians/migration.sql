-- CreateEnum
CREATE TYPE "SchoolStudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED');

-- CreateEnum
CREATE TYPE "SchoolEnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED');

-- CreateTable
CREATE TABLE "SchoolStudent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "status" "SchoolStudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolGuardian" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolStudentGuardian" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canPickup" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolStudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolEnrollment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "rollNumber" TEXT,
    "status" "SchoolEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedOn" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolStudent_organizationId_status_deletedAt_idx" ON "SchoolStudent"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStudent_organizationId_studentNumber_key" ON "SchoolStudent"("organizationId", "studentNumber");

-- CreateIndex
CREATE INDEX "SchoolGuardian_organizationId_phone_deletedAt_idx" ON "SchoolGuardian"("organizationId", "phone", "deletedAt");

-- CreateIndex
CREATE INDEX "SchoolGuardian_organizationId_email_deletedAt_idx" ON "SchoolGuardian"("organizationId", "email", "deletedAt");

-- CreateIndex
CREATE INDEX "SchoolStudentGuardian_organizationId_studentId_idx" ON "SchoolStudentGuardian"("organizationId", "studentId");

-- CreateIndex
CREATE INDEX "SchoolStudentGuardian_organizationId_guardianId_idx" ON "SchoolStudentGuardian"("organizationId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStudentGuardian_studentId_guardianId_key" ON "SchoolStudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE INDEX "SchoolEnrollment_organizationId_academicYearId_classId_sect_idx" ON "SchoolEnrollment"("organizationId", "academicYearId", "classId", "sectionId", "status");

-- CreateIndex
CREATE INDEX "SchoolEnrollment_organizationId_studentId_deletedAt_idx" ON "SchoolEnrollment"("organizationId", "studentId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolEnrollment_studentId_academicYearId_key" ON "SchoolEnrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolEnrollment_sectionId_rollNumber_key" ON "SchoolEnrollment"("sectionId", "rollNumber");

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGuardian" ADD CONSTRAINT "SchoolGuardian_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGuardian" ADD CONSTRAINT "SchoolGuardian_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGuardian" ADD CONSTRAINT "SchoolGuardian_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentGuardian" ADD CONSTRAINT "SchoolStudentGuardian_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentGuardian" ADD CONSTRAINT "SchoolStudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentGuardian" ADD CONSTRAINT "SchoolStudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "SchoolGuardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "SchoolAcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SchoolSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "IncomingPaymentTransaction_organizationId_paymentAccountId_rece" RENAME TO "IncomingPaymentTransaction_organizationId_paymentAccountId__idx";

-- RenameIndex
ALTER INDEX "IncomingPaymentTransaction_organizationId_status_deletedAt_rece" RENAME TO "IncomingPaymentTransaction_organizationId_status_deletedAt__idx";

-- RenameIndex
ALTER INDEX "WebsiteChangeRequest_submittedToProviderAt_providerStatus_provi" RENAME TO "WebsiteChangeRequest_submittedToProviderAt_providerStatus_p_idx";
