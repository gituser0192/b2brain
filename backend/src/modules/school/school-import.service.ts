import readExcelFile, { type Row } from "read-excel-file/node";
import { parse as parseCsv } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

type ImportKind = "STUDENTS" | "TEACHERS";
type ImportError = {
  sheet: string;
  row: number;
  field: string;
  message: string;
};
type StudentRow = {
  row: number;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  admissionDate: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  rollNumber: string | null;
  guardian: {
    firstName: string;
    lastName: string | null;
    relationship: string;
    phone: string;
    email: string | null;
    address: string | null;
    canPickup: boolean;
  };
};
type TeacherRow = {
  row: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  qualification: string | null;
  joinedOn: string;
  maxPeriodsPerDay: number;
  maxPeriodsPerWeek: number;
};
type ImportPayload = { students: StudentRow[]; teachers: TeacherRow[] };

const requiredText = z.string().trim().min(1).max(100),
  optionalText = z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
  date = z.string().date();
const studentSchema = z
  .object({
    firstName: requiredText,
    lastName: optionalText,
    dateOfBirth: z
      .union([date, z.literal("")])
      .transform((value) => value || null),
    gender: optionalText,
    admissionDate: date,
    academicYear: z.string().trim().min(1),
    classCode: z.string().trim().min(1),
    section: z.string().trim().min(1),
    rollNumber: optionalText,
    guardianFirstName: requiredText,
    guardianLastName: optionalText,
    relationship: requiredText,
    guardianPhone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/),
    guardianEmail: z
      .union([z.string().trim().email(), z.literal("")])
      .transform((value) => value || null),
    address: optionalText,
    canPickup: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => !["no", "false", "0"].includes(value)),
  })
  .strict();
const teacherSchema = z
  .object({
    firstName: requiredText,
    lastName: optionalText,
    email: z
      .union([z.string().trim().email(), z.literal("")])
      .transform((value) => value || null),
    phone: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\+?[1-9]\d{6,14}$/),
        z.literal(""),
      ])
      .transform((value) => value || null),
    qualification: optionalText,
    joinedOn: date,
    maxPeriodsPerDay: z.preprocess(
      (value) => (value === "" ? 6 : value),
      z.coerce.number().int().min(1).max(12),
    ),
    maxPeriodsPerWeek: z.preprocess(
      (value) => (value === "" ? 30 : value),
      z.coerce.number().int().min(1).max(70),
    ),
  })
  .strict();
const studentColumns = {
  firstName: "firstname",
  lastName: "lastname",
  dateOfBirth: "dateofbirth",
  gender: "gender",
  admissionDate: "admissiondate",
  academicYear: "academicyear",
  classCode: "classcode",
  section: "section",
  rollNumber: "rollnumber",
  guardianFirstName: "guardianfirstname",
  guardianLastName: "guardianlastname",
  relationship: "relationship",
  guardianPhone: "guardianphone",
  guardianEmail: "guardianemail",
  address: "address",
  canPickup: "canpickup",
} as const;
const teacherColumns = {
  firstName: "firstname",
  lastName: "lastname",
  email: "email",
  phone: "phone",
  qualification: "qualification",
  joinedOn: "joinedon",
  maxPeriodsPerDay: "maxperiodsday",
  maxPeriodsPerWeek: "maxperiodsweek",
} as const;

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
const cellText = (value: Row[number] | undefined): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
};
const readRows = (
  sheetName: string,
  data: Row[],
  columns: Record<string, string>,
) => {
  const headers = new Map<string, number>();
  for (const [index, value] of (data[0] ?? []).entries())
    headers.set(normalizeHeader(cellText(value)), index);
  const missing = Object.entries(columns)
    .filter(([, header]) => !headers.has(header))
    .map(([field]) => field);
  if (missing.length)
    throw new AppError(
      422,
      `${sheetName} is missing required template columns: ${missing.join(", ")}.`,
      "SCHOOL_IMPORT_COLUMNS_MISSING",
    );
  const rows: { row: number; values: Record<string, string> }[] = [];
  data.slice(1).forEach((row, offset) => {
    const index = offset + 2;
    const values = Object.fromEntries(
      Object.entries(columns).map(([field, header]) => [
        field,
        cellText(row[headers.get(header)!]),
      ]),
    );
    if (Object.values(values).some(Boolean)) rows.push({ row: index, values });
  });
  return rows;
};

