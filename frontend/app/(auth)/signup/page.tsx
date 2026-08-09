import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "Create workspace" };

export default function SignupPage() {
  return <AuthShell eyebrow="Start with a clean slate" title="Create your workspace" description="Set up your organization. Your workspace begins completely empty." alternate={{ text: "Already have an account?", label: "Sign in", href: "/login" }}><SignupForm /></AuthShell>;
}
