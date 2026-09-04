"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { DashboardHeader } from "./dashboard-header";
import { DashboardSidebar } from "./dashboard-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { WorkspaceAgent, type ActiveView } from "./dashboard-workspaces";
import { routeForView } from "./workspace-routes";

interface EnabledServicesResponse { success: true; data: { code: string }[] }
const guarded: Partial<Record<ActiveView, { service?: string; permission?: string }>> = {
  crm: { service: "CRM", permission: "CRM_VIEW" },
  projects: { service: "PROJECTS", permission: "PROJECT_VIEW" },
  finance: { service: "FINANCE", permission: "FINANCE_VIEW" },
  automation: { service: "AUTOMATION", permission: "AUTOMATION_VIEW" },
  b2agent: { service: "B2BRAIN_AGENT" },
};

function viewFromPath(pathname: string, legacyView: string | null): ActiveView {
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/automation")) return "automation";
  if (pathname.startsWith("/agent")) return "b2agent";
  if (pathname.startsWith("/settings")) return "settings";
  return pathname === "/dashboard" && legacyView ? legacyView as ActiveView : "overview";
}
export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = viewFromPath(pathname, searchParams.get("view"));
  const { session, isLoading, logout, authorizedRequest } = useAuth();
  const [enabledServices, setEnabledServices] = useState<string[] | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (!isLoading && session && !session.user.isPlatformAdmin && !session.organization.onboardingCompleted) router.replace("/onboarding");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session) return;
    void authorizedRequest<EnabledServicesResponse>("/services/enabled")
      .then((response) => setEnabledServices(response.data.map((service) => service.code)))
      .catch(() => setEnabledServices([]));
  }, [session, authorizedRequest]);

  if (isLoading || !session || enabledServices === null) return <main className="screen-loader"><span className="spinner dark" /><p>Opening your workspace…</p></main>;
  const rule = guarded[activeView];
  const allowed = (!rule?.service || enabledServices.includes(rule.service)) && (!rule?.permission || session.membership.permissions.includes(rule.permission));
  const navigate = (view: ActiveView) => router.push(routeForView(view));

  return <div className="dashboard-shell">
    <DashboardSidebar activeView={activeView} enabledServices={enabledServices} isOpen={mobileNavOpen} session={session} onClose={() => setMobileNavOpen(false)} onNavigate={() => setMobileNavOpen(false)} onSignOut={() => void logout().then(() => router.replace("/login"))} onSuperAdmin={() => router.push("/super-admin")} />
    {mobileNavOpen && <button type="button" className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close service menu" />}
    <main className="dashboard-main welcome-dashboard">
      <DashboardHeader activeView={activeView} enabledServices={enabledServices} isMobileNavigationOpen={mobileNavOpen} session={session} onOpenMobileNavigation={() => setMobileNavOpen(true)} onOpenOperations={() => router.push("/operations")} onOpenSuperAdmin={() => router.push("/super-admin")} />
      {allowed ? children : <section className="dashboard-notice error" role="alert"><strong>Access unavailable</strong><p>You do not have permission to open this service.</p></section>}
    </main>
    {enabledServices.includes("B2BRAIN_AGENT") && <button type="button" className="b2brain-floating-agent" onClick={() => setAgentOpen((value) => !value)} aria-label="Open Ask B² Brain" title="Ask B² Brain"><Image src="/brand/b2brain-logo.png" alt="" width={42} height={42} /><span>Ask B² Brain</span></button>}
    {enabledServices.includes("B2BRAIN_AGENT") && agentOpen && <aside className="workspace-agent-drawer"><header><div><strong>Ask B² Brain</strong><span>Business Operating Agent</span></div><button onClick={() => setAgentOpen(false)}>×</button></header><WorkspaceAgent compact onNavigate={(view) => { navigate(view as ActiveView); setAgentOpen(false); }} /></aside>}
    <MobileNavigation activeView={activeView} enabledServices={enabledServices} session={session} />
  </div>;
}
