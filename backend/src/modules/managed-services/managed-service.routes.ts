import { Router } from "express";
import { requireActiveContext, requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { ManagedServiceDeskService } from "./managed-service.service.js";
import { managedServiceUpdateSchema, type ManagedServiceUpdateInput } from "./managed-service.validation.js";

const service = new ManagedServiceDeskService();
export const managedServiceDeskRouter = Router();
managedServiceDeskRouter.use(requireAuth, requireActiveContext, requirePlatformAdmin);
managedServiceDeskRouter.get("/", async (_request, response) => response.json(success(await service.list())));
managedServiceDeskRouter.patch("/:id", validateBody(managedServiceUpdateSchema), async (request, response) => {
  response.json(
    success(
      await service.update(String(request.params.id), request.auth!.userId, request.body as ManagedServiceUpdateInput),
      "Operations request updated.",
    ),
  );
});
