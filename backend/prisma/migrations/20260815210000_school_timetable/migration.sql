-- CreateEnum
CREATE TYPE "SchoolSubstituteStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SchoolTimetableEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "teacherAssignmentId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "room" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolTimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSubstituteAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "timetableEntryId" UUID NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "absentTeacherId" UUID NOT NULL,
    "substituteTeacherId" UUID NOT NULL,
    "status" "SchoolSubstituteStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSubstituteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolTimetableEntry_organizationId_academicYearId_dayOfWee_idx" ON "SchoolTimetableEntry"("organizationId", "academicYearId", "dayOfWeek", "deletedAt");

-- CreateIndex
CREATE INDEX "SchoolTimetableEntry_organizationId_teacherId_dayOfWeek_del_idx" ON "SchoolTimetableEntry"("organizationId", "teacherId", "dayOfWeek", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTimetableEntry_sectionId_dayOfWeek_periodNumber_key" ON "SchoolTimetableEntry"("sectionId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTimetableEntry_teacherId_dayOfWeek_periodNumber_key" ON "SchoolTimetableEntry"("teacherId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "SchoolSubstituteAssignment_organizationId_attendanceDate_st_idx" ON "SchoolSubstituteAssignment"("organizationId", "attendanceDate", "status");

-- CreateIndex
CREATE INDEX "SchoolSubstituteAssignment_organizationId_substituteTeacher_idx" ON "SchoolSubstituteAssignment"("organizationId", "substituteTeacherId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubstituteAssignment_timetableEntryId_attendanceDate_key" ON "SchoolSubstituteAssignment"("timetableEntryId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "SchoolAcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SchoolSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SchoolSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "SchoolTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "SchoolTeacherAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTimetableEntry" ADD CONSTRAINT "SchoolTimetableEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "SchoolTimetableEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_absentTeacherId_fkey" FOREIGN KEY ("absentTeacherId") REFERENCES "SchoolTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "SchoolTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubstituteAssignment" ADD CONSTRAINT "SchoolSubstituteAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
