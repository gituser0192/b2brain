"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LanguageSwitch, translate, useLanguage } from "./language";

const links = [["Services", "/services"], ["Why SATHOS", "/why-sathos"], ["How it works", "/how-it-works"], ["Security", "/security"], ["Pricing", "/pricing"]] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const language = useLanguage();
  const pathname = usePathname();
  const legalPage = ["/privacy", "/terms", "/data-deletion"].includes(pathname);
  const t = (copy: string) => translate(language, copy);
  return <div className="marketing-site">
    <header className="site-header"><Link className="site-brand" href="/"><Image src="/brand/sathos-logo.png" alt="" width={42} height={42} priority /><span><strong>SATHOS</strong><small>{t("Business operating system")}</small></span></Link><nav aria-label="Public navigation">{links.map(([label, href]) => <Link key={href} href={href}>{t(label)}</Link>)}</nav><div className="site-header-actions"><LanguageSwitch /><Link href="/login">{t("Sign in")}</Link><Link className="site-button small" href="/contact">{t("Request access")}</Link><details className="site-mobile-nav"><summary>{t("Menu")}</summary><nav aria-label="Mobile public navigation">{links.map(([label, href]) => <Link key={href} href={href}>{t(label)}</Link>)}<Link href="/contact">{t("Contact")}</Link><Link href="/login">{t("Sign in")}</Link></nav></details></div></header>
    <main lang={pathname === "/" ? language : "en"}>{language === "hi" && pathname !== "/" && !legalPage && <p className="language-preview-note" lang="hi">इस पेज का विस्तृत विवरण अभी अंग्रेज़ी में है। हिन्दी अनुवाद तैयार किया जा रहा है।</p>}{children}</main>
    <footer className="site-footer"><div><Link className="site-brand" href="/"><Image src="/brand/sathos-logo.png" alt="" width={38} height={38} /><span><strong>SATHOS</strong><small>{t("People · Process · AI · Growth")}</small></span></Link><p>{t("One organization-isolated workspace for operating a growing business with clarity.")}</p></div><nav aria-label="Footer navigation">{links.map(([label, href]) => <Link key={href} href={href}>{t(label)}</Link>)}<Link href="/contact">{t("Contact")}</Link><Link href="/privacy">{t("Privacy")}</Link><Link href="/terms">{t("Terms & Conditions")}</Link><Link href="/data-deletion">{t("Data deletion")}</Link></nav><div><strong>{t("Talk to us")}</strong><a href="mailto:sathsupport@sathos.in">sathsupport@sathos.in</a><small>© {new Date().getFullYear()} SATHOS</small></div></footer>
  </div>;
}
