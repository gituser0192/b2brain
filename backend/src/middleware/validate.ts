import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validateBody = (schema: ZodType): RequestHandler => (request, _response, next) => {
  // Express types request bodies as any; parsing establishes the runtime type for downstream handlers.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  request.body = schema.parse(request.body as unknown);
  next();
};
