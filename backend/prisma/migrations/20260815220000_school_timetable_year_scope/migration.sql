-- Keep historical academic years from blocking a teacher's new timetable.
DROP INDEX "SchoolTimetableEntry_teacherId_dayOfWeek_periodNumber_key";

CREATE UNIQUE INDEX "SchoolTimetableEntry_academicYearId_teacherId_dayOfWeek_per_key"
ON "SchoolTimetableEntry"("academicYearId", "teacherId", "dayOfWeek", "periodNumber");
