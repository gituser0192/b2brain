"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import type { AuthOrganization } from "./auth.types";
import { useAuth } from "./auth-context";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { DashboardHeader } from "./dashboard-header";
import { DashboardWelcome } from "./dashboard-welcome";
import { DashboardSidebar } from "./dashboard-sidebar";
import {
  ActionCentreWorkspace,
  AnalysisWorkspace,
  AutomationWorkspace,
  CalendarWorkspace,
  CatalogueWorkspace,
  CustomerWorkspace,
  EmployeeWorkspace,
  FinanceWorkspace,
  GovernanceWorkspace,
  InquiryWorkspace,
  InventoryWorkspace,
  MarketingWorkspace,
  OrderWorkspace,
  ProcurementWorkspace,
  ProjectWorkspace,
  RolesWorkspace,
  SalesWorkspace,
  SchoolWorkspace,
  ServiceRequestWorkspace,
  SettingsWorkspace,
  StayWorkspace,
  SupportWorkspace,
  TeamWorkspace,
  WebsiteWorkspace,
  WorkspaceAgent,
  type ActiveView,
} from "./dashboard-workspaces";

const activeViews = new Set<ActiveView>([
  "overview", "welcome", "b2help", "people", "roles", "actions",
  "governance", "crm", "automation", "projects", "employees", "sales",
  "finance", "catalogue", "orders", "inventory", "marketing", "analysis",
  "support", "websites", "procurement", "calendar", "inquiries", "stay",
  "school", "settings", "b2agent",
]);

function viewFromLocation(): ActiveView {
  const view = new URLSearchParams(window.location.search).get("view");
  return view && activeViews.has(view as ActiveView) ? (view as ActiveView) : "overview";
}

interface OrganizationResponse {
  success: true;
  message?: string;
  data: AuthOrganization;
}
interface EnabledServicesResponse {
  success: true;
  data: {
    id: string;
    code: string;
    name: string;
    iconKey: string | null;
    routePath: string | null;
  }[];
}

