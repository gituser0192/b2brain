-- CreateEnum
CREATE TYPE "SchoolStudentAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "SchoolTeacherAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE');

-- CreateTable
CREATE TABLE "SchoolStudentAttendance" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" "SchoolStudentAttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolStudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolTeacherAttendance" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" "SchoolTeacherAttendanceStatus" NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "remarks" TEXT,
    "markedById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolTeacherAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolStudentAttendance_organizationId_attendanceDate_statu_idx" ON "SchoolStudentAttendance"("organizationId", "attendanceDate", "status");

-- CreateIndex
CREATE INDEX "SchoolStudentAttendance_organizationId_studentId_attendance_idx" ON "SchoolStudentAttendance"("organizationId", "studentId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStudentAttendance_enrollmentId_attendanceDate_key" ON "SchoolStudentAttendance"("enrollmentId", "attendanceDate");

-- CreateIndex
CREATE INDEX "SchoolTeacherAttendance_organizationId_attendanceDate_statu_idx" ON "SchoolTeacherAttendance"("organizationId", "attendanceDate", "status");

-- CreateIndex
CREATE INDEX "SchoolTeacherAttendance_organizationId_teacherId_attendance_idx" ON "SchoolTeacherAttendance"("organizationId", "teacherId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTeacherAttendance_teacherId_attendanceDate_key" ON "SchoolTeacherAttendance"("teacherId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "SchoolStudentAttendance" ADD CONSTRAINT "SchoolStudentAttendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentAttendance" ADD CONSTRAINT "SchoolStudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentAttendance" ADD CONSTRAINT "SchoolStudentAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentAttendance" ADD CONSTRAINT "SchoolStudentAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudentAttendance" ADD CONSTRAINT "SchoolStudentAttendance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAttendance" ADD CONSTRAINT "SchoolTeacherAttendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAttendance" ADD CONSTRAINT "SchoolTeacherAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "SchoolTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAttendance" ADD CONSTRAINT "SchoolTeacherAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolTeacherAttendance" ADD CONSTRAINT "SchoolTeacherAttendance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
