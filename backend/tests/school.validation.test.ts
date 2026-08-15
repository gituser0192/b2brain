import { describe, expect, it } from "vitest";
import { academicYearSchema, schoolClassSchema, schoolSectionSchema, schoolStudentSchema, schoolSubjectSchema, schoolTeacherAssignmentSchema, studentAttendanceSchema, teacherAttendanceSchema, schoolTimetableEntrySchema, schoolSubstituteSchema, schoolImportConfirmSchema } from "../src/modules/school/school.validation.js";

describe("school foundation validation", () => {
  it("accepts a valid academic year and rejects tenant ownership fields", () => {
    expect(academicYearSchema.parse({ name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31", isCurrent: true }).name).toBe("2026-27");
    expect(() => academicYearSchema.parse({ name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31", isCurrent: true, organizationId: crypto.randomUUID() })).toThrow();
  });
  it("requires the year to end after it starts", () => expect(() => academicYearSchema.parse({ name: "Bad year", startsOn: "2027-04-01", endsOn: "2027-03-31", isCurrent: false })).toThrow());
  it("normalizes class codes and rejects frontend actor fields", () => {
    expect(schoolClassSchema.parse({ academicYearId: crypto.randomUUID(), name: "Grade 1", code: "g1", sortOrder: 1 }).code).toBe("G1");
    expect(() => schoolSectionSchema.parse({ classId: crypto.randomUUID(), name: "A", room: "101", capacity: 40, createdById: crypto.randomUUID() })).toThrow();
  });
  it("validates admission placement and never accepts frontend ownership", () => {
    const input = { firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2018-05-10", gender: "Male", admissionDate: "2026-04-01", academicYearId: crypto.randomUUID(), classId: crypto.randomUUID(), sectionId: crypto.randomUUID(), rollNumber: "12", guardian: { firstName: "Ravi", lastName: "Sharma", relationship: "Father", phone: "+919876543210", email: "ravi@example.com", address: "Delhi", canPickup: true } };
    expect(schoolStudentSchema.parse(input).guardian.phone).toBe("+919876543210");
    expect(() => schoolStudentSchema.parse({ ...input, organizationId: crypto.randomUUID(), createdById: crypto.randomUUID() })).toThrow();
  });
  it("normalizes subjects and protects teacher assignment ownership",()=>{expect(schoolSubjectSchema.parse({name:"Mathematics",code:"math",description:""}).code).toBe("MATH");const assignment={teacherId:crypto.randomUUID(),subjectId:crypto.randomUUID(),academicYearId:crypto.randomUUID(),classId:crypto.randomUUID(),sectionId:crypto.randomUUID(),isClassTeacher:false};expect(schoolTeacherAssignmentSchema.parse(assignment)).toEqual(assignment);expect(()=>schoolTeacherAssignmentSchema.parse({...assignment,organizationId:crypto.randomUUID()})).toThrow()});
  it("validates bulk attendance without frontend tenant fields",()=>{const input={date:"2026-08-15",records:[{enrollmentId:crypto.randomUUID(),status:"PRESENT",remarks:""}]};expect(studentAttendanceSchema.parse(input).records[0]?.remarks).toBeNull();expect(()=>studentAttendanceSchema.parse({...input,organizationId:crypto.randomUUID()})).toThrow()});
  it("accepts mixed student and teacher statuses with empty remarks",()=>{const studentInput={date:"2026-08-15",records:[{enrollmentId:crypto.randomUUID(),status:"LATE",remarks:null},{enrollmentId:crypto.randomUUID(),status:"ABSENT",remarks:null}]};expect(studentAttendanceSchema.parse(studentInput).records.map(record=>record.status)).toEqual(["LATE","ABSENT"]);const teacherInput={date:"2026-08-15",records:[{teacherId:crypto.randomUUID(),status:"HALF_DAY",checkInAt:null,checkOutAt:null,remarks:null},{teacherId:crypto.randomUUID(),status:"LEAVE",checkInAt:null,checkOutAt:null,remarks:null}]};expect(teacherAttendanceSchema.parse(teacherInput).records.map(record=>record.status)).toEqual(["HALF_DAY","LEAVE"])});
  it("validates timetable periods and substitute assignments without ownership fields",()=>{const period={teacherAssignmentId:crypto.randomUUID(),dayOfWeek:1,periodNumber:2,startsAt:"09:00",endsAt:"09:45",room:"101"};expect(schoolTimetableEntrySchema.parse(period).periodNumber).toBe(2);expect(()=>schoolTimetableEntrySchema.parse({...period,endsAt:"08:45"})).toThrow();expect(()=>schoolTimetableEntrySchema.parse({...period,organizationId:crypto.randomUUID()})).toThrow();const substitute={timetableEntryId:crypto.randomUUID(),attendanceDate:"2026-08-17",substituteTeacherId:crypto.randomUUID(),notes:null};expect(schoolSubstituteSchema.parse(substitute).notes).toBeNull()});
  it("accepts only a server-owned import batch reference",()=>{const batchId=crypto.randomUUID();expect(schoolImportConfirmSchema.parse({batchId})).toEqual({batchId});expect(()=>schoolImportConfirmSchema.parse({batchId,organizationId:crypto.randomUUID()})).toThrow()});
});
