"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationCenter } from "@/features/notifications/notification-center";
import type { AuthSession } from "./auth.types";
import type { ActiveView } from "./dashboard-workspaces";
import { routeForView } from "./workspace-routes";

interface DashboardHeaderProps {
  activeView: ActiveView;
  enabledServices: string[];
  isMobileNavigationOpen: boolean;
  session: AuthSession;
  onOpenMobileNavigation: () => void;
  onOpenOperations: () => void;
  onOpenSuperAdmin: () => void;
}

const titles: Partial<Record<ActiveView, string>> = {
  overview: "Dashboard", inquiries: "Leads and inquiries", crm: "Customers", sales: "Sales",
  projects: "Projects", calendar: "Calendar", finance: "Finance", b2agent: "Business Operating Agent",
  analysis: "Business Analysis", actions: "Action Centre", automation: "Automation",
  people: "Team and Access", settings: "Settings", b2help: "Help and Support",
};

function quickActions(enabled: string[], permissions: string[]) {
  const has = (service: string, permission?: string) => enabled.includes(service) && (!permission || permissions.includes(permission));
  return [
    has("CRM", "CRM_CREATE") && { label: "Add customer", href: routeForView("crm") },
    has("LEADS", "INQUIRY_CREATE") && { label: "Add lead or inquiry", href: routeForView("inquiries") },
    has("FINANCE", "FINANCE_MANAGE") && { label: "Record revenue", href: routeForView("finance") },
    has("FINANCE", "FINANCE_MANAGE") && { label: "Add expense", href: routeForView("finance") },
    has("PROJECTS", "PROJECT_CREATE") && { label: "Create project", href: routeForView("projects") },
    has("PROJECTS", "PROJECT_TASK_MANAGE") && { label: "Create task", href: routeForView("projects") },
    has("B2BRAIN_AGENT") && { label: "Ask Business Agent", href: routeForView("b2agent") },
  ].filter((action): action is { label: string; href: string } => Boolean(action));
}

export function DashboardHeader({ activeView, enabledServices, isMobileNavigationOpen, session, onOpenMobileNavigation, onOpenOperations, onOpenSuperAdmin }: DashboardHeaderProps) {
  const pathname = usePathname();
  const [quickOpen, setQuickOpen] = useState(false);
  const quickArea = useRef<HTMLDivElement>(null);
  const quickTrigger = useRef<HTMLButtonElement>(null);
  const detail = pathname.startsWith("/crm/customers/") ? { parent: "Customers", href: "/crm", title: "Customer details" } : pathname.startsWith("/projects/") ? { parent: "Projects", href: "/projects", title: "Project details" } : null;
  const title = detail?.title ?? titles[activeView] ?? "Workspace";
  const actions = quickActions(enabledServices, session.membership.permissions);
  const canOpenOperations = session.user.isPlatformAdmin || (session.organization.isServiceProvider && session.membership.permissions.includes("PROVIDER_REQUEST_VIEW"));

  useEffect(() => {
    if (!quickOpen) return;
    const close = (event: MouseEvent) => { if (!quickArea.current?.contains(event.target as Node)) setQuickOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setQuickOpen(false); quickTrigger.current?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [quickOpen]);

  return <header className="dashboard-header">
    <div className="dashboard-heading">
      <button type="button" className="mobile-menu-button" onClick={onOpenMobileNavigation} aria-label="Open service menu" aria-expanded={isMobileNavigationOpen} aria-controls="dashboard-navigation"><span /><span /><span /></button>
      <div className="workspace-page-heading">
        {detail && <nav aria-label="Breadcrumb"><Link href={detail.href}>{detail.parent}</Link><span aria-hidden="true">/</span><span>Details</span></nav>}
        <h1>{title}</h1>
      </div>
    </div>
    <div className="header-actions">
      {canOpenOperations && <button className="desktop-header-action" onClick={onOpenOperations}>Operations</button>}
      {session.user.isPlatformAdmin && <button className="desktop-header-action" onClick={onOpenSuperAdmin}>Super Admin</button>}
      <div className="workspace-quick-add" ref={quickArea}>
        <button ref={quickTrigger} type="button" className="workspace-quick-add-trigger" aria-haspopup="menu" aria-expanded={quickOpen} onClick={() => setQuickOpen((value) => !value)}>＋ Quick Add</button>
        {quickOpen && <div className="workspace-quick-add-menu" role="menu" aria-label="Quick Add actions">{actions.length ? actions.map((action) => <Link key={action.label} href={action.href} role="menuitem" onClick={() => setQuickOpen(false)}>{action.label}</Link>) : <p>No actions available</p>}</div>}
      </div>
      <NotificationCenter />
      <span className="status-pill" title={`${session.organization.name} — active workspace`}><i /> Active</span>
    </div>
  </header>;
}
