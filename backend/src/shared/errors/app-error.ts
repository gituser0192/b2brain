export type ErrorFields = Record<string, string>;

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code = "APPLICATION_ERROR",
    public readonly errors?: ErrorFields,
  ) {
    super(message);
    this.name = "AppError";
  }
}
