import { Router, type RequestHandler } from "express";
import multer from "multer";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { SchoolService } from "./school.service.js";
import { SchoolImportService } from "./school-import.service.js";
import {
  academicYearSchema,
  schoolClassSchema,
  schoolSectionSchema,
  schoolStudentSchema,
  schoolStudentUpdateSchema,
  schoolSubjectSchema,
  schoolTeacherSchema,
  schoolTeacherAssignmentSchema,
  schoolAttendanceQuerySchema,
  studentAttendanceSchema,
  teacherAttendanceSchema,
  schoolTimetableQuerySchema,
  schoolTimetableEntrySchema,
  schoolSubstituteQuerySchema,
  schoolSubstituteSchema,
  schoolImportConfirmSchema,
  type AcademicYearInput,
  type SchoolClassInput,
  type SchoolSectionInput,
  type SchoolStudentInput,
  type SchoolStudentUpdateInput,
  type SchoolSubjectInput,
  type SchoolTeacherInput,
  type SchoolTeacherAssignmentInput,
  type StudentAttendanceInput,
  type TeacherAttendanceInput,
  type SchoolTimetableEntryInput,
  type SchoolSubstituteInput,
  type SchoolImportConfirmInput,
} from "./school.validation.js";

const service = new SchoolService();
const importService = new SchoolImportService();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 },
  fileFilter: (_request, file, callback) =>
    callback(null, /\.(xlsx|csv)$/i.test(file.originalname)),
});
const auth = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
};
export const schoolRouter = Router();
schoolRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("SCHOOL"),
);
schoolRouter.get(
  "/",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) =>
    response.json(success(await service.list(auth(request).organizationId))),
);
schoolRouter.post(
  "/academic-years",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(academicYearSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createAcademicYear(
            context.organizationId,
            context.userId,
            request.body as AcademicYearInput,
          ),
          "Academic year created.",
        ),
      );
  },
);
schoolRouter.post(
  "/classes",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolClassSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createClass(
            context.organizationId,
            context.userId,
            request.body as SchoolClassInput,
          ),
          "Class created.",
        ),
      );
  },
);
schoolRouter.post(
  "/sections",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolSectionSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createSection(
            context.organizationId,
            context.userId,
            request.body as SchoolSectionInput,
          ),
          "Section created.",
        ),
      );
  },
);
schoolRouter.post(
  "/students",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolStudentSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createStudent(
            context.organizationId,
            context.userId,
            request.body as SchoolStudentInput,
          ),
          "Student admitted.",
        ),
      );
  },
);
schoolRouter.put(
  "/students/:id",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolStudentUpdateSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.updateStudent(
          context.organizationId,
          context.userId,
          String(request.params.id),
          request.body as SchoolStudentUpdateInput,
        ),
        "Student updated.",
      ),
    );
  },
);
schoolRouter.delete(
  "/students/:id",
  requirePermission("SCHOOL_MANAGE"),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.archiveStudent(
          context.organizationId,
          context.userId,
          String(request.params.id),
        ),
        "Student archived.",
      ),
    );
  },
);
schoolRouter.post(
  "/subjects",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolSubjectSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createSubject(
            context.organizationId,
            context.userId,
            request.body as SchoolSubjectInput,
          ),
          "Subject created.",
        ),
      );
  },
);
schoolRouter.post(
  "/teachers",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolTeacherSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createTeacher(
            context.organizationId,
            context.userId,
            request.body as SchoolTeacherInput,
          ),
          "Teacher created.",
        ),
      );
  },
);
schoolRouter.post(
  "/teacher-assignments",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolTeacherAssignmentSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.assignTeacher(
            context.organizationId,
            context.userId,
            request.body as SchoolTeacherAssignmentInput,
          ),
          "Teacher assigned.",
        ),
      );
  },
);
schoolRouter.get(
  "/attendance",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) => {
    const context = auth(request),
      query = schoolAttendanceQuerySchema.parse(request.query);
    response.json(
      success(await service.attendance(context.organizationId, query.date)),
    );
  },
);
schoolRouter.put(
  "/attendance/students",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(studentAttendanceSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.saveStudentAttendance(
          context.organizationId,
          context.userId,
          request.body as StudentAttendanceInput,
        ),
        "Student attendance saved.",
      ),
    );
  },
);
schoolRouter.put(
  "/attendance/teachers",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(teacherAttendanceSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.saveTeacherAttendance(
          context.organizationId,
          context.userId,
          request.body as TeacherAttendanceInput,
        ),
        "Teacher attendance saved.",
      ),
    );
  },
);
schoolRouter.get(
  "/guardian-alerts",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) => {
    const context = auth(request),
      date = typeof request.query.date === "string" ? request.query.date : undefined;
    if (date) schoolAttendanceQuerySchema.parse({ date });
    response.json(success(await service.guardianAlerts(context.organizationId, date)));
  },
);
schoolRouter.get(
  "/timetable/daily",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) => {
    const context = auth(request),
      query = schoolAttendanceQuerySchema.parse(request.query);
    response.json(
      success(
        await service.dailyTimetable(context.organizationId, query.date),
      ),
    );
  },
);
schoolRouter.get(
  "/timetable",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) => {
    const context = auth(request),
      query = schoolTimetableQuerySchema.parse(request.query);
    response.json(
      success(await service.timetable(context.organizationId, query)),
    );
  },
);
schoolRouter.post(
  "/timetable",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolTimetableEntrySchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createTimetableEntry(
            context.organizationId,
            context.userId,
            request.body as SchoolTimetableEntryInput,
          ),
          "Timetable period created.",
        ),
      );
  },
);
schoolRouter.delete(
  "/timetable/:id",
  requirePermission("SCHOOL_MANAGE"),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.removeTimetableEntry(
          context.organizationId,
          context.userId,
          String(request.params.id),
        ),
        "Timetable period removed.",
      ),
    );
  },
);
schoolRouter.get(
  "/substitutes",
  requirePermission("SCHOOL_VIEW"),
  async (request, response) => {
    const context = auth(request),
      query = schoolSubstituteQuerySchema.parse(request.query);
    response.json(
      success(
        await service.substituteNeeds(context.organizationId, query.date),
      ),
    );
  },
);
schoolRouter.put(
  "/substitutes",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolSubstituteSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.assignSubstitute(
          context.organizationId,
          context.userId,
          request.body as SchoolSubstituteInput,
        ),
        "Substitute teacher assigned.",
      ),
    );
  },
);
schoolRouter.post(
  "/imports/preview",
  requirePermission("SCHOOL_MANAGE"),
  upload.single("file"),
  async (request, response) => {
    const context = auth(request);
    if (!request.file)
      throw new AppError(
        422,
        "Choose an Excel or CSV file.",
        "SCHOOL_IMPORT_FILE_REQUIRED",
      );
    const kind =
      request.body.kind === "STUDENTS" || request.body.kind === "TEACHERS"
        ? request.body.kind
        : undefined;
    response
      .status(201)
      .json(
        success(
          await importService.preview(
            context.organizationId,
            context.userId,
            request.file,
            kind,
          ),
          "Import preview created.",
        ),
      );
  },
);
schoolRouter.post(
  "/imports/confirm",
  requirePermission("SCHOOL_MANAGE"),
  validateBody(schoolImportConfirmSchema),
  async (request, response) => {
    const context = auth(request),
      input = request.body as SchoolImportConfirmInput;
    response.json(
      success(
        await importService.confirm(
          context.organizationId,
          context.userId,
          input.batchId,
        ),
        "School data imported.",
      ),
    );
  },
);
