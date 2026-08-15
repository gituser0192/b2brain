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

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SchoolClassInput = z.infer<typeof schoolClassSchema>;
export type SchoolSectionInput = z.infer<typeof schoolSectionSchema>;
export type SchoolStudentInput = z.infer<typeof schoolStudentSchema>;
export type SchoolStudentUpdateInput = z.infer<typeof schoolStudentUpdateSchema>;
