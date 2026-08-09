import type { ErrorFields } from "../errors/app-error.js";

export interface ApiSuccess<T> { success: true; message?: string; data: T; }
export interface ApiFailure { success: false; message: string; code: string; errors?: ErrorFields; }

export const success = <T>(data: T, message?: string): ApiSuccess<T> => ({
  success: true,
  ...(message ? { message } : {}),
  data,
});
