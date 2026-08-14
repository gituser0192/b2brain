import { Router } from "express";
import { requireActiveContext, requireAuth, requireProviderPermission, requireProviderSensitiveCompletion } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { ManagedServiceDeskService } from "./managed-service.service.js";
import { managedServiceUpdateSchema, providerReplySchema, type ManagedServiceUpdateInput, type ProviderReplyInput } from "./managed-service.validation.js";

const service = new ManagedServiceDeskService();
export const managedServiceDeskRouter = Router();
managedServiceDeskRouter.use(requireAuth, requireActiveContext, requireProviderPermission("PROVIDER_REQUEST_VIEW"));
managedServiceDeskRouter.get("/", async (_request, response) => response.json(success(await service.list())));
managedServiceDeskRouter.patch("/:id", requireProviderPermission("PROVIDER_REQUEST_MANAGE"), validateBody(managedServiceUpdateSchema), requireProviderSensitiveCompletion, async (request, response) => {
  response.json(
    success(
      await service.update(String(request.params.id), request.auth!.userId, request.body as ManagedServiceUpdateInput),
      "Operations request updated.",
    ),
  );
});
managedServiceDeskRouter.patch("/service-requests/:id", requireProviderPermission("PROVIDER_REQUEST_MANAGE"), validateBody(managedServiceUpdateSchema), requireProviderSensitiveCompletion, async (request, response) => response.json(success(await service.updateServiceRequest(String(request.params.id), request.auth!.userId, request.body as ManagedServiceUpdateInput), "Service request updated.")));
managedServiceDeskRouter.post("/service-requests/:id/messages", requireProviderPermission("PROVIDER_REQUEST_WORK"), validateBody(providerReplySchema), async (request, response) => response.status(201).json(success(await service.replyToServiceRequest(String(request.params.id), request.auth!.userId, request.body as ProviderReplyInput), "Message saved.")));
