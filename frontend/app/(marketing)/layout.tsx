import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [["Services", "/services"], ["Why SATHOS", "/why-sathos"], ["How it works", "/how-it-works"], ["Security", "/security"], ["Pricing", "/pricing"]] as const;

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="marketing-site">
    <header className="site-header"><Link className="site-brand" href="/"><Image src="/brand/sathos-logo.png" alt="" width={42} height={42} priority /><span><strong>SATHOS</strong><small>Business operating system</small></span></Link><nav aria-label="Public navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><div className="site-header-actions"><Link href="/login">Sign in</Link><Link className="site-button small" href="/contact">Request access</Link><details className="site-mobile-nav"><summary>Menu</summary><nav aria-label="Mobile public navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/contact">Contact</Link><Link href="/login">Sign in</Link></nav></details></div></header>
    <main>{children}</main>
    <footer className="site-footer"><div><Link className="site-brand" href="/"><Image src="/brand/sathos-logo.png" alt="" width={38} height={38} /><span><strong>SATHOS</strong><small>People · Process · AI · Growth</small></span></Link><p>One organization-isolated workspace for operating a growing business with clarity.</p></div><nav aria-label="Footer navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><div><strong>Talk to us</strong><a href="mailto:sathsupport@sathos.in">sathsupport@sathos.in</a><small>© {new Date().getFullYear()} SATHOS</small></div></footer>
  </div>;
}
