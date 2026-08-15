-- CreateEnum
CREATE TYPE "SchoolTeacherStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE', 'EXITED');

-- CreateTable
CREATE TABLE "SchoolSubject" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolTeacher" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "qualification" TEXT,
    "joinedOn" TIMESTAMP(3) NOT NULL,
    "status" "SchoolTeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxPeriodsPerDay" INTEGER NOT NULL DEFAULT 6,
    "maxPeriodsPerWeek" INTEGER NOT NULL DEFAULT 30,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolTeacherAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "isClassTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolSubject_organizationId_deletedAt_idx" ON "SchoolSubject"("organizationId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubject_organizationId_code_key" ON "SchoolSubject"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SchoolTeacher_organizationId_status_deletedAt_idx" ON "SchoolTeacher"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "SchoolTeacher_organizationId_email_deletedAt_idx" ON "SchoolTeacher"("organizationId", "email", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTeacher_organizationId_employeeNumber_key" ON "SchoolTeacher"("organizationId", "employeeNumber");

-- CreateIndex
CREATE INDEX "SchoolTeacherAssignment_organizationId_academicYearId_class_idx" ON "SchoolTeacherAssignment"("organizationId", "academicYearId", "classId", "sectionId", "deletedAt");

-- CreateIndex
CREATE INDEX "SchoolTeacherAssignment_organizationId_teacherId_deletedAt_idx" ON "SchoolTeacherAssignment"("organizationId", "teacherId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTeacherAssignment_teacherId_subjectId_academicYearId__key" ON "SchoolTeacherAssignment"("teacherId", "subjectId", "academicYearId", "classId", "sectionId");

-- AddForeignKey
ALTER TABLE "SchoolSubject" ADD CONSTRAINT "SchoolSubject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubject" ADD CONSTRAINT "SchoolSubject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubject" ADD CONSTRAINT "SchoolSubject_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacher" ADD CONSTRAINT "SchoolTeacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacher" ADD CONSTRAINT "SchoolTeacher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacher" ADD CONSTRAINT "SchoolTeacher_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "SchoolTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SchoolSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "SchoolAcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SchoolSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAssignment" ADD CONSTRAINT "SchoolTeacherAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
