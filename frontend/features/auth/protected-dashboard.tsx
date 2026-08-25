"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import type { AuthOrganization } from "./auth.types";
import { useAuth } from "./auth-context";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";

const workspaceLoading = () => <div className="dashboard-data-loader"><span className="spinner dark" />Opening service…</div>;
const TeamWorkspace = dynamic(() => import("@/features/memberships/team-workspace").then((module) => module.TeamWorkspace), { loading: workspaceLoading });
const RolesWorkspace = dynamic(() => import("@/features/roles/roles-workspace").then((module) => module.RolesWorkspace), { loading: workspaceLoading });
const CustomerWorkspace = dynamic(() => import("@/features/customers/customer-workspace").then((module) => module.CustomerWorkspace), { loading: workspaceLoading });
const AutomationWorkspace = dynamic(() => import("@/features/automation/automation-workspace").then((module) => module.AutomationWorkspace), { loading: workspaceLoading });
const ProjectWorkspace = dynamic(() => import("@/features/projects/project-workspace").then((module) => module.ProjectWorkspace), { loading: workspaceLoading });
const EmployeeWorkspace = dynamic(() => import("@/features/employees/employee-workspace").then((module) => module.EmployeeWorkspace), { loading: workspaceLoading });
const SalesWorkspace = dynamic(() => import("@/features/sales/sales-workspace").then((module) => module.SalesWorkspace), { loading: workspaceLoading });
const FinanceWorkspace = dynamic(() => import("@/features/finance/finance-workspace").then((module) => module.FinanceWorkspace), { loading: workspaceLoading });
const CatalogueWorkspace = dynamic(() => import("@/features/catalogue/catalogue-workspace").then((module) => module.CatalogueWorkspace), { loading: workspaceLoading });
const OrderWorkspace = dynamic(() => import("@/features/orders/order-workspace").then((module) => module.OrderWorkspace), { loading: workspaceLoading });
const InventoryWorkspace = dynamic(() => import("@/features/inventory/inventory-workspace").then((module) => module.InventoryWorkspace), { loading: workspaceLoading });
const MarketingWorkspace = dynamic(() => import("@/features/marketing/marketing-workspace").then((module) => module.MarketingWorkspace), { loading: workspaceLoading });
const AnalysisWorkspace = dynamic(() => import("@/features/analysis/analysis-workspace").then((module) => module.AnalysisWorkspace), { loading: workspaceLoading });
const SupportWorkspace = dynamic(() => import("@/features/support/support-workspace").then((module) => module.SupportWorkspace), { loading: workspaceLoading });
const ServiceRequestWorkspace = dynamic(() => import("@/features/service-requests/service-request-workspace").then((module) => module.ServiceRequestWorkspace), { loading: workspaceLoading });
const WebsiteWorkspace = dynamic(() => import("@/features/websites/website-workspace").then((module) => module.WebsiteWorkspace), { loading: workspaceLoading });
const ProcurementWorkspace = dynamic(() => import("@/features/procurement/procurement-workspace").then((module) => module.ProcurementWorkspace), { loading: workspaceLoading });
const CalendarWorkspace = dynamic(() => import("@/features/calendar/calendar-workspace").then((module) => module.CalendarWorkspace), { loading: workspaceLoading });
const InquiryWorkspace = dynamic(() => import("@/features/inquiries/inquiry-workspace").then((module) => module.InquiryWorkspace), { loading: workspaceLoading });
const StayWorkspace = dynamic(() => import("@/features/stay/stay-workspace").then((module) => module.StayWorkspace), { loading: workspaceLoading });
const GovernanceWorkspace = dynamic(() => import("@/features/governance/governance-workspace").then((module) => module.GovernanceWorkspace), { loading: workspaceLoading });
const ActionCentreWorkspace = dynamic(() => import("@/features/action-centre/action-centre-workspace").then((module) => module.ActionCentreWorkspace), { loading: workspaceLoading });
const SchoolWorkspace = dynamic(() => import("@/features/school/school-workspace").then((module) => module.SchoolWorkspace), { loading: workspaceLoading });

const navItems = [
  { key: "overview", label: "Dashboard", icon: "D", permission: null },
];

const ownerNavItems = [
  { key: "welcome", label: "Workspace Setup", icon: "W", permission: null },
  {
    key: "people",
    label: "Access & Team",
    icon: "T",
    permission: "MEMBERSHIP_VIEW",
  },
  { key: "roles", label: "Roles", icon: "R", permission: "ROLE_VIEW" },
];

