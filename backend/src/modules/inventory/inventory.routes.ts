import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { InventoryService } from "./inventory.service.js";
import { stockAdjustmentSchema, warehouseSchema, type StockAdjustmentInput, type WarehouseInput } from "./inventory.validation.js";

const service = new InventoryService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication required.", "UNAUTHENTICATED"); return request.auth; }
export const inventoryRouter = Router();
inventoryRouter.use(requireAuth, requireActiveContext, requireEnabledService("INVENTORY"));
inventoryRouter.get("/", requirePermission("INVENTORY_VIEW"), async (request, response) => response.json(success(await service.list(auth(request).organizationId))));
inventoryRouter.post("/warehouses", requirePermission("INVENTORY_MANAGE"), validateBody(warehouseSchema), async (request, response) => { const context=auth(request); response.status(201).json(success(await service.createWarehouse(context.organizationId, context.userId, request.body as WarehouseInput), "Warehouse created.")); });
inventoryRouter.post("/movements", requirePermission("INVENTORY_MANAGE"), validateBody(stockAdjustmentSchema), async (request, response) => { const context=auth(request); response.status(201).json(success(await service.adjust(context.organizationId, context.userId, request.body as StockAdjustmentInput), "Stock movement recorded.")); });
