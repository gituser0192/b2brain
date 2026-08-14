import { Router } from "express";
import { requireActiveContext, requireAuth, requireOrganizationOwner } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { ServiceRequestService } from "./service-request.service.js";
import {
  createServiceRequestSchema,
  customerApprovalSchema,
  customerServiceMessageSchema,
  type CreateServiceRequestInput,
  type CustomerApprovalInput,
  type CustomerServiceMessageInput,
} from "./service-request.validation.js";

const service = new ServiceRequestService();
export const serviceRequestRouter = Router();
serviceRequestRouter.use(requireAuth, requireActiveContext);
serviceRequestRouter.get("/", async (request, response) =>
  response.json(success(await service.list(request.auth!.organizationId))),
);
serviceRequestRouter.post(
  "/",
  validateBody(createServiceRequestSchema),
  async (request, response) =>
    response
      .status(201)
      .json(
        success(
          await service.create(
            request.auth!.organizationId,
            request.auth!.userId,
            request.body as CreateServiceRequestInput,
          ),
          "Request submitted to B² Brain.",
        ),
      ),
);
serviceRequestRouter.post(
  "/:id/messages",
  validateBody(customerServiceMessageSchema),
  async (request, response) =>
    response
      .status(201)
      .json(
        success(
          await service.message(
            request.auth!.organizationId,
            request.auth!.userId,
            String(request.params.id),
            request.body as CustomerServiceMessageInput,
          ),
          "Message sent to B² Brain.",
        ),
      ),
);
serviceRequestRouter.post(
  "/:id/approval",
  requireOrganizationOwner,
  validateBody(customerApprovalSchema),
  async (request, response) =>
    response.json(
      success(
        await service.approval(
          request.auth!.organizationId,
          request.auth!.userId,
          String(request.params.id),
          request.body as CustomerApprovalInput,
        ),
        "Approval decision sent to B² Brain.",
      ),
    ),
);
