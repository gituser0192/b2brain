import { publicEnv } from "@/lib/env";

interface ErrorPayload {
  message?: string;
  code?: string;
  errors?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as
    (T & ErrorPayload) | null;
  if (!response.ok)
    throw new ApiError(
      response.status,
      payload?.message ?? "Unable to complete the request.",
      payload?.code,
      payload?.errors,
    );
  if (!payload)
    throw new ApiError(
      response.status,
      "The server returned an invalid response.",
    );
  return payload;
}
