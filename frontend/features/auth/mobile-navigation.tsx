"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { AuthSession } from "./auth.types";
import type { ActiveView } from "./dashboard-workspaces";
import { permittedNavigation } from "./dashboard-sidebar";
import { routeForView } from "./workspace-routes";

export function MobileNavigation({ activeView, enabledServices, session }: { activeView: ActiveView; enabledServices: string[]; session: AuthSession }) {
  const [sheet, setSheet] = useState<"more" | "add" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = permittedNavigation(enabledServices, session).flatMap((group) => group.items);
  const find = (key: ActiveView) => items.find((item) => item.key === key);
  const fourth = find("finance") ?? find("b2agent") ?? find("inquiries") ?? find("projects");
  const primary = new Set(["overview", "crm", fourth?.key].filter(Boolean));
  const more = items.filter((item) => !primary.has(item.key));
  const quick = [
    session.membership.permissions.includes("CRM_CREATE") && find("crm") ? { label: "Add customer", href: routeForView("crm") } : null,
    session.membership.permissions.includes("INQUIRY_CREATE") && find("inquiries") ? { label: "Add lead", href: routeForView("inquiries") } : null,
    session.membership.permissions.includes("FINANCE_MANAGE") && find("finance") ? { label: "Record revenue", href: `${routeForView("finance")}?tab=payments&action=incoming` } : null,
    session.membership.permissions.includes("FINANCE_MANAGE") && find("finance") ? { label: "Add expense", href: `${routeForView("finance")}?tab=expenses&action=expense` } : null,
    find("b2agent") ? { label: "Ask Business Agent", href: routeForView("b2agent") } : null,
  ].filter((item): item is { label: string; href: string } => Boolean(item));
  useEffect(() => { if (!sheet) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSheet(null); trigger.current?.focus(); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [sheet]);
  const open = (value: "more" | "add", event: MouseEvent<HTMLButtonElement>) => { trigger.current = event.currentTarget; setSheet(value); };
  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link className={activeView === "overview" ? "active" : ""} aria-current={activeView === "overview" ? "page" : undefined} href="/dashboard"><span>⌂</span>Home</Link>
      {find("crm") ? <Link className={activeView === "crm" ? "active" : ""} aria-current={activeView === "crm" ? "page" : undefined} href="/crm"><span>C</span>Customers</Link> : <button onClick={(event) => open("more", event)}><span>⋯</span>Work</button>}
      <button className="mobile-quick-add" onClick={(event) => open("add", event)} aria-haspopup="dialog"><span>＋</span>Quick Add</button>
      {fourth ? <Link className={activeView === fourth.key ? "active" : ""} aria-current={activeView === fourth.key ? "page" : undefined} href={routeForView(fourth.key)}><span>{fourth.icon}</span>{fourth.label}</Link> : <Link href="/settings"><span>⚙</span>Settings</Link>}
      <button onClick={(event) => open("more", event)} aria-haspopup="dialog"><span>☰</span>More</button>
    </nav>
    {sheet && <div className="mobile-navigation-backdrop" onClick={() => setSheet(null)}><section className="mobile-navigation-sheet" role="dialog" aria-modal="true" aria-label={sheet === "add" ? "Quick Add" : "More destinations"} onClick={(event) => event.stopPropagation()}><header><strong>{sheet === "add" ? "Quick Add" : "More"}</strong><button autoFocus onClick={() => { setSheet(null); trigger.current?.focus(); }} aria-label="Close navigation sheet">×</button></header><div>{sheet === "add" ? quick.map((item) => <Link key={item.label} href={item.href} onClick={() => setSheet(null)}>{item.label}</Link>) : more.map((item) => <Link key={item.key} href={routeForView(item.key)} onClick={() => setSheet(null)}>{item.label}</Link>)}</div></section></div>}
  </>;
}
