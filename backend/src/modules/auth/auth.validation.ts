import { z } from "zod";

const password = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a number.");

export const registerSchema = z.object({
  invitationToken: z.string().min(32, "A valid registration invitation is required.").max(256),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().max(80).optional().transform((value) => value || undefined),
  password,
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password }).strict();
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
