import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({ eyebrow, title, description, children, alternate }: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  alternate: { text: string; label: string; href: string };
}>) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="B² Brain introduction">
        <Link href="/" className="auth-wordmark">
          <span className="wordmark-icon"><Image src="/brand/b2brain-logo.png" alt="" width={44} height={44} priority /></span>
          <span><strong>B² Brain</strong><small>Business operating system</small></span>
        </Link>
        <div className="story-copy">
          <p className="story-kicker"><span /> Your business, thinking together</p>
          <h1>Turn scattered work<br />into shared <em>intelligence.</em></h1>
          <p>One connected workspace where your people, priorities, and progress move with clarity.</p>
        </div>
        <div className="neural-stage" aria-hidden="true">
          <div className="neural-ring ring-one" />
          <div className="neural-ring ring-two" />
          <div className="neural-line line-one" />
          <div className="neural-line line-two" />
          <span className="neural-node node-one" /><span className="neural-node node-two" /><span className="neural-node node-three" /><span className="neural-node node-four" />
          <div className="logo-constellation">
            <Image src="/brand/b2brain-logo.png" alt="B² Brain — Connecting businesses. Driving growth." fill sizes="260px" priority />
          </div>
        </div>
        <div className="story-proof">
          <span className="proof-icon" aria-hidden="true">01</span>
          <div><strong>A workspace that begins with you</strong><small>No sample records. No borrowed context. Only your business.</small></div>
        </div>
        <div className="story-grid" />
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><span className="mobile-logo"><Image src="/brand/b2brain-logo.png" alt="" width={42} height={42} /></span><span>B² Brain</span></div>
          <p className="form-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="form-intro">{description}</p>
          {children}
          <p className="auth-alternate">{alternate.text} <Link href={alternate.href}>{alternate.label}</Link></p>
        </div>
        <p className="auth-legal">Secure access for your organization workspace.</p>
      </section>
    </main>
  );
}

export function FieldIcon({ name }: Readonly<{ name: "mail" | "lock" | "user" | "building" }>) {
  const paths = {
    mail: <><path d="M3 5h18v14H3z" /><path d="m3 6 9 7 9-7" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-4h6v4M8 8h1m6 0h1M8 12h1m6 0h1" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
