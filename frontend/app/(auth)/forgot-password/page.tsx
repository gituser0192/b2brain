import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
export default function ForgotPasswordPage(){return <AuthShell eyebrow="Account recovery" title="Reset your password" description="Enter your account email to receive secure reset instructions." alternate={{text:"Remembered it?",label:"Sign in",href:"/login"}}><ForgotPasswordForm/></AuthShell>}
