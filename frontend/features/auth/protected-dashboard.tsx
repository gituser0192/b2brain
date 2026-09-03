"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { ApiError } from "@/services/api-client";
import { useAuth } from "./auth-context";
import { DashboardWelcome } from "./dashboard-welcome";
import type { AuthOrganization } from "./auth.types";
import { primaryRouteForLegacyView, routeForView } from "./workspace-routes";
import { ActionCentreWorkspace, AnalysisWorkspace, CalendarWorkspace, CatalogueWorkspace, EmployeeWorkspace, GovernanceWorkspace, InquiryWorkspace, InventoryWorkspace, MarketingWorkspace, OrderWorkspace, ProcurementWorkspace, RolesWorkspace, SalesWorkspace, SchoolWorkspace, ServiceRequestWorkspace, StayWorkspace, SupportWorkspace, TeamWorkspace, WebsiteWorkspace, type ActiveView } from "./dashboard-workspaces";

const legacyViews = new Set<ActiveView>(["welcome", "b2help", "people", "roles", "actions", "governance", "employees", "sales", "catalogue", "orders", "inventory", "marketing", "analysis", "support", "websites", "procurement", "calendar", "inquiries", "stay", "school"]);
interface OrganizationResponse { success: true; data: AuthOrganization }
function WorkspaceSetup() {
  const router = useRouter();
  const { session, authorizedRequest, updateOrganization } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", timezone: "Asia/Kolkata", currency: "INR" });
  if (!session) return null;
  const isOwner = session.membership.role.code === "ORGANIZATION_OWNER";
  const canUpdate = isOwner && session.membership.permissions.includes("ORGANIZATION_UPDATE");
  const initials = `${session.user.firstName[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase();
  function toggle() { if (!editing) setForm({ name: session!.organization.name, timezone: session!.organization.timezone, currency: session!.organization.currency }); setEditing((value) => !value); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await authorizedRequest<OrganizationResponse>("/organizations/current", { method: "PATCH", body: JSON.stringify(form) }); updateOrganization(response.data); setEditing(false); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save organization preferences."); }
    finally { setSaving(false); }
  }
  return <><DashboardWelcome editing={editing} form={form} hasOrganizationUpdate={canUpdate} initials={initials} isOrganizationOwner={isOwner} saving={saving} session={session} onCloseEditor={() => setEditing(false)} onFormChange={setForm} onOpenPeople={() => router.push("/dashboard?view=people")} onSaveOrganization={save} onToggleEditor={toggle} />{error && <div className="dashboard-notice error">{error}</div>}</>;
}
function LegacyWorkspace({ view }: Readonly<{ view: ActiveView }>) {
  const router = useRouter();
  const navigate = (target: string) => router.push(routeForView(target as ActiveView));
  if (view === "welcome") return <WorkspaceSetup />;
  if (view === "b2help") return <ServiceRequestWorkspace />;
  if (view === "people") return <TeamWorkspace />;
  if (view === "roles") return <RolesWorkspace />;
  if (view === "actions") return <ActionCentreWorkspace />;
  if (view === "governance") return <GovernanceWorkspace />;
  if (view === "school") return <SchoolWorkspace />;
  if (view === "stay") return <StayWorkspace />;
  if (view === "inquiries") return <InquiryWorkspace onNavigate={navigate} />;
  if (view === "analysis") return <AnalysisWorkspace onNavigate={navigate} />;
  if (view === "support") return <SupportWorkspace />;
  if (view === "websites") return <WebsiteWorkspace />;
  if (view === "procurement") return <ProcurementWorkspace />;
  if (view === "calendar") return <CalendarWorkspace />;
  if (view === "catalogue") return <CatalogueWorkspace />;
  if (view === "orders") return <OrderWorkspace />;
  if (view === "inventory") return <InventoryWorkspace />;
  if (view === "marketing") return <MarketingWorkspace />;
  if (view === "sales") return <SalesWorkspace onNavigate={navigate} />;
  if (view === "employees") return <EmployeeWorkspace />;
  return <BusinessDashboard onNavigate={navigate} />;
}
export function ProtectedDashboard() {
  const router = useRouter();
  const requested = useSearchParams().get("view");
  const destination = primaryRouteForLegacyView(requested);
  const legacyView = requested && legacyViews.has(requested as ActiveView) ? requested as ActiveView : "overview";
  useEffect(() => {
    if (destination && destination !== "/dashboard") { router.replace(destination); return; }
  }, [destination, router]);
  if (destination && destination !== "/dashboard") return <main className="screen-loader"><span className="spinner dark" /><p>Opening your workspace…</p></main>;
  return <LegacyWorkspace view={legacyView} />;
}
