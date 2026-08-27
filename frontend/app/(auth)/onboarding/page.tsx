import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { BusinessOnboardingForm } from "@/features/auth/business-onboarding-form";

export const metadata: Metadata = { title: "Complete business profile" };

export default function OnboardingPage() {
  return <AuthShell eyebrow="One last step" title="Tell us about your business" description="We use this profile to configure your workspace. No sample business data will be added." alternate={{ text: "Need to use another account?", label: "Sign in", href: "/login" }}><BusinessOnboardingForm /></AuthShell>;
}
