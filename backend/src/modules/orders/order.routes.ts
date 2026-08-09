import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { OrderService } from "./order.service.js";
import { orderSchema, orderStatusSchema, type OrderInput, type OrderStatusInput } from "./order.validation.js";

const service = new OrderService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED"); return request.auth; }
export const orderRouter = Router();
orderRouter.use(requireAuth, requireActiveContext, requireEnabledService("ORDERS"));
orderRouter.get("/", requirePermission("ORDER_VIEW"), async (request, response) => response.json(success(await service.list(auth(request).organizationId, request.query.archived === "true"))));
orderRouter.post("/", requirePermission("ORDER_MANAGE"), validateBody(orderSchema), async (request, response) => { const context = auth(request); response.status(201).json(success(await service.create(context.organizationId, context.userId, request.body as OrderInput), "Order created.")); });
orderRouter.put("/:id", requirePermission("ORDER_MANAGE"), validateBody(orderSchema), async (request, response) => { const context = auth(request); response.json(success(await service.update(context.organizationId, context.userId, String(request.params.id), request.body as OrderInput), "Order updated.")); });
orderRouter.patch("/:id/status", requirePermission("ORDER_MANAGE"), validateBody(orderStatusSchema), async (request, response) => { const context = auth(request); response.json(success(await service.setStatus(context.organizationId, context.userId, String(request.params.id), (request.body as OrderStatusInput).status), "Order status updated.")); });
orderRouter.delete("/:id", requirePermission("ORDER_MANAGE"), async (request, response) => { const context = auth(request); await service.archive(context.organizationId, context.userId, String(request.params.id)); response.json(success({}, "Order archived.")); });
orderRouter.post("/:id/restore", requirePermission("ORDER_MANAGE"), async (request, response) => { const context = auth(request); await service.restore(context.organizationId, context.userId, String(request.params.id)); response.json(success({}, "Order restored.")); });
