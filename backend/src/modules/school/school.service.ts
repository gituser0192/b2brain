import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AcademicYearInput, SchoolClassInput, SchoolSectionInput } from "./school.validation.js";

export class SchoolService {
  async list(organizationId: string) {
    const academicYears = await prisma.schoolAcademicYear.findMany({
      where: { organizationId, deletedAt: null },
      include: { classes: { where: { organizationId, deletedAt: null }, include: { sections: { where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      orderBy: [{ isCurrent: "desc" }, { startsOn: "desc" }],
    });
    return { academicYears, metrics: { academicYears: academicYears.length, classes: academicYears.flatMap((item) => item.classes).length, sections: academicYears.flatMap((item) => item.classes.flatMap((schoolClass) => schoolClass.sections)).length } };
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
}
