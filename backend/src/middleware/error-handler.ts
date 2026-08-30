import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../shared/errors/app-error.js";
import type { ApiFailure } from "../shared/responses/api-response.js";

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "request");
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  void next;
  let appError: AppError;
  if (error instanceof AppError) appError = error;
  else if (error instanceof ZodError) appError = new AppError(400, "Validation failed.", "VALIDATION_ERROR", zodFields(error));
  else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") appError = new AppError(409, "A record with these details already exists.", "CONFLICT");
  else if (error && typeof error === "object" && "type" in error && error.type === "entity.parse.failed") appError = new AppError(400, "The request body is not valid JSON.", "INVALID_JSON");
  else if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") appError = new AppError(413, "The request body is too large.", "PAYLOAD_TOO_LARGE");
  else appError = new AppError(500, "Something went wrong.", "INTERNAL_SERVER_ERROR");

  if (appError.statusCode >= 500) logger.error({ err: error, method: request.method, path: request.path }, "Unhandled request error");
  const body: ApiFailure = {
    success: false,
    message: appError.message,
    code: appError.code,
    ...(appError.errors ? { errors: appError.errors } : {}),
  };
  response.status(appError.statusCode).json(body);
};
