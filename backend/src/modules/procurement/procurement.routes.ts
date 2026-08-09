import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { ProcurementService } from "./procurement.service.js";
import { approvalSchema, purchaseOrderSchema, receiptSchema, vendorSchema, type ApprovalInput, type PurchaseOrderInput, type ReceiptInput, type VendorInput } from "./procurement.validation.js";

const service = new ProcurementService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED"); return request.auth; }
export const procurementRouter = Router();
procurementRouter.use(requireAuth, requireActiveContext, requireEnabledService("PROCUREMENT"));
procurementRouter.get("/", requirePermission("PROCUREMENT_VIEW"), async (request, response) => response.json(success(await service.list(auth(request).organizationId, request.query.archived === "true"))));
procurementRouter.post("/vendors", requirePermission("PROCUREMENT_MANAGE"), validateBody(vendorSchema), async (request, response) => { const context=auth(request); response.status(201).json(success(await service.createVendor(context.organizationId, context.userId, request.body as VendorInput), "Vendor created.")); });
procurementRouter.put("/vendors/:id", requirePermission("PROCUREMENT_MANAGE"), validateBody(vendorSchema), async (request, response) => { const context=auth(request); await service.updateVendor(context.organizationId, context.userId, String(request.params.id), request.body as VendorInput); response.json(success({}, "Vendor updated.")); });
procurementRouter.post("/orders", requirePermission("PROCUREMENT_MANAGE"), validateBody(purchaseOrderSchema), async (request, response) => { const context=auth(request); response.status(201).json(success(await service.createOrder(context.organizationId, context.userId, request.body as PurchaseOrderInput), "Purchase order created.")); });
procurementRouter.put("/orders/:id", requirePermission("PROCUREMENT_MANAGE"), validateBody(purchaseOrderSchema), async (request, response) => { const context=auth(request); response.json(success(await service.updateOrder(context.organizationId, context.userId, String(request.params.id), request.body as PurchaseOrderInput), "Purchase order updated.")); });
procurementRouter.post("/orders/:id/submit", requirePermission("PROCUREMENT_MANAGE"), async (request, response) => { const context=auth(request); await service.submit(context.organizationId, context.userId, String(request.params.id)); response.json(success({}, "Purchase order submitted.")); });
procurementRouter.post("/orders/:id/approval", requirePermission("PROCUREMENT_APPROVE"), validateBody(approvalSchema), async (request, response) => { const context=auth(request); await service.approve(context.organizationId, context.userId, String(request.params.id), (request.body as ApprovalInput).approved); response.json(success({}, "Approval decision recorded.")); });
procurementRouter.post("/orders/:id/order", requirePermission("PROCUREMENT_MANAGE"), async (request, response) => { const context=auth(request); await service.markOrdered(context.organizationId, context.userId, String(request.params.id)); response.json(success({}, "Purchase order marked as ordered.")); });
procurementRouter.post("/orders/:id/receipts", requirePermission("PROCUREMENT_RECEIVE"), validateBody(receiptSchema), async (request, response) => { const context=auth(request); response.status(201).json(success(await service.receive(context.organizationId, context.userId, String(request.params.id), request.body as ReceiptInput), "Goods receipt recorded.")); });
