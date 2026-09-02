"use client";

import { NotificationCenter } from "@/features/notifications/notification-center";
import type { AuthSession } from "./auth.types";

interface DashboardHeaderProps {
  isMobileNavigationOpen: boolean;
  session: AuthSession;
  onOpenMobileNavigation: () => void;
  onOpenOperations: () => void;
  onOpenSuperAdmin: () => void;
}

export function DashboardHeader({
  isMobileNavigationOpen,
  session,
  onOpenMobileNavigation,
  onOpenOperations,
  onOpenSuperAdmin,
}: DashboardHeaderProps) {
  const canOpenOperations =
    session.user.isPlatformAdmin ||
    (session.organization.isServiceProvider &&
      session.membership.permissions.includes("PROVIDER_REQUEST_VIEW"));

  return (
    <header className="dashboard-header">
      <div className="dashboard-heading">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onOpenMobileNavigation}
          aria-label="Open service menu"
          aria-expanded={isMobileNavigationOpen}
          aria-controls="dashboard-navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <div className="dashboard-organization-identity">
          <p className="dashboard-date">
            {new Intl.DateTimeFormat("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </p>
          <h1>{session.organization.name}</h1>
          <div className="dashboard-mobile-context">
            <span><i /> Workspace active</span>
          </div>
        </div>
      </div>
      <div className="header-actions">
        {canOpenOperations && (
          <button className="desktop-header-action" onClick={onOpenOperations}>
            Operations
          </button>
        )}
        {session.user.isPlatformAdmin && (
          <button className="desktop-header-action" onClick={onOpenSuperAdmin}>
            Super Admin
          </button>
        )}
        <NotificationCenter />
        <span className="status-pill"><i /> Workspace active</span>
      </div>
    </header>
  );
}
