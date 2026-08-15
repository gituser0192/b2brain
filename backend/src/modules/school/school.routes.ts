import { Router, type RequestHandler } from "express";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { SchoolService } from "./school.service.js";
import { academicYearSchema, schoolClassSchema, schoolSectionSchema, type AcademicYearInput, type SchoolClassInput, type SchoolSectionInput } from "./school.validation.js";

const service = new SchoolService();
const auth = (request: Parameters<RequestHandler>[0]) => { if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED"); return request.auth; };
export const schoolRouter = Router();
schoolRouter.use(requireAuth, requireActiveContext, requireEnabledService("SCHOOL"));
schoolRouter.get("/", requirePermission("SCHOOL_VIEW"), async (request, response) => response.json(success(await service.list(auth(request).organizationId))));
schoolRouter.post("/academic-years", requirePermission("SCHOOL_MANAGE"), validateBody(academicYearSchema), async (request, response) => { const context = auth(request); response.status(201).json(success(await service.createAcademicYear(context.organizationId, context.userId, request.body as AcademicYearInput), "Academic year created.")); });
schoolRouter.post("/classes", requirePermission("SCHOOL_MANAGE"), validateBody(schoolClassSchema), async (request, response) => { const context = auth(request); response.status(201).json(success(await service.createClass(context.organizationId, context.userId, request.body as SchoolClassInput), "Class created.")); });
schoolRouter.post("/sections", requirePermission("SCHOOL_MANAGE"), validateBody(schoolSectionSchema), async (request, response) => { const context = auth(request); response.status(201).json(success(await service.createSection(context.organizationId, context.userId, request.body as SchoolSectionInput), "Section created.")); });
