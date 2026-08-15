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

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SchoolClassInput = z.infer<typeof schoolClassSchema>;
export type SchoolSectionInput = z.infer<typeof schoolSectionSchema>;
