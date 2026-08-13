import { Suspense } from "react";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
export default function ResetPasswordPage(){return <AuthShell eyebrow="Secure recovery" title="Create a new password" description="This one-time link expires after 30 minutes." alternate={{text:"Return to",label:"Sign in",href:"/login"}}><Suspense><ResetPasswordForm/></Suspense></AuthShell>}