export class SchoolImportService {
  async preview(
    organizationId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string },
    kind?: ImportKind,
  ) {
    await prisma.schoolImportBatch.deleteMany({
      where: {
        organizationId,
        status: "PREVIEWED",
        expiresAt: { lte: new Date() },
      },
    });
    const extension = file.originalname.toLowerCase().split(".").pop();
    let sheets: { sheet: string; data: Row[] }[];
    if (extension === "csv") {
      if (!kind)
        throw new AppError(
          422,
          "Choose Students or Teachers for a CSV file.",
          "SCHOOL_IMPORT_KIND_REQUIRED",
        );
      sheets = [
        {
          sheet: kind === "STUDENTS" ? "Students" : "Teachers",
          data: parseCsv(file.buffer, {
            bom: true,
            relax_column_count: true,
            skip_empty_lines: true,
          }) as Row[],
        },
      ];
    } else if (extension === "xlsx") {
      sheets = await readExcelFile(file.buffer);
    } else
      throw new AppError(
        415,
        "Upload an .xlsx or .csv file.",
        "SCHOOL_IMPORT_FILE_TYPE",
      );
    const studentSheet = sheets.find((item) => item.sheet === "Students"),
      teacherSheet = sheets.find((item) => item.sheet === "Teachers");
    if (!studentSheet && !teacherSheet)
      throw new AppError(
        422,
        "The workbook must contain a Students or Teachers sheet.",
        "SCHOOL_IMPORT_SHEETS_MISSING",
      );
    const errors: ImportError[] = [],
      payload: ImportPayload = { students: [], teachers: [] };
    const years = await prisma.schoolAcademicYear.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          classes: {
            where: { organizationId, deletedAt: null },
            include: {
              sections: {
                where: { organizationId, deletedAt: null },
                include: {
                  _count: {
                    select: {
                      enrollments: {
                        where: {
                          organizationId,
                          status: "ACTIVE",
                          deletedAt: null,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      placement = new Map<
        string,
        { academicYearId: string; classId: string; sectionId: string }
      >(),
      sectionRemaining = new Map<string, number | null>();
    for (const year of years)
      for (const schoolClass of year.classes)
        for (const section of schoolClass.sections) {
          placement.set(
            `${year.name.trim().toLowerCase()}|${schoolClass.code.trim().toUpperCase()}|${section.name.trim().toLowerCase()}`,
            {
              academicYearId: year.id,
              classId: schoolClass.id,
              sectionId: section.id,
            },
          );
          sectionRemaining.set(
            section.id,
            section.capacity === null
              ? null
              : Math.max(0, section.capacity - section._count.enrollments),
          );
        }
    const [existingEnrollments, existingTeachers] = await Promise.all([
      prisma.schoolEnrollment.findMany({
        where: {
          organizationId,
          sectionId: {
            in: [
              ...new Set([...placement.values()].map((item) => item.sectionId)),
            ],
          },
          rollNumber: { not: null },
          deletedAt: null,
        },
        select: { sectionId: true, rollNumber: true },
      }),
      prisma.schoolTeacher.findMany({
        where: { organizationId, deletedAt: null },
        select: { email: true, phone: true },
      }),
    ]);
    const existingRolls = new Set(
        existingEnrollments.map(
          (item) => `${item.sectionId}|${item.rollNumber!.toLowerCase()}`,
        ),
      ),
      existingEmails = new Set(
        existingTeachers
          .map((item) => item.email?.toLowerCase())
          .filter((value): value is string => Boolean(value)),
      ),
      existingPhones = new Set(
        existingTeachers
          .map((item) => item.phone)
          .filter((value): value is string => Boolean(value)),
      );
    if (studentSheet) {
      const seenRolls = new Set<string>(),
        sources = readRows("Students", studentSheet.data, studentColumns);
      if (sources.length > 500)
        throw new AppError(
          422,
          "A single import supports up to 500 students.",
          "SCHOOL_IMPORT_LIMIT",
        );
      for (const source of sources) {
        const parsed = studentSchema.safeParse(source.values);
        if (!parsed.success) {
          for (const issue of parsed.error.issues)
            errors.push({
              sheet: "Students",
              row: source.row,
              field: String(issue.path[0] ?? "row"),
              message: issue.message,
            });
          continue;
        }
        const key = `${parsed.data.academicYear.toLowerCase()}|${parsed.data.classCode.toUpperCase()}|${parsed.data.section.toLowerCase()}`,
          place = placement.get(key);
        if (!place) {
          errors.push({
            sheet: "Students",
            row: source.row,
            field: "placement",
            message: "Academic year, class code, or section was not found.",
          });
          continue;
        }
        if (parsed.data.rollNumber) {
          const rollKey = `${place.sectionId}|${parsed.data.rollNumber.toLowerCase()}`;
          if (seenRolls.has(rollKey)) {
            errors.push({
              sheet: "Students",
              row: source.row,
              field: "rollNumber",
              message: "Duplicate roll number in this file.",
            });
            continue;
          }
          seenRolls.add(rollKey);
          if (existingRolls.has(rollKey)) {
            errors.push({
              sheet: "Students",
              row: source.row,
              field: "rollNumber",
              message: "This roll number already exists in the section.",
            });
            continue;
          }
        }
        const remaining = sectionRemaining.get(place.sectionId);
        if (remaining !== null && remaining !== undefined && remaining <= 0) {
          errors.push({
            sheet: "Students",
            row: source.row,
            field: "section",
            message: "This section does not have enough remaining capacity.",
          });
          continue;
        }
        if (remaining !== null && remaining !== undefined)
          sectionRemaining.set(place.sectionId, remaining - 1);
        payload.students.push({
          row: source.row,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          dateOfBirth: parsed.data.dateOfBirth,
          gender: parsed.data.gender,
          admissionDate: parsed.data.admissionDate,
          ...place,
          rollNumber: parsed.data.rollNumber,
          guardian: {
            firstName: parsed.data.guardianFirstName,
            lastName: parsed.data.guardianLastName,
            relationship: parsed.data.relationship,
            phone: parsed.data.guardianPhone,
            email: parsed.data.guardianEmail,
            address: parsed.data.address,
            canPickup: parsed.data.canPickup,
          },
        });
      }
    }
    if (teacherSheet) {
      const seenEmails = new Set<string>(),
        seenPhones = new Set<string>(),
        sources = readRows("Teachers", teacherSheet.data, teacherColumns);
      if (sources.length > 300)
        throw new AppError(
          422,
          "A single import supports up to 300 teachers.",
          "SCHOOL_IMPORT_LIMIT",
        );
      for (const source of sources) {
        const parsed = teacherSchema.safeParse(source.values);
        if (!parsed.success) {
          for (const issue of parsed.error.issues)
            errors.push({
              sheet: "Teachers",
              row: source.row,
              field: String(issue.path[0] ?? "row"),
              message: issue.message,
            });
          continue;
        }
        if (parsed.data.email) {
          const email = parsed.data.email.toLowerCase(),
            exists = seenEmails.has(email) || existingEmails.has(email);
          if (exists) {
            errors.push({
              sheet: "Teachers",
              row: source.row,
              field: "email",
              message: "This teacher email already exists.",
            });
            continue;
          }
          seenEmails.add(email);
        }
        if (parsed.data.phone) {
          const exists =
            seenPhones.has(parsed.data.phone) ||
            existingPhones.has(parsed.data.phone);
          if (exists) {
            errors.push({
              sheet: "Teachers",
              row: source.row,
              field: "phone",
              message: "This teacher phone already exists.",
            });
            continue;
          }
          seenPhones.add(parsed.data.phone);
        }
        payload.teachers.push({ row: source.row, ...parsed.data });
      }
    }
    const summary = {
      students: {
        valid: payload.students.length,
        total:
          payload.students.length +
          errors.filter((item) => item.sheet === "Students").length,
      },
      teachers: {
        valid: payload.teachers.length,
        total:
          payload.teachers.length +
          errors.filter((item) => item.sheet === "Teachers").length,
      },
      failed: errors.length,
      errors: errors.slice(0, 200),
    };
    const batch = await prisma.schoolImportBatch.create({
      data: {
        organizationId,
        createdById: userId,
        fileName: file.originalname,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return {
      batchId: batch.id,
      ...summary,
      canImport:
        errors.length === 0 &&
        payload.students.length + payload.teachers.length > 0,
      preview: {
        students: payload.students.slice(0, 10),
        teachers: payload.teachers.slice(0, 10),
      },
      expiresAt: batch.expiresAt,
    };
  }

  async confirm(organizationId: string, userId: string, batchId: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const batch = await tx.schoolImportBatch.findFirst({
            where: {
              id: batchId,
              organizationId,
              createdById: userId,
              status: "PREVIEWED",
              expiresAt: { gt: new Date() },
            },
          });
          if (!batch)
            throw new AppError(
              404,
              "Import preview was not found or has expired.",
              "SCHOOL_IMPORT_PREVIEW_NOT_FOUND",
            );
          const summary = batch.summary as { failed?: number };
          if (summary.failed)
            throw new AppError(
              422,
              "Resolve all preview errors before importing.",
              "SCHOOL_IMPORT_HAS_ERRORS",
            );
          const payload = batch.payload as unknown as ImportPayload;
          const sectionIds = [
              ...new Set(payload.students.map((item) => item.sectionId)),
            ],
            sections = await tx.schoolSection.findMany({
              where: {
                id: { in: sectionIds },
                organizationId,
                deletedAt: null,
              },
              include: {
                schoolClass: { select: { id: true, academicYearId: true } },
                _count: {
                  select: {
                    enrollments: {
                      where: {
                        organizationId,
                        status: "ACTIVE",
                        deletedAt: null,
                      },
                    },
                  },
                },
              },
            }),
            sectionMap = new Map(sections.map((item) => [item.id, item])),
            incomingBySection = new Map<string, number>();
          for (const item of payload.students)
            incomingBySection.set(
              item.sectionId,
              (incomingBySection.get(item.sectionId) ?? 0) + 1,
            );
          for (const item of payload.students) {
            const section = sectionMap.get(item.sectionId);
            if (
              !section ||
              section.schoolClass.id !== item.classId ||
              section.schoolClass.academicYearId !== item.academicYearId
            )
              throw new AppError(
                409,
                `Student row ${item.row} placement changed after preview. Preview the file again.`,
                "SCHOOL_IMPORT_STALE",
              );
            if (
              section.capacity !== null &&
              section._count.enrollments +
                (incomingBySection.get(section.id) ?? 0) >
                section.capacity
            )
              throw new AppError(
                409,
                "A section no longer has enough capacity. No rows were imported; preview the file again.",
                "SCHOOL_IMPORT_STALE",
              );
          }
          const currentRolls = new Set(
            (
              await tx.schoolEnrollment.findMany({
                where: {
                  organizationId,
                  sectionId: { in: sectionIds },
                  rollNumber: { not: null },
                  deletedAt: null,
                },
                select: { sectionId: true, rollNumber: true },
              })
            ).map(
              (item) => `${item.sectionId}|${item.rollNumber!.toLowerCase()}`,
            ),
          );
          if (
            payload.students.some(
              (item) =>
                item.rollNumber &&
                currentRolls.has(
                  `${item.sectionId}|${item.rollNumber.toLowerCase()}`,
                ),
            )
          )
            throw new AppError(
              409,
              "A roll number was added after preview. No rows were imported; preview the file again.",
              "SCHOOL_IMPORT_STALE",
            );
          const teacherEmails = payload.teachers
              .map((item) => item.email)
              .filter((value): value is string => Boolean(value)),
            teacherPhones = payload.teachers
              .map((item) => item.phone)
              .filter((value): value is string => Boolean(value)),
            teacherConflict = await tx.schoolTeacher.findFirst({
              where: {
                organizationId,
                deletedAt: null,
                OR: [
                  ...(teacherEmails.length
                    ? [
                        {
                          email: {
                            in: teacherEmails,
                            mode: "insensitive" as const,
                          },
                        },
                      ]
                    : []),
                  ...(teacherPhones.length
                    ? [{ phone: { in: teacherPhones } }]
                    : []),
                ],
              },
              select: { id: true },
            });
          if (teacherConflict)
            throw new AppError(
              409,
              "A teacher email or phone was added after preview. No rows were imported; preview the file again.",
              "SCHOOL_IMPORT_STALE",
            );
          for (const item of payload.students) {
            const { canPickup, ...guardianData } = item.guardian;
            const student = await tx.schoolStudent.create({
                data: {
                  organizationId,
                  studentNumber: `STU-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                  firstName: item.firstName,
                  lastName: item.lastName,
                  dateOfBirth: item.dateOfBirth
                    ? new Date(`${item.dateOfBirth}T00:00:00.000Z`)
                    : null,
                  gender: item.gender,
                  admissionDate: new Date(
                    `${item.admissionDate}T00:00:00.000Z`,
                  ),
                  createdById: userId,
                  updatedById: userId,
                },
              }),
              guardian = await tx.schoolGuardian.create({
                data: {
                  organizationId,
                  ...guardianData,
                  createdById: userId,
                  updatedById: userId,
                },
              });
            await tx.schoolStudentGuardian.create({
              data: {
                organizationId,
                studentId: student.id,
                guardianId: guardian.id,
                isPrimary: true,
                canPickup,
              },
            });
            await tx.schoolEnrollment.create({
              data: {
                organizationId,
                studentId: student.id,
                academicYearId: item.academicYearId,
                classId: item.classId,
                sectionId: item.sectionId,
                rollNumber: item.rollNumber,
                joinedOn: new Date(`${item.admissionDate}T00:00:00.000Z`),
                createdById: userId,
                updatedById: userId,
              },
            });
          }
          for (const item of payload.teachers)
            await tx.schoolTeacher.create({
              data: {
                organizationId,
                employeeNumber: `TCH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
                firstName: item.firstName,
                lastName: item.lastName,
                email: item.email,
                phone: item.phone,
                qualification: item.qualification,
                joinedOn: new Date(`${item.joinedOn}T00:00:00.000Z`),
                maxPeriodsPerDay: item.maxPeriodsPerDay,
                maxPeriodsPerWeek: item.maxPeriodsPerWeek,
                createdById: userId,
                updatedById: userId,
              },
            });
          await tx.schoolImportBatch.update({
            where: { id: batch.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              payload: { students: [], teachers: [] },
            },
          });
          return {
            studentsImported: payload.students.length,
            teachersImported: payload.teachers.length,
            batchId: batch.id,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 60_000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(
          409,
          "A duplicate was created after preview. No rows were imported; preview the file again.",
          "SCHOOL_IMPORT_DUPLICATE",
        );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2028"
      )
        throw new AppError(
          503,
          "The school import took too long to complete. No rows were imported; please try again.",
          "SCHOOL_IMPORT_TIMEOUT",
        );
      throw error;
    }
  }
}
