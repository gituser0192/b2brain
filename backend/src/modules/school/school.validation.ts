import { z } from "zod";

const date = z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`));

export const academicYearSchema = z.object({
  name: z.string().trim().min(2).max(40),
  startsOn: date,
  endsOn: date,
  isCurrent: z.boolean(),
}).strict().refine((value) => value.endsOn > value.startsOn, { message: "Academic year must end after it starts.", path: ["endsOn"] });

export const schoolClassSchema = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  sortOrder: z.number().int().min(0).max(1000),
}).strict();

export const schoolSectionSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  room: z.string().trim().max(60).optional().or(z.literal("")).transform((value) => value || null),
  capacity: z.number().int().positive().max(500).optional().nullable(),
}).strict();

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((value) => value || null);
export const schoolStudentSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: optionalText(100),
  dateOfBirth: z.string().date().optional().nullable().transform((value) => value ? new Date(`${value}T00:00:00.000Z`) : null),
  gender: optionalText(30),
  admissionDate: date,
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  rollNumber: optionalText(30),
  guardian: z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: optionalText(100),
    relationship: z.string().trim().min(2).max(40),
    phone: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/),
    email: z.string().trim().email().max(254).optional().or(z.literal("")).transform((value) => value || null),
    address: optionalText(500),
    canPickup: z.boolean(),
  }).strict(),
}).strict();

export const schoolStudentUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: optionalText(100),
  dateOfBirth: z.string().date().optional().nullable().transform((value) => value ? new Date(`${value}T00:00:00.000Z`) : null),
  gender: optionalText(30),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"]),
}).strict();

export const schoolSubjectSchema = z.object({ name:z.string().trim().min(2).max(100), code:z.string().trim().min(1).max(20).transform(value=>value.toUpperCase()), description:optionalText(500) }).strict();
export const schoolTeacherSchema = z.object({ firstName:z.string().trim().min(2).max(100), lastName:optionalText(100), email:z.string().trim().email().max(254).optional().or(z.literal("")).transform(value=>value||null), phone:z.string().trim().regex(/^\+?[1-9]\d{6,14}$/).optional().or(z.literal("")).transform(value=>value||null), qualification:optionalText(200), joinedOn:date, maxPeriodsPerDay:z.number().int().min(1).max(12), maxPeriodsPerWeek:z.number().int().min(1).max(70) }).strict();
export const schoolTeacherAssignmentSchema = z.object({ teacherId:z.string().uuid(), subjectId:z.string().uuid(), academicYearId:z.string().uuid(), classId:z.string().uuid(), sectionId:z.string().uuid(), isClassTeacher:z.boolean() }).strict();
export const schoolAttendanceQuerySchema=z.object({date:z.string().date()}).strict();
const optionalNullableText = (max: number) => z.string().trim().max(max).optional().nullable().or(z.literal("")).transform((value) => value || null);
export const studentAttendanceSchema=z.object({date:z.string().date(),records:z.array(z.object({enrollmentId:z.string().uuid(),status:z.enum(["PRESENT","ABSENT","LATE","EXCUSED"]),remarks:optionalNullableText(300)}).strict()).min(1).max(500)}).strict();
export const teacherAttendanceSchema=z.object({date:z.string().date(),records:z.array(z.object({teacherId:z.string().uuid(),status:z.enum(["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE"]),checkInAt:z.string().datetime().optional().nullable(),checkOutAt:z.string().datetime().optional().nullable(),remarks:optionalNullableText(300)}).strict()).min(1).max(300)}).strict();
const schoolTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time.");
export const schoolTimetableQuerySchema = z.object({ academicYearId: z.string().uuid().optional(), sectionId: z.string().uuid().optional(), teacherId: z.string().uuid().optional() }).strict();
export const schoolTimetableEntrySchema = z.object({ teacherAssignmentId: z.string().uuid(), dayOfWeek: z.number().int().min(1).max(6), periodNumber: z.number().int().min(1).max(20), startsAt: schoolTime, endsAt: schoolTime, room: optionalNullableText(60) }).strict().refine(value => value.endsAt > value.startsAt, { message: "End time must be after start time.", path: ["endsAt"] });
export const schoolSubstituteQuerySchema = z.object({ date: z.string().date() }).strict();
export const schoolSubstituteSchema = z.object({ timetableEntryId: z.string().uuid(), attendanceDate: z.string().date(), substituteTeacherId: z.string().uuid(), notes: optionalNullableText(300) }).strict();

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SchoolClassInput = z.infer<typeof schoolClassSchema>;
export type SchoolSectionInput = z.infer<typeof schoolSectionSchema>;
export type SchoolStudentInput = z.infer<typeof schoolStudentSchema>;
export type SchoolStudentUpdateInput = z.infer<typeof schoolStudentUpdateSchema>;
export type SchoolSubjectInput = z.infer<typeof schoolSubjectSchema>;
export type SchoolTeacherInput = z.infer<typeof schoolTeacherSchema>;
export type SchoolTeacherAssignmentInput = z.infer<typeof schoolTeacherAssignmentSchema>;
export type StudentAttendanceInput=z.infer<typeof studentAttendanceSchema>;
export type TeacherAttendanceInput=z.infer<typeof teacherAttendanceSchema>;
export type SchoolTimetableEntryInput = z.infer<typeof schoolTimetableEntrySchema>;
export type SchoolSubstituteInput = z.infer<typeof schoolSubstituteSchema>;
