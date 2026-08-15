import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AcademicYearInput, SchoolClassInput, SchoolSectionInput, SchoolStudentInput, SchoolStudentUpdateInput } from "./school.validation.js";

export class SchoolService {
  async list(organizationId: string) {
    const academicYears = await prisma.schoolAcademicYear.findMany({
      where: { organizationId, deletedAt: null },
      include: { classes: { where: { organizationId, deletedAt: null }, include: { sections: { where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      orderBy: [{ isCurrent: "desc" }, { startsOn: "desc" }],
    });
    const students = await prisma.schoolStudent.findMany({
      where: { organizationId, deletedAt: null },
      include: { guardians: { include: { guardian: { select: { id: true, firstName: true, lastName: true, relationship: true, phone: true, email: true } } } }, enrollments: { where: { organizationId, deletedAt: null, status: "ACTIVE" }, include: { academicYear: { select: { id: true, name: true } }, schoolClass: { select: { id: true, name: true, code: true } }, section: { select: { id: true, name: true } } }, take: 1 } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return { academicYears, students, metrics: { academicYears: academicYears.length, classes: academicYears.flatMap((item) => item.classes).length, sections: academicYears.flatMap((item) => item.classes.flatMap((schoolClass) => schoolClass.sections)).length, students: students.filter((item) => item.status === "ACTIVE").length } };
  }

  async createAcademicYear(organizationId: string, userId: string, input: AcademicYearInput) {
    return prisma.$transaction(async (tx) => {
      if (input.isCurrent) await tx.schoolAcademicYear.updateMany({ where: { organizationId, isCurrent: true, deletedAt: null }, data: { isCurrent: false, updatedById: userId } });
      return tx.schoolAcademicYear.create({ data: { ...input, organizationId, createdById: userId, updatedById: userId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createClass(organizationId: string, userId: string, input: SchoolClassInput) {
    const year = await prisma.schoolAcademicYear.findFirst({ where: { id: input.academicYearId, organizationId, deletedAt: null }, select: { id: true } });
    if (!year) throw new AppError(404, "Academic year was not found.", "ACADEMIC_YEAR_NOT_FOUND");
    return prisma.schoolClass.create({ data: { ...input, organizationId, createdById: userId, updatedById: userId } });
  }

  async createSection(organizationId: string, userId: string, input: SchoolSectionInput) {
    const schoolClass = await prisma.schoolClass.findFirst({ where: { id: input.classId, organizationId, deletedAt: null, academicYear: { organizationId, deletedAt: null } }, select: { id: true } });
    if (!schoolClass) throw new AppError(404, "Class was not found.", "SCHOOL_CLASS_NOT_FOUND");
    return prisma.schoolSection.create({ data: { ...input, capacity: input.capacity ?? null, organizationId, createdById: userId, updatedById: userId } });
  }

  async createStudent(organizationId: string, userId: string, input: SchoolStudentInput) {
    return prisma.$transaction(async (tx) => {
      const section = await tx.schoolSection.findFirst({ where: { id: input.sectionId, organizationId, deletedAt: null, schoolClass: { id: input.classId, organizationId, academicYearId: input.academicYearId, deletedAt: null, academicYear: { organizationId, deletedAt: null } } }, select: { id: true, capacity: true, _count: { select: { enrollments: { where: { organizationId, status: "ACTIVE", deletedAt: null } } } } } });
      if (!section) throw new AppError(404, "The selected academic placement was not found.", "SCHOOL_PLACEMENT_NOT_FOUND");
      if (section.capacity && section._count.enrollments >= section.capacity) throw new AppError(409, "The selected section has reached its capacity.", "SCHOOL_SECTION_FULL");
      const studentNumber = `STU-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const student = await tx.schoolStudent.create({ data: { organizationId, studentNumber, firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth, gender: input.gender, admissionDate: input.admissionDate, createdById: userId, updatedById: userId } });
      const guardian = await tx.schoolGuardian.create({ data: { organizationId, firstName: input.guardian.firstName, lastName: input.guardian.lastName, relationship: input.guardian.relationship, phone: input.guardian.phone, email: input.guardian.email, address: input.guardian.address, createdById: userId, updatedById: userId } });
      await tx.schoolStudentGuardian.create({ data: { organizationId, studentId: student.id, guardianId: guardian.id, isPrimary: true, canPickup: input.guardian.canPickup } });
      await tx.schoolEnrollment.create({ data: { organizationId, studentId: student.id, academicYearId: input.academicYearId, classId: input.classId, sectionId: input.sectionId, rollNumber: input.rollNumber, joinedOn: input.admissionDate, createdById: userId, updatedById: userId } });
      return student;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStudent(organizationId: string, userId: string, id: string, input: SchoolStudentUpdateInput) {
    const updated = await prisma.schoolStudent.updateMany({ where: { id, organizationId, deletedAt: null }, data: { ...input, dateOfBirth: input.dateOfBirth ?? null, updatedById: userId } });
    if (!updated.count) throw new AppError(404, "Student was not found.", "SCHOOL_STUDENT_NOT_FOUND");
    return prisma.schoolStudent.findFirstOrThrow({ where: { id, organizationId, deletedAt: null } });
  }

  async archiveStudent(organizationId: string, userId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const student = await tx.schoolStudent.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new AppError(404, "Student was not found.", "SCHOOL_STUDENT_NOT_FOUND");
      const now = new Date();
      await tx.schoolEnrollment.updateMany({ where: { studentId: id, organizationId, status: "ACTIVE", deletedAt: null }, data: { status: "WITHDRAWN", deletedAt: now, updatedById: userId } });
      return tx.schoolStudent.update({ where: { id }, data: { status: "INACTIVE", deletedAt: now, updatedById: userId } });
    });
  }
}
