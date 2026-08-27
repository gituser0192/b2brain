import { Router, type RequestHandler } from "express";
import { requireActiveContext, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { SettingsService } from "./settings.service.js";
import { businessProfileSchema, changePasswordSchema, personalProfileSchema, type BusinessProfileInput, type ChangePasswordInput, type PersonalProfileInput } from "./settings.validation.js";

const service = new SettingsService(), context = (request: Parameters<RequestHandler>[0]) => { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; };
export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireActiveContext);
settingsRouter.get("/", async (request, response) => response.json(success(await service.overview(context(request)))));
settingsRouter.patch("/profile", validateBody(personalProfileSchema), async (request, response) => response.json(success(await service.updateProfile(context(request), request.body as PersonalProfileInput), "Profile updated.")));
settingsRouter.patch("/business", validateBody(businessProfileSchema), async (request, response) => response.json(success(await service.updateBusiness(context(request), request.body as BusinessProfileInput), "Business settings updated.")));
settingsRouter.post("/security/change-password", validateBody(changePasswordSchema), async (request, response) => response.json(success(await service.changePassword(context(request), request.body as ChangePasswordInput), "Password changed. Sign in again.")));
settingsRouter.post("/security/sign-out-all", async (request, response) => response.json(success(await service.signOutAll(context(request)), "All sessions signed out.")));
