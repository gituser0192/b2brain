"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import type { AuthOrganization } from "./auth.types";
import { useAuth } from "./auth-context";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
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
        <header className="dashboard-header">
          <div className="dashboard-heading">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open service menu"
              aria-expanded={mobileNavOpen}
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
            {(session.user.isPlatformAdmin ||
              (session.organization.isServiceProvider &&
                session.membership.permissions.includes(
                  "PROVIDER_REQUEST_VIEW",
                ))) && (
              <button className="desktop-header-action" onClick={() => router.push("/operations")}>
                Operations
              </button>
            )}
            {session.user.isPlatformAdmin && (
              <button className="desktop-header-action" onClick={() => router.push("/super-admin")}>
                Super Admin
              </button>
            )}
            <NotificationCenter />
            <span className="status-pill">
              <i /> Workspace active
            </span>
          </div>
        </header>

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
          <>
            <section className="welcome-hero">
              <div className="hero-copy">
                <span className="welcome-badge">Welcome to your workspace</span>
                <h2>
                  Good to have you here,
                  <br />
                  <em>{session.user.firstName}.</em>
                </h2>
                <p>
                  This is the starting point for {session.organization.name}.
                  Complete the essentials below, then add real business modules
                  when you are ready.
                </p>
                <div className="hero-assurances">
                  <span>✓ No sample data</span>
                  <span>✓ Private to your organization</span>
                  <span>✓ Role-protected access</span>
                </div>
              </div>
              <div className="hero-brain" aria-hidden="true">
                <div className="hero-logo">
                  <Image
                    src="/brand/b2brain-logo.png"
                    alt=""
                    fill
                    sizes="190px"
                  />
                </div>
                <span className="orbit-dot dot-a" />
                <span className="orbit-dot dot-b" />
                <span className="orbit-dot dot-c" />
              </div>
            </section>

            <div className="dashboard-content-grid">
              <section className="setup-section">
                <div className="section-heading">
                  <div>
                    <p>Getting started</p>
                    <h2>Set up your foundation</h2>
                  </div>
                  <span>1 of 4 ready</span>
                </div>
                <div className="setup-list">
                  <article className="setup-item complete">
                    <span className="setup-state">✓</span>
                    <div>
                      <h3>Workspace created</h3>
                      <p>
                        Your isolated organization and owner account are ready.
                      </p>
                    </div>
                    <span className="item-status">Complete</span>
                  </article>
                  <article className="setup-item">
                    <span className="setup-state">2</span>
                    <div>
                      <h3>Confirm organization preferences</h3>
                      <p>Check your name, timezone, and operating currency.</p>
                    </div>
                    <button
                      onClick={() =>
                        toggleOrganizationEditor(session.organization)
                      }
                      disabled={!hasOrganizationUpdate}
                    >
                      {editing ? "Close" : "Review"}
                    </button>
                  </article>
                  {isOrganizationOwner && (
                    <article className="setup-item">
                      <span className="setup-state">3</span>
                      <div>
                        <h3>Invite your team</h3>
                        <p>
                          Create secure invitations and assign the right
                          starting role.
                        </p>
                      </div>
                      <button onClick={() => setActiveView("people")}>
                        Open People
                      </button>
                    </article>
                  )}
                  <article className="setup-item">
                    <span className="setup-state">4</span>
                    <div>
                      <h3>Start your first business module</h3>
                      <p>
                        Assigned modules will appear automatically when your
                        platform plan enables them.
                      </p>
                    </div>
                    <span className="item-status">Awaiting access</span>
                  </article>
                </div>

                {editing && (
                  <form
                    className="organization-form"
                    onSubmit={saveOrganization}
                  >
                    <div className="settings-title">
                      <div>
                        <p>Organization preferences</p>
                        <h3>Make the workspace yours</h3>
                      </div>
                      <button type="button" onClick={() => setEditing(false)}>
                        ×
                      </button>
                    </div>
                    <label>
                      <span>Organization name</span>
                      <input
                        value={form.name}
                        onChange={(event) =>
                          setForm({ ...form, name: event.target.value })
                        }
                        maxLength={120}
                        required
                      />
                    </label>
                    <div className="settings-grid">
                      <label>
                        <span>Timezone</span>
                        <select
                          value={form.timezone}
                          onChange={(event) =>
                            setForm({ ...form, timezone: event.target.value })
                          }
                        >
                          <option>Asia/Kolkata</option>
                          <option>UTC</option>
                          <option>America/New_York</option>
                          <option>Europe/London</option>
                          <option>Asia/Dubai</option>
                          <option>Asia/Singapore</option>
                        </select>
                      </label>
                      <label>
                        <span>Currency</span>
                        <select
                          value={form.currency}
                          onChange={(event) =>
                            setForm({ ...form, currency: event.target.value })
                          }
                        >
                          <option>INR</option>
                          <option>USD</option>
                          <option>GBP</option>
                          <option>EUR</option>
                          <option>AED</option>
                          <option>SGD</option>
                        </select>
                      </label>
                    </div>
                    <button className="save-settings" disabled={saving}>
                      {saving ? "Saving…" : "Save preferences"}
                    </button>
                  </form>
                )}
              </section>

              <aside className="workspace-summary">
                <div className="summary-card">
                  <p>Account & access</p>
                  <div className="summary-user">
                    <div className="avatar large">{initials}</div>
                    <div>
                      <strong>
                        {session.user.firstName} {session.user.lastName}
                      </strong>
                      <span>{session.user.email}</span>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Role</dt>
                      <dd>{session.membership.role.name}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{session.organization.timezone}</dd>
                    </div>
                    <div>
                      <dt>Currency</dt>
                      <dd>{session.organization.currency}</dd>
                    </div>
                  </dl>
                </div>
                <div className="clean-state-card">
                  <span className="clean-icon">◇</span>
                  <div>
                    <strong>Clean workspace</strong>
                    <p>
                      No customers, projects, tasks, invoices, employees, or
                      analytics have been created.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </>
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