export function ProtectedDashboard() {
  const router = useRouter();
  const { session, isLoading, logout, authorizedRequest, updateOrganization } =
    useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });
  const [activeView, setActiveViewState] = useState<ActiveView>("overview");
  const [navigationReady, setNavigationReady] = useState(false);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function setActiveView(view: ActiveView) {
    setActiveViewState(view);
    setMobileNavOpen(false);
    const url = new URL(window.location.href);
    if (view === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    const restoreView = () => setActiveViewState(viewFromLocation());
    const task = window.setTimeout(() => {
      restoreView();
      setNavigationReady(true);
    }, 0);
    window.addEventListener("popstate", restoreView);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("popstate", restoreView);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (
      !isLoading &&
      session &&
      !session.user.isPlatformAdmin &&
      !session.organization.onboardingCompleted
    )
      router.replace("/onboarding");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session) return;
    const task = window.setTimeout(
      () =>
        void authorizedRequest<EnabledServicesResponse>("/services/enabled")
          .then((response) =>
            setEnabledServices(response.data.map((service) => service.code)),
          )
          .catch(() => setEnabledServices([])),
      0,
    );
    return () => window.clearTimeout(task);
  }, [session, authorizedRequest]);
  if (isLoading || !session || !navigationReady)
    return (
      <main className="screen-loader">
        <span className="spinner dark" />
        <p>Opening your workspace…</p>
      </main>
    );

  const initials =
    `${session.user.firstName[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();
  const isOrganizationOwner =
    session.membership.role.code === "ORGANIZATION_OWNER";
  const hasOrganizationUpdate =
    isOrganizationOwner &&
    session.membership.permissions.includes("ORGANIZATION_UPDATE");
  function toggleOrganizationEditor(organization: AuthOrganization) {
    if (!editing)
      setForm({
        name: organization.name,
        timezone: organization.timezone,
        currency: organization.currency,
      });
    setEditing((value) => !value);
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedRequest<OrganizationResponse>(
        "/organizations/current",
        { method: "PATCH", body: JSON.stringify(form) },
      );
      updateOrganization(response.data);
      setEditing(false);
      setNotice("Organization preferences saved.");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to save organization preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar
        activeView={activeView}
        enabledServices={enabledServices}
        isOpen={mobileNavOpen}
        session={session}
        onClose={() => setMobileNavOpen(false)}
        onSelect={setActiveView}
        onSignOut={() => void logout().then(() => router.replace("/login"))}
        onSuperAdmin={() => router.push("/super-admin")}
      />
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close service menu"
        />
      )}

      <main className="dashboard-main welcome-dashboard">
        <DashboardHeader
          isMobileNavigationOpen={mobileNavOpen}
          session={session}
          onOpenMobileNavigation={() => setMobileNavOpen(true)}
          onOpenOperations={() => router.push("/operations")}
          onOpenSuperAdmin={() => router.push("/super-admin")}
        />

        {notice && <div className="dashboard-notice success">{notice}</div>}
        {error && <div className="dashboard-notice error">{error}</div>}
        {activeView === "governance" && <GovernanceWorkspace />}
        {activeView === "settings" && <SettingsWorkspace />}
        {activeView === "actions" && <ActionCentreWorkspace />}
        {activeView === "b2agent" && (
          <WorkspaceAgent
            onNavigate={(view) => setActiveView(view as ActiveView)}
          />
        )}

        {activeView === "b2agent" ? null : activeView === "overview" ? (
          <BusinessDashboard
            onNavigate={(view) => setActiveView(view as ActiveView)}
          />
        ) : activeView === "b2help" ? (
          <ServiceRequestWorkspace />
        ) : activeView === "actions" ||
          activeView === "governance" ? null : activeView === "school" ? (
          <SchoolWorkspace />
        ) : activeView === "stay" ? (
          <StayWorkspace />
        ) : activeView === "inquiries" ? (
          <InquiryWorkspace onNavigate={(view) => setActiveView(view)} />
        ) : activeView === "analysis" ? (
          <AnalysisWorkspace
            onNavigate={(view) => setActiveView(view as ActiveView)}
          />
        ) : activeView === "support" ? (
          <SupportWorkspace />
        ) : activeView === "websites" ? (
          <WebsiteWorkspace />
        ) : activeView === "procurement" ? (
          <ProcurementWorkspace />
        ) : activeView === "calendar" ? (
          <CalendarWorkspace />
        ) : activeView === "people" ? (
          <TeamWorkspace />
        ) : activeView === "roles" ? (
          <RolesWorkspace />
        ) : activeView === "crm" ? (
          <CustomerWorkspace />
        ) : activeView === "catalogue" ? (
          <CatalogueWorkspace />
        ) : activeView === "orders" ? (
          <OrderWorkspace />
        ) : activeView === "inventory" ? (
          <InventoryWorkspace />
        ) : activeView === "marketing" ? (
          <MarketingWorkspace />
        ) : activeView === "sales" ? (
          <SalesWorkspace onNavigate={(view) => setActiveView(view)} />
        ) : activeView === "finance" ? (
          <FinanceWorkspace />
        ) : activeView === "projects" ? (
          <ProjectWorkspace />
        ) : activeView === "employees" ? (
          <EmployeeWorkspace />
        ) : activeView === "automation" ? (
          <AutomationWorkspace />
        ) : (
          <DashboardWelcome
            editing={editing}
            form={form}
            hasOrganizationUpdate={hasOrganizationUpdate}
            initials={initials}
            isOrganizationOwner={isOrganizationOwner}
            saving={saving}
            session={session}
            onCloseEditor={() => setEditing(false)}
            onFormChange={setForm}
            onOpenPeople={() => setActiveView("people")}
            onSaveOrganization={saveOrganization}
            onToggleEditor={() => toggleOrganizationEditor(session.organization)}
          />
        )}
      </main>
      {enabledServices.includes("B2BRAIN_AGENT") && (
        <button
          type="button"
          className="b2brain-floating-agent"
          onClick={() => setAgentOpen((value) => !value)}
          aria-label="Open Ask B² Brain"
          title="Ask B² Brain"
        >
          <Image src="/brand/b2brain-logo.png" alt="" width={42} height={42} />
          <span>Ask B² Brain</span>
        </button>
      )}
      {enabledServices.includes("B2BRAIN_AGENT") && agentOpen && (
        <aside className="workspace-agent-drawer">
          <header>
            <div>
              <strong>Ask B² Brain</strong>
              <span>Business Operating Agent</span>
            </div>
            <button onClick={() => setAgentOpen(false)}>×</button>
          </header>
          <WorkspaceAgent
            compact
            onNavigate={(view) => {
              setActiveView(view as ActiveView);
              setAgentOpen(false);
            }}
          />
        </aside>
      )}
    </div>
  );
}
