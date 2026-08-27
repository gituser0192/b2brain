import { Router } from "express";
import { z } from "zod";
import { requireActiveContext, requireAuth, requireEnabledService, requirePermission } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { SalesIntelligenceService } from "./sales-intelligence.service.js";

const service = new SalesIntelligenceService();
const querySchema = z.object({ days: z.coerce.number().int().refine((value) => [30, 90, 365].includes(value)).default(90) });

export const salesIntelligenceRouter = Router();
salesIntelligenceRouter.use(requireAuth, requireActiveContext, requireEnabledService("SALES"), requirePermission("DEAL_VIEW"));
salesIntelligenceRouter.get("/", async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  const { days } = querySchema.parse(request.query);
  response.json(success(await service.analyze(request.auth.organizationId, request.auth.permissions, days)));
});
