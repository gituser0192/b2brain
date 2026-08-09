import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import {
  requireActiveContext,
  requireAuth,
  requireEnabledService,
  requirePermission,
} from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { success } from "../../shared/responses/api-response.js";
import { StayService } from "./stay.service.js";
import {
  checkoutSchema,
  generateSchema,
  paymentSchema,
  propertySchema,
  residentSchema,
  roomSchema,
  type PaymentInput,
  type PropertyInput,
  type ResidentInput,
  type RoomInput,
  type GenerateInput,
  type CheckoutInput,
} from "./stay.validation.js";
const service = new StayService(),
  auth = (r: Parameters<RequestHandler>[0]) => {
    if (!r.auth)
      throw new AppError(401, "Authentication required.", "UNAUTHENTICATED");
    return r.auth;
  };
export const stayRouter = Router();
stayRouter.use(
  requireAuth,
  requireActiveContext,
  requireEnabledService("STAY"),
);
stayRouter.get("/", requirePermission("STAY_VIEW"), async (r, s) =>
  s.json(success(await service.list(auth(r).organizationId))),
);
stayRouter.post(
  "/properties",
  requirePermission("STAY_MANAGE"),
  validateBody(propertySchema),
  async (r, s) => {
    const c = auth(r);
    s.status(201).json(
      success(
        await service.property(
          c.organizationId,
          c.userId,
          r.body as PropertyInput,
        ),
        "Property created.",
      ),
    );
  },
);
stayRouter.post(
  "/rooms",
  requirePermission("STAY_MANAGE"),
  validateBody(roomSchema),
  async (r, s) => {
    const c = auth(r);
    s.status(201).json(
      success(
        await service.room(c.organizationId, r.body as RoomInput),
        "Room and beds created.",
      ),
    );
  },
);
stayRouter.post(
  "/residents",
  requirePermission("STAY_MANAGE"),
  validateBody(residentSchema),
  async (r, s) => {
    const c = auth(r);
    s.status(201).json(
      success(
        await service.resident(
          c.organizationId,
          c.userId,
          r.body as ResidentInput,
        ),
        "Resident checked in.",
      ),
    );
  },
);
stayRouter.post(
  "/rent/generate",
  requirePermission("STAY_MANAGE"),
  validateBody(generateSchema),
  async (r, s) => {
    const c = auth(r);
    s.json(
      success(
        await service.generate(
          c.organizationId,
          c.userId,
          (r.body as GenerateInput).period,
        ),
        "Monthly rent generation completed.",
      ),
    );
  },
);
stayRouter.post(
  "/rent/:id/payments",
  requirePermission("STAY_MANAGE"),
  validateBody(paymentSchema),
  async (r, s) => {
    const c = auth(r);
    s.status(201).json(
      success(
        await service.payment(
          c.organizationId,
          c.userId,
          String(r.params.id),
          r.body as PaymentInput,
        ),
        "Rent payment recorded.",
      ),
    );
  },
);
stayRouter.post(
  "/occupancies/:id/checkout",
  requirePermission("STAY_MANAGE"),
  validateBody(checkoutSchema),
  async (r, s) => {
    const c = auth(r);
    await service.checkout(
      c.organizationId,
      String(r.params.id),
      (r.body as CheckoutInput).endDate,
    );
    s.json(success({}, "Resident checked out and bed released."));
  },
);
