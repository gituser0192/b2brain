import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data deletion | SATHOS",
  description: "How to disconnect Instagram and request deletion of information held by SATHOS.",
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return <>
    <section className="site-page-hero">
      <span className="site-kicker">Legal and privacy</span>
      <h1>Request deletion of your SATHOS data</h1>
      <p>SATHOS private-beta guidance, effective 7 October 2026. SATHOS is an early-access software service currently operated by Harsh Soni in India and has not yet been incorporated as a separate legal entity. This page explains how to disconnect an Instagram account and ask us to review a deletion request.</p>
    </section>
    <section className="site-page-grid" aria-label="Data deletion instructions">
      <article>
        <h2>Disconnect Instagram</h2>
        <p>If you manage the connected organization, sign in to SATHOS, open Automation → Connections → Instagram Messages, and choose “Disconnect locally.” This disables SATHOS routing and clears its locally stored connection credentials. It does not revoke access at Meta or unsubscribe Meta webhooks. You can separately remove the app from Instagram’s Apps and Websites settings.</p>
      </article>
      <article>
        <h2>Ask us to delete data</h2>
        <p>Email <a href="mailto:sathsupport@sathos.in?subject=SATHOS%20data%20deletion%20request">sathsupport@sathos.in</a> with your organization name, a way to identify the Instagram account you control, and the information you want reviewed for deletion. Do not email passwords, OTPs, access tokens, App Secrets, encryption keys, message contents or other sensitive records. We may need to verify your identity and ownership before acting on an organization’s data.</p>
      </article>
      <article>
        <h2>What the request covers</h2>
        <p>Depending on the verified request, SATHOS may remove the Instagram connection, associated integration events, and Instagram-derived messages or inquiries held in the workspace. Disconnecting alone does not erase historical business records. We will explain the scope and outcome of a deletion request after review.</p>
      </article>
      <article>
        <h2>Information that may remain</h2>
        <p>Some unrelated financial, audit, fraud-prevention or legally required records may need to be retained where applicable. A request about Instagram data does not automatically delete unrelated organization or customer records. Retention decisions depend on the applicable agreement and law; SATHOS does not promise automatic deletion or a fixed completion date on this page.</p>
      </article>
    </section>
    <section className="site-page-close">
      <h2>Questions about your data?</h2>
      <p>Read our <Link href="/privacy">privacy notice</Link> or contact <a href="mailto:sathsupport@sathos.in?subject=SATHOS%20privacy%20request">sathsupport@sathos.in</a>.</p>
    </section>
  </>;
}