const helpNavItem = {
  key: "b2help",
  label: "B² Brain Help",
  icon: "?",
  permission: null,
};

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
  type ActiveView =
    | "overview"
    | "welcome"
    | "b2help"
    | "people"
    | "roles"
    | "actions"
    | "governance"
    | "crm"
    | "automation"
    | "projects"
    | "employees"
    | "sales"
    | "finance"
    | "catalogue"
    | "orders"
    | "inventory"
    | "marketing"
    | "analysis"
    | "support"
    | "websites"
    | "procurement"
    | "calendar"
    | "inquiries"
    | "stay"
    | "school";
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [enabledServices, setEnabledServices] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
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
  if (isLoading || !session)
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
  const visibleNavItems = isOrganizationOwner
    ? [...navItems, ...ownerNavItems, helpNavItem]
    : [...navItems, helpNavItem];
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
      <aside className="dashboard-sidebar">
        <div className="dashboard-logo">
          <Image src="/brand/b2brain-logo.png" alt="" width={38} height={38} />
          <span>
            <strong>B² Brain</strong>
            <small>Workspace</small>
          </span>
        </div>
        <nav aria-label="Primary navigation">
          {visibleNavItems.map((item) =>
            (() => {
              const enabled =
                item.permission === null ||
                session.membership.permissions.includes(item.permission);
              return (
                <button
                  key={item.label}
                  className={activeView === item.key ? "active" : ""}
                  disabled={!enabled}
                  onClick={() =>
                    enabled && setActiveView(item.key as ActiveView)
                  }
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              );
            })(),
          )}
          {enabledServices.includes("ACTION_CENTRE") &&
            session.membership.permissions.includes("APPROVAL_VIEW") && (
              <button
                className={activeView === "actions" ? "active" : ""}
                onClick={() => setActiveView("actions")}
              >
                <span className="nav-icon">!</span>Action Centre
              </button>
            )}
          {enabledServices.includes("GOVERNANCE") &&
            session.membership.permissions.includes("APPROVAL_VIEW") && (
              <button
                className={activeView === "governance" ? "active" : ""}
                onClick={() => setActiveView("governance")}
              >
                <span className="nav-icon">✓</span>Approvals & Audit
              </button>
            )}
          {enabledServices.includes("CRM") &&
            session.membership.permissions.includes("CRM_VIEW") && (
              <button
                className={activeView === "crm" ? "active" : ""}
                onClick={() => setActiveView("crm")}
              >
                <span className="nav-icon">C</span>CRM
              </button>
            )}
          {enabledServices.includes("LEADS") &&
            session.membership.permissions.includes("INQUIRY_VIEW") && (
              <button
                className={activeView === "inquiries" ? "active" : ""}
                onClick={() => setActiveView("inquiries")}
              >
                <span className="nav-icon">Q</span>Inquiries
              </button>
            )}
          {enabledServices.includes("STAY") &&
            session.membership.permissions.includes("STAY_VIEW") && (
              <button
                className={activeView === "stay" ? "active" : ""}
                onClick={() => setActiveView("stay")}
              >
                <span className="nav-icon">H</span>B² Stay
              </button>
            )}
          {enabledServices.includes("SCHOOL") &&
            session.membership.permissions.includes("SCHOOL_VIEW") && (
              <button className={activeView === "school" ? "active" : ""} onClick={() => setActiveView("school")}>
                <span className="nav-icon">S</span>B² School
              </button>
            )}
          {enabledServices.includes("CATALOGUE") &&
            session.membership.permissions.includes("CATALOGUE_VIEW") && (
              <button
                className={activeView === "catalogue" ? "active" : ""}
                onClick={() => setActiveView("catalogue")}
              >
                <span className="nav-icon">G</span>Catalogue
              </button>
            )}
          {enabledServices.includes("ORDERS") &&
            session.membership.permissions.includes("ORDER_VIEW") && (
              <button
                className={activeView === "orders" ? "active" : ""}
                onClick={() => setActiveView("orders")}
              >
                <span className="nav-icon">O</span>Orders
              </button>
            )}
          {enabledServices.includes("INVENTORY") &&
            session.membership.permissions.includes("INVENTORY_VIEW") && (
              <button
                className={activeView === "inventory" ? "active" : ""}
                onClick={() => setActiveView("inventory")}
              >
                <span className="nav-icon">I</span>Inventory
              </button>
            )}
          {enabledServices.includes("MARKETING") &&
            session.membership.permissions.includes("MARKETING_VIEW") && (
              <button
                className={activeView === "marketing" ? "active" : ""}
                onClick={() => setActiveView("marketing")}
              >
                <span className="nav-icon">M</span>Marketing
              </button>
            )}
          {enabledServices.includes("SUPPORT") &&
            session.membership.permissions.includes("SUPPORT_VIEW") && (
              <button
                className={activeView === "support" ? "active" : ""}
                onClick={() => setActiveView("support")}
              >
                <span className="nav-icon">U</span>Support
              </button>
            )}
          {enabledServices.includes("WEBSITES") &&
            session.membership.permissions.includes("WEBSITE_VIEW") && (
              <button
                className={activeView === "websites" ? "active" : ""}
                onClick={() => setActiveView("websites")}
              >
                <span className="nav-icon">W</span>Websites
              </button>
            )}
          {enabledServices.includes("PROCUREMENT") &&
            session.membership.permissions.includes("PROCUREMENT_VIEW") && (
              <button
                className={activeView === "procurement" ? "active" : ""}
                onClick={() => setActiveView("procurement")}
              >
                <span className="nav-icon">V</span>Procurement
              </button>
            )}
          {enabledServices.includes("CALENDAR") &&
            session.membership.permissions.includes("CALENDAR_VIEW") && (
              <button
                className={activeView === "calendar" ? "active" : ""}
                onClick={() => setActiveView("calendar")}
              >
                <span className="nav-icon">K</span>Calendar
              </button>
            )}
          {enabledServices.includes("BUSINESS_ANALYSIS") &&
            session.membership.permissions.includes("ANALYSIS_VIEW") && (
              <button
                className={activeView === "analysis" ? "active" : ""}
                onClick={() => setActiveView("analysis")}
              >
                <span className="nav-icon">B</span>Analysis
              </button>
            )}
          {enabledServices.includes("SALES") &&
            session.membership.permissions.includes("DEAL_VIEW") && (
              <button
                className={activeView === "sales" ? "active" : ""}
                onClick={() => setActiveView("sales")}
              >
                <span className="nav-icon">S</span>Sales
              </button>
            )}
          {enabledServices.includes("FINANCE") &&
            session.membership.permissions.includes("FINANCE_VIEW") && (
              <button
                className={activeView === "finance" ? "active" : ""}
                onClick={() => setActiveView("finance")}
              >
                <span className="nav-icon">F</span>Finance
              </button>
            )}
          {enabledServices.includes("PROJECTS") &&
            session.membership.permissions.includes("PROJECT_VIEW") && (
              <button
                className={activeView === "projects" ? "active" : ""}
                onClick={() => setActiveView("projects")}
              >
                <span className="nav-icon">P</span>Projects
              </button>
            )}
          {enabledServices.includes("PEOPLE") &&
            session.membership.permissions.includes("EMPLOYEE_VIEW") && (
              <button
                className={activeView === "employees" ? "active" : ""}
                onClick={() => setActiveView("employees")}
              >
                <span className="nav-icon">E</span>Employees
              </button>
            )}
          {enabledServices.includes("AUTOMATION") &&
            session.membership.permissions.includes("AUTOMATION_VIEW") && (
              <button
                className={activeView === "automation" ? "active" : ""}
                onClick={() => setActiveView("automation")}
              >
                <span className="nav-icon">A</span>Automation
              </button>
            )}
        </nav>
        <div className="sidebar-security">
          <span>✓</span>
          <div>
            <strong>Organization isolated</strong>
            <small>Verified tenant context</small>
          </div>
        </div>
        <div className="sidebar-account">
          <div className="avatar">{initials}</div>
          <div>
            <strong>
              {session.user.firstName} {session.user.lastName}
            </strong>
            <small>{session.membership.role.name}</small>
          </div>
          <button
            onClick={() => void logout().then(() => router.replace("/login"))}
            title="Sign out"
          >
            ↗
          </button>
        </div>
      </aside>

      <main className="dashboard-main welcome-dashboard">
        <header className="dashboard-header">
          <div>
            <p>
              {new Intl.DateTimeFormat("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(new Date())}
            </p>
            <h1>{session.organization.name}</h1>
          </div>
          <div className="header-actions">
            {(session.user.isPlatformAdmin ||
              (session.organization.isServiceProvider &&
                session.membership.permissions.includes(
                  "PROVIDER_REQUEST_VIEW",
                ))) && (
              <>
                <button onClick={() => router.push("/operations")}>
                  Operations
                </button>
                <button onClick={() => router.push("/super-admin")}>
                  Super Admin
                </button>
              </>
            )}
            <NotificationCenter />
            <span className="status-pill">
              <i /> Workspace active
            </span>
            <button
              onClick={() => void logout().then(() => router.replace("/login"))}
            >
              Sign out
            </button>
          </div>
        </header>

        {notice && <div className="dashboard-notice success">{notice}</div>}
        {error && <div className="dashboard-notice error">{error}</div>}
        {activeView === "governance" && <GovernanceWorkspace />}
        {activeView === "actions" && <ActionCentreWorkspace />}

        {activeView === "overview" ? (
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
    </div>
  );
}
