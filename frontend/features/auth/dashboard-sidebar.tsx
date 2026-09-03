"use client";

import Image from "next/image";
import Link from "next/link";
import type { AuthSession } from "./auth.types";
import type { ActiveView } from "./dashboard-workspaces";
import { routeForView } from "./workspace-routes";

interface NavigationItem {
  key: ActiveView;
  label: string;
  icon: string;
  permission?: string;
  service?: string;
}

const baseNavigation: NavigationItem[] = [
  { key: "overview", label: "Dashboard", icon: "D" },
];

const ownerNavigation: NavigationItem[] = [
  { key: "welcome", label: "Workspace Setup", icon: "W" },
  { key: "people", label: "Access & Team", icon: "T", permission: "MEMBERSHIP_VIEW" },
  { key: "roles", label: "Roles", icon: "R", permission: "ROLE_VIEW" },
];

const sharedNavigation: NavigationItem[] = [
  { key: "b2help", label: "B² Brain Help", icon: "?" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

const serviceNavigation: NavigationItem[] = [
  { key: "b2agent", label: "Ask B² Brain", icon: "✦", service: "B2BRAIN_AGENT" },
  { key: "actions", label: "Action Centre", icon: "!", service: "ACTION_CENTRE", permission: "APPROVAL_VIEW" },
  { key: "governance", label: "Approvals & Audit", icon: "✓", service: "GOVERNANCE", permission: "APPROVAL_VIEW" },
  { key: "crm", label: "CRM", icon: "C", service: "CRM", permission: "CRM_VIEW" },
  { key: "inquiries", label: "Inquiries", icon: "Q", service: "LEADS", permission: "INQUIRY_VIEW" },
  { key: "stay", label: "B² Stay", icon: "H", service: "STAY", permission: "STAY_VIEW" },
  { key: "school", label: "B² School", icon: "S", service: "SCHOOL", permission: "SCHOOL_VIEW" },
  { key: "catalogue", label: "Catalogue", icon: "G", service: "CATALOGUE", permission: "CATALOGUE_VIEW" },
  { key: "orders", label: "Orders", icon: "O", service: "ORDERS", permission: "ORDER_VIEW" },
  { key: "inventory", label: "Inventory", icon: "I", service: "INVENTORY", permission: "INVENTORY_VIEW" },
  { key: "marketing", label: "Marketing", icon: "M", service: "MARKETING", permission: "MARKETING_VIEW" },
  { key: "support", label: "Support", icon: "U", service: "SUPPORT", permission: "SUPPORT_VIEW" },
  { key: "websites", label: "Websites", icon: "W", service: "WEBSITES", permission: "WEBSITE_VIEW" },
  { key: "procurement", label: "Procurement", icon: "V", service: "PROCUREMENT", permission: "PROCUREMENT_VIEW" },
  { key: "calendar", label: "Calendar", icon: "K", service: "CALENDAR", permission: "CALENDAR_VIEW" },
  { key: "analysis", label: "Analysis", icon: "B", service: "BUSINESS_ANALYSIS", permission: "ANALYSIS_VIEW" },
  { key: "sales", label: "Sales", icon: "S", service: "SALES", permission: "DEAL_VIEW" },
  { key: "finance", label: "Finance", icon: "F", service: "FINANCE", permission: "FINANCE_VIEW" },
  { key: "projects", label: "Projects", icon: "P", service: "PROJECTS", permission: "PROJECT_VIEW" },
  { key: "employees", label: "Employees", icon: "E", service: "PEOPLE", permission: "EMPLOYEE_VIEW" },
  { key: "automation", label: "Automation", icon: "A", service: "AUTOMATION", permission: "AUTOMATION_VIEW" },
];

interface DashboardSidebarProps {
  activeView: ActiveView;
  enabledServices: string[];
  isOpen: boolean;
  session: AuthSession;
  onClose: () => void;
  onNavigate: () => void;
  onSignOut: () => void;
  onSuperAdmin: () => void;
}

export function DashboardSidebar({
  activeView,
  enabledServices,
  isOpen,
  session,
  onClose,
  onNavigate,
  onSignOut,
  onSuperAdmin,
}: DashboardSidebarProps) {
  const isOwner = session.membership.role.code === "ORGANIZATION_OWNER";
  const initials = `${session.user.firstName[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();
  const primaryNavigation = isOwner
    ? [...baseNavigation, ...ownerNavigation, ...sharedNavigation]
    : [...baseNavigation, ...sharedNavigation];
  const enabledNavigation = serviceNavigation.filter(
    (item) =>
      item.service &&
      enabledServices.includes(item.service) &&
      (!item.permission || session.membership.permissions.includes(item.permission)),
  );

  return (
    <aside className={`dashboard-sidebar${isOpen ? " mobile-open" : ""}`} id="dashboard-navigation">
      <div className="dashboard-logo">
        <Image src="/brand/b2brain-logo.png" alt="" width={38} height={38} />
        <span><strong>B² Brain</strong><small>Workspace</small></span>
      </div>
      <button type="button" className="mobile-nav-close" onClick={onClose} aria-label="Close service menu">×</button>
      <nav aria-label="Primary navigation">
        {primaryNavigation.map((item) => {
          const enabled = !item.permission || session.membership.permissions.includes(item.permission);
          return (
            enabled ? <Link key={item.key} className={activeView === item.key ? "active" : ""} href={routeForView(item.key)} onClick={onNavigate}><span className="nav-icon">{item.icon}</span>{item.label}</Link>
              : <button key={item.key} disabled><span className="nav-icon">{item.icon}</span>{item.label}</button>
          );
        })}
        {enabledNavigation.map((item) => (
          <Link key={item.key} className={activeView === item.key ? "active" : ""} href={routeForView(item.key)} onClick={onNavigate}><span className="nav-icon">{item.icon}</span>{item.label}</Link>
        ))}
        {session.user.isPlatformAdmin && (
          <button onClick={onSuperAdmin}><span className="nav-icon">↔</span>Switch to Super Admin</button>
        )}
      </nav>
      <div className="sidebar-security">
        <span>✓</span>
        <div><strong>Organization isolated</strong><small>Verified tenant context</small></div>
      </div>
      <div className="sidebar-account">
        <div className="avatar">{initials}</div>
        <div><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.membership.role.name}</small></div>
        <button onClick={onSignOut} title="Sign out">↗</button>
      </div>
    </aside>
  );
}
