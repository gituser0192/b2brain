import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
  verifyServiceAccess,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { InquiryService } from "./inquiry.service.js";
import {
  conversionSchema,
  contactSchema,
  followUpSchema,
  inquirySchema,
  mergeMessageSchema,
  noteSchema,
  type ConversionInput,
  type ContactInput,
  type FollowUpInput,
  type InquiryInput,
  type MergeMessageInput,
  type NoteInput,
} from "./inquiry.validation.js";
import { LeadAssignmentService } from "./lead-assignment.service.js";
import { leadAssignmentRuleSchema, manualLeadAssignmentSchema, type LeadAssignmentRuleInput, type ManualLeadAssignmentInput } from "./lead-assignment.validation.js";
const service = new InquiryService(),
  assignmentService = new LeadAssignmentService(),
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
inquiryRouter.get("/", requirePermission("INQUIRY_VIEW"), async (r, s) => {
  const c = context(r);
  s.json(success(await service.list(c.organizationId, c.userId)));
});
inquiryRouter.get("/assignment-rules", requirePermission("INQUIRY_VIEW"), async (r, s) => { const c = context(r); s.json(success(await assignmentService.list(c.organizationId, c.userId))); });
inquiryRouter.post("/assignment-rules", requirePermission("INQUIRY_MANAGE"), validateBody(leadAssignmentRuleSchema), async (r, s) => { const c = context(r); s.status(201).json(success(await assignmentService.saveRule(c.organizationId, c.userId, null, r.body as LeadAssignmentRuleInput), "Assignment rule created.")); });
inquiryRouter.put("/assignment-rules/:ruleId", requirePermission("INQUIRY_MANAGE"), validateBody(leadAssignmentRuleSchema), async (r, s) => { const c = context(r); s.json(success(await assignmentService.saveRule(c.organizationId, c.userId, String(r.params.ruleId), r.body as LeadAssignmentRuleInput), "Assignment rule updated.")); });
inquiryRouter.delete("/assignment-rules/:ruleId", requirePermission("INQUIRY_MANAGE"), async (r, s) => { const c = context(r); await assignmentService.archiveRule(c.organizationId, c.userId, String(r.params.ruleId)); s.json(success({}, "Assignment rule archived.")); });
inquiryRouter.patch("/:id/assignment", requirePermission("INQUIRY_MANAGE"), validateBody(manualLeadAssignmentSchema), async (r, s) => { const c = context(r); await assignmentService.manualAssign(c.organizationId, c.userId, String(r.params.id), r.body as ManualLeadAssignmentInput); s.json(success({}, "Inquiry assignment updated.")); });
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
          r.query.allowDuplicate === "true",
        ),
        "Inquiry captured.",
      ),
    );
  },
);
inquiryRouter.post(
  "/:id/messages",
  requirePermission("INQUIRY_MANAGE"),
  validateBody(mergeMessageSchema),
  async (r, s) => {
    const c = context(r);
    s.status(201).json(
      success(
        await service.mergeMessage(c.organizationId, c.userId, String(r.params.id), r.body as MergeMessageInput),
        "Message attached to the existing inquiry.",
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
    const conversion = r.body as ConversionInput;
    if (conversion.target === "CUSTOMER") await verifyServiceAccess(c, "CRM", "CRM_CREATE");
    if (conversion.target === "DEAL") {
      await verifyServiceAccess(c, "CRM", "CRM_CREATE");
      await verifyServiceAccess(c, "SALES", "DEAL_MANAGE");
    }
    if (conversion.target === "SUPPORT") await verifyServiceAccess(c, "SUPPORT", "SUPPORT_MANAGE");
    s.json(
      success(
        await service.convert(
          c.organizationId,
          c.userId,
          String(r.params.id),
          conversion,
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
