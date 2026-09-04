"use client";
import Image from "next/image";
import Link from "next/link";
import type { AuthSession } from "./auth.types";
import type { ActiveView } from "./dashboard-workspaces";
import { routeForView } from "./workspace-routes";

export interface NavigationItem { key: ActiveView; label: string; icon: string; permission?: string; service?: string }
export interface NavigationGroup { label: string; items: NavigationItem[] }
const groups: NavigationGroup[] = [
  { label: "Overview", items: [{ key: "overview", label: "Dashboard", icon: "D" }] },
  { label: "Work", items: [
    { key: "inquiries", label: "Leads", icon: "L", service: "LEADS", permission: "INQUIRY_VIEW" },
    { key: "crm", label: "Customers", icon: "C", service: "CRM", permission: "CRM_VIEW" },
    { key: "sales", label: "Sales", icon: "S", service: "SALES", permission: "DEAL_VIEW" },
    { key: "projects", label: "Projects", icon: "P", service: "PROJECTS", permission: "PROJECT_VIEW" },
    { key: "calendar", label: "Calendar", icon: "K", service: "CALENDAR", permission: "CALENDAR_VIEW" },
  ] },
  { label: "Money", items: [{ key: "finance", label: "Finance", icon: "F", service: "FINANCE", permission: "FINANCE_VIEW" }] },
  { label: "Intelligence", items: [
    { key: "b2agent", label: "Business Agent", icon: "✦", service: "B2BRAIN_AGENT" },
    { key: "analysis", label: "Business Analysis", icon: "B", service: "BUSINESS_ANALYSIS", permission: "ANALYSIS_VIEW" },
    { key: "actions", label: "Action Centre", icon: "!", service: "ACTION_CENTRE", permission: "APPROVAL_VIEW" },
  ] },
  { label: "System", items: [
    { key: "automation", label: "Automation", icon: "A", service: "AUTOMATION", permission: "AUTOMATION_VIEW" },
    { key: "people", label: "Team and Access", icon: "T", permission: "MEMBERSHIP_VIEW" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ] },
];
export function permittedNavigation(enabledServices: string[], session: AuthSession) {
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => (!item.service || enabledServices.includes(item.service)) && (!item.permission || session.membership.permissions.includes(item.permission))) })).filter((group) => group.items.length);
}
interface Props { activeView: ActiveView; enabledServices: string[]; isOpen: boolean; session: AuthSession; onClose: () => void; onNavigate: () => void; onSignOut: () => void; onSuperAdmin: () => void }
export function DashboardSidebar({ activeView, enabledServices, isOpen, session, onClose, onNavigate, onSignOut, onSuperAdmin }: Props) {
  const initials = `${session.user.firstName[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();
  return <aside className={`dashboard-sidebar${isOpen ? " mobile-open" : ""}`} id="dashboard-navigation">
    <div className="dashboard-logo"><Image src="/brand/b2brain-logo.png" alt="" width={38} height={38} /><span><strong>B² Brain</strong><small>Workspace</small></span><span className="sidebar-security-dot" title="Organization-isolated workspace" aria-label="Organization-isolated workspace">🔒</span></div>
    <button type="button" className="mobile-nav-close" onClick={onClose} aria-label="Close service menu">×</button>
    <nav aria-label="Primary navigation">{permittedNavigation(enabledServices, session).map((group) => <details className="sidebar-group" key={group.label} open><summary>{group.label}</summary><div>{group.items.map((item) => <Link key={item.key} className={activeView === item.key ? "active" : ""} aria-current={activeView === item.key ? "page" : undefined} href={routeForView(item.key)} onClick={onNavigate}><span className="nav-icon">{item.icon}</span>{item.label}</Link>)}</div></details>)}</nav>
    <div className="sidebar-utilities"><Link href={routeForView("b2help")} onClick={onNavigate}><span className="nav-icon">?</span>Help and Support</Link>{session.user.isPlatformAdmin && <button onClick={onSuperAdmin}><span className="nav-icon">↔</span>Switch to Super Admin</button>}</div>
    <div className="sidebar-account"><div className="avatar">{initials}</div><div><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.membership.role.name}</small></div><button onClick={onSignOut} title="Sign out" aria-label="Sign out">↗</button></div>
  </aside>;
}
