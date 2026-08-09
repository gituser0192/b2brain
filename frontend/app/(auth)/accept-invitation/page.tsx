import { Suspense } from "react";
import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/features/memberships/accept-invitation-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default function AcceptInvitationPage() {
  return <main className="accept-page"><div className="accept-brand"><span>B²</span><strong>B² Brain</strong></div><Suspense fallback={<div className="screen-loader"><span className="spinner dark" /></div>}><AcceptInvitationForm /></Suspense></main>;
}
