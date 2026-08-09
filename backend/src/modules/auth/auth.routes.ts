import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireActiveContext, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { login, logout, me, refresh, register, registrationInvitation } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Too many authentication attempts. Try again later.", code: "RATE_LIMITED" } });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Too many registration attempts. Try again later.", code: "RATE_LIMITED" } });

export const authRouter = Router();
authRouter.post("/register", registerLimiter, validateBody(registerSchema), register);
authRouter.get("/registration-invitations/:token", registerLimiter, registrationInvitation);
authRouter.post("/login", limiter, validateBody(loginSchema), login);
authRouter.post("/refresh", limiter, refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, requireActiveContext, me);
