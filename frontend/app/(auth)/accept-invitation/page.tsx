import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { AcceptInvitationForm } from "@/features/memberships/accept-invitation-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default function AcceptInvitationPage() {
  return <main className="accept-page"><div className="accept-brand"><Image src="/brand/sathos-logo.png" alt="" width={32} height={32} priority /><strong>SATHOS</strong></div><Suspense fallback={<div className="screen-loader"><span className="spinner dark" /></div>}><AcceptInvitationForm /></Suspense></main>;
}
