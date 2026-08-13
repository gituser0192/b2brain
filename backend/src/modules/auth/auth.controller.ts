import type { RequestHandler, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { AuthService } from "./auth.service.js";
import type { SessionMetadata } from "./auth.types.js";
import type { LoginInput, RegisterInput } from "./auth.types.js";
import type { ForgotPasswordInput, ResetPasswordInput } from "./auth.validation.js";
import { durationMs } from "./auth.tokens.js";

const service = new AuthService();

function metadata(request: Parameters<RequestHandler>[0]): SessionMetadata {
  const userAgent = request.get("user-agent");
  return { ...(userAgent ? { userAgent } : {}), ...(request.ip ? { ipAddress: request.ip } : {}) };
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/api/v1/auth",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  } as const;
}
function setRefresh(response: Response, token: string) {
  response.cookie(env.COOKIE_NAME, token, { ...cookieOptions(), maxAge: durationMs(env.REFRESH_TOKEN_EXPIRES_IN) });
}
function refreshCookie(request: Parameters<RequestHandler>[0]): string | undefined {
  const cookies = request.cookies as unknown;
  if (!cookies || typeof cookies !== "object") return undefined;
  const token = (cookies as Record<string, unknown>)[env.COOKIE_NAME];
  return typeof token === "string" ? token : undefined;
}

export const register: RequestHandler = async (request, response) => {
  const result = await service.register(request.body as RegisterInput);
  response.status(201).json(success(result, "Registration submitted for Super Admin approval."));
};

export const registrationInvitation: RequestHandler = async (request, response) => {
  const token = typeof request.params.token === "string" ? request.params.token : "";
  response.json(success(await service.registrationInvitation(token)));
};

export const login: RequestHandler = async (request, response) => {
  const result = await service.login(request.body as LoginInput, metadata(request));
  setRefresh(response, result.refreshToken);
  const { refreshToken, ...data } = result;
  void refreshToken;
  response.json(success(data, "Login successful."));
};

export const refresh: RequestHandler = async (request, response) => {
  const token = refreshCookie(request);
  if (!token) throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_REFRESH_SESSION");
  const result = await service.refresh(token, metadata(request));
  setRefresh(response, result.refreshToken);
  response.json(success({ accessToken: result.accessToken }, "Session refreshed."));
};

export const logout: RequestHandler = async (request, response) => {
  await service.logout(refreshCookie(request));
  response.clearCookie(env.COOKIE_NAME, cookieOptions());
  response.json(success({}, "Logout successful."));
};

export const me: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  response.json(success(await service.me(request.auth)));
};
export const forgotPassword: RequestHandler = async (request, response) => response.json(success(await service.forgotPassword(request.body as ForgotPasswordInput), "If an eligible account exists, password reset instructions are ready."));
export const resetPassword: RequestHandler = async (request, response) => {
  await service.resetPassword(request.body as ResetPasswordInput);
  response.clearCookie(env.COOKIE_NAME, cookieOptions());
  response.json(success({}, "Password changed. Sign in with your new password."));
};
