import { Router, type RequestHandler } from "express";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { PaymentCollectionService } from "./payment-collection.service.js";
import {
  incomingPaymentSchema,
  paymentAccountSchema,
  reconcileSchema,
  refundCompletionSchema,
  refundSchema,
  type IncomingPaymentInput,
  type PaymentAccountInput,
  type ReconcileInput,
  type RefundCompletionInput,
  type RefundInput,
} from "./payment-collection.validation.js";

const service = new PaymentCollectionService();
function auth(request: Parameters<RequestHandler>[0]) {
  if (!request.auth)
    throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
  return request.auth;
}
export const paymentCollectionRouter = Router();
paymentCollectionRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("FINANCE"),
);
paymentCollectionRouter.get(
  "/",
  requirePermission("FINANCE_VIEW"),
  async (request, response) =>
    response.json(
      success(await service.overview(auth(request).organizationId)),
    ),
);
paymentCollectionRouter.post(
  "/accounts",
  requirePermission("FINANCE_MANAGE"),
  validateBody(paymentAccountSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.createAccount(
            context.organizationId,
            context.userId,
            request.body as PaymentAccountInput,
          ),
          "Payment account created.",
        ),
      );
  },
);
paymentCollectionRouter.put(
  "/accounts/:id",
  requirePermission("FINANCE_MANAGE"),
  validateBody(paymentAccountSchema),
  async (request, response) => {
    const context = auth(request);
    await service.updateAccount(
      context.organizationId,
      context.userId,
      String(request.params.id),
      request.body as PaymentAccountInput,
    );
    response.json(success(null, "Payment account updated."));
  },
);
paymentCollectionRouter.post(
  "/incoming",
  requirePermission("FINANCE_MANAGE"),
  validateBody(incomingPaymentSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.captureIncoming(
            context.organizationId,
            context.userId,
            request.body as IncomingPaymentInput,
          ),
          "Incoming transaction captured.",
        ),
      );
  },
);
paymentCollectionRouter.post(
  "/incoming/:id/reconcile",
  requirePermission("FINANCE_MANAGE"),
  validateBody(reconcileSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.reconcile(
            context.organizationId,
            context.userId,
            String(request.params.id),
            request.body as ReconcileInput,
          ),
          "Payment reconciled and receipt created.",
        ),
      );
  },
);
paymentCollectionRouter.post(
  "/payments/:id/refunds",
  requirePermission("FINANCE_MANAGE"),
  validateBody(refundSchema),
  async (request, response) => {
    const context = auth(request);
    response
      .status(201)
      .json(
        success(
          await service.requestRefund(
            context.organizationId,
            context.userId,
            String(request.params.id),
            request.body as RefundInput,
          ),
          "Refund sent for approval.",
        ),
      );
  },
);
paymentCollectionRouter.post(
  "/refunds/:id/complete",
  requirePermission("FINANCE_MANAGE"),
  validateBody(refundCompletionSchema),
  async (request, response) => {
    const context = auth(request);
    response.json(
      success(
        await service.completeRefund(
          context.organizationId,
          context.userId,
          String(request.params.id),
          request.body as RefundCompletionInput,
        ),
        "Refund completed.",
      ),
    );
  },
);
