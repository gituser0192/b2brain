import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <AuthShell eyebrow="Welcome back" title="Sign in to your workspace" description="Enter your details to continue where you left off." alternate={{ text: "New to B² Brain?", label: "Create a workspace", href: "/signup" }}><LoginForm /></AuthShell>;
}
