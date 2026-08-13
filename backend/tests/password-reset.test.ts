import { describe,expect,it } from "vitest";
import { forgotPasswordSchema,resetPasswordSchema } from "../src/modules/auth/auth.validation.js";
import { hashPasswordResetToken,newPasswordResetToken } from "../src/modules/auth/password-reset.tokens.js";
describe("password recovery security",()=>{
  it("normalizes recovery email",()=>expect(forgotPasswordSchema.parse({email:" USER@EXAMPLE.COM "}).email).toBe("user@example.com"));
  it("requires a strong replacement password",()=>expect(()=>resetPasswordSchema.parse({token:"x".repeat(40),password:"password"})).toThrow());
  it("stores only a reset token hash",()=>{const token=newPasswordResetToken();expect(hashPasswordResetToken(token)).toHaveLength(64);expect(hashPasswordResetToken(token)).not.toContain(token)});
});
