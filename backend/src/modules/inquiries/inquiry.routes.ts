import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { InquiryService } from "./inquiry.service.js";
import {
  conversionSchema,
  contactSchema,
  followUpSchema,
  inquirySchema,
  noteSchema,
  type ConversionInput,
  type ContactInput,
  type FollowUpInput,
  type InquiryInput,
  type NoteInput,
} from "./inquiry.validation.js";
const service = new InquiryService(),
  context = (r: Parameters<RequestHandler>[0]) => {
    if (!r.auth)
      throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
    return r.auth;
  };
export const inquiryRouter = Router();
inquiryRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("LEADS"),
);
inquiryRouter.get("/", requirePermission("INQUIRY_VIEW"), async (r, s) =>
  s.json(success(await service.list(context(r).organizationId))),
);
inquiryRouter.post(
  "/:id/contact",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(contactSchema),
  async (r, s) => {
    const c = context(r);
    s.status(201).json(success(await service.contact(c.organizationId, c.userId, String(r.params.id), r.body as ContactInput), "Contact activity logged."));
  },
);
inquiryRouter.post(
  "/:id/follow-up",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(followUpSchema),
  async (r, s) => {
    const c = context(r);
    s.json(success(await service.scheduleFollowUp(c.organizationId, c.userId, String(r.params.id), r.body as FollowUpInput), "Follow-up scheduled."));
  },
);
inquiryRouter.post("/:id/follow-up/complete", requirePermission("INQUIRY_MANAGE"), async (r, s) => {
  const c = context(r);
  await service.completeFollowUp(c.organizationId, c.userId, String(r.params.id));
  s.json(success({}, "Follow-up completed."));
});
inquiryRouter.post(
  "/",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(inquirySchema),
  async (r, s) => {
    const c = context(r);
    s.status(201).json(
      success(
        await service.create(
          c.organizationId,
          c.userId,
          r.body as InquiryInput,
        ),
        "Inquiry captured.",
      ),
    );
  },
);
inquiryRouter.put(
  "/:id",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(inquirySchema),
  async (r, s) => {
    const c = context(r);
    s.json(
      success(
        await service.update(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as InquiryInput,
        ),
        "Inquiry updated.",
      ),
    );
  },
);
inquiryRouter.post(
  "/:id/notes",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(noteSchema),
  async (r, s) => {
    const c = context(r);
    s.status(201).json(
      success(
        await service.note(
          c.organizationId,
          c.userId,
          String(r.params.id),
          (r.body as NoteInput).note,
        ),
        "Note added.",
      ),
    );
  },
);
inquiryRouter.post(
  "/:id/convert",
  requirePermission("INQUIRY_CONVERT"),
  validateBody(conversionSchema),
  async (r, s) => {
    const c = context(r);
    s.json(
      success(
        await service.convert(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as ConversionInput,
        ),
        "Inquiry converted.",
      ),
    );
  },
);
inquiryRouter.delete(
  "/:id",
  requirePermission("INQUIRY_MANAGE"),
  async (r, s) => {
    const c = context(r);
    await service.archive(c.organizationId, c.userId, String(r.params.id));
    s.json(success({}, "Inquiry archived."));
  },
);
