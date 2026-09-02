"use client";

import dynamic from "next/dynamic";

const workspaceLoading = () => (
  <div className="dashboard-data-loader">
    <span className="spinner dark" />
    Opening service…
  </div>
);

export type ActiveView =
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
  | "school"
  | "settings"
  | "b2agent";

export const TeamWorkspace = dynamic(
  () => import("@/features/memberships/team-workspace").then((module) => module.TeamWorkspace),
  { loading: workspaceLoading },
);
export const RolesWorkspace = dynamic(
  () => import("@/features/roles/roles-workspace").then((module) => module.RolesWorkspace),
  { loading: workspaceLoading },
);
export const CustomerWorkspace = dynamic(
  () => import("@/features/customers/customer-workspace").then((module) => module.CustomerWorkspace),
  { loading: workspaceLoading },
);
export const AutomationWorkspace = dynamic(
  () => import("@/features/automation/automation-workspace").then((module) => module.AutomationWorkspace),
  { loading: workspaceLoading },
);
export const ProjectWorkspace = dynamic(
  () => import("@/features/projects/project-workspace").then((module) => module.ProjectWorkspace),
  { loading: workspaceLoading },
);
export const EmployeeWorkspace = dynamic(
  () => import("@/features/employees/employee-workspace").then((module) => module.EmployeeWorkspace),
  { loading: workspaceLoading },
);
export const SalesWorkspace = dynamic(
  () => import("@/features/sales/sales-workspace").then((module) => module.SalesWorkspace),
  { loading: workspaceLoading },
);
export const FinanceWorkspace = dynamic(
  () => import("@/features/finance/finance-workspace").then((module) => module.FinanceWorkspace),
  { loading: workspaceLoading },
);
export const CatalogueWorkspace = dynamic(
  () => import("@/features/catalogue/catalogue-workspace").then((module) => module.CatalogueWorkspace),
  { loading: workspaceLoading },
);
export const OrderWorkspace = dynamic(
  () => import("@/features/orders/order-workspace").then((module) => module.OrderWorkspace),
  { loading: workspaceLoading },
);
export const InventoryWorkspace = dynamic(
  () => import("@/features/inventory/inventory-workspace").then((module) => module.InventoryWorkspace),
  { loading: workspaceLoading },
);
export const MarketingWorkspace = dynamic(
  () => import("@/features/marketing/marketing-workspace").then((module) => module.MarketingWorkspace),
  { loading: workspaceLoading },
);
export const AnalysisWorkspace = dynamic(
  () => import("@/features/analysis/analysis-workspace").then((module) => module.AnalysisWorkspace),
  { loading: workspaceLoading },
);
export const SupportWorkspace = dynamic(
  () => import("@/features/support/support-workspace").then((module) => module.SupportWorkspace),
  { loading: workspaceLoading },
);
export const ServiceRequestWorkspace = dynamic(
  () => import("@/features/service-requests/service-request-workspace").then((module) => module.ServiceRequestWorkspace),
  { loading: workspaceLoading },
);
export const WebsiteWorkspace = dynamic(
  () => import("@/features/websites/website-workspace").then((module) => module.WebsiteWorkspace),
  { loading: workspaceLoading },
);
export const ProcurementWorkspace = dynamic(
  () => import("@/features/procurement/procurement-workspace").then((module) => module.ProcurementWorkspace),
  { loading: workspaceLoading },
);
export const CalendarWorkspace = dynamic(
  () => import("@/features/calendar/calendar-workspace").then((module) => module.CalendarWorkspace),
  { loading: workspaceLoading },
);
export const InquiryWorkspace = dynamic(
  () => import("@/features/inquiries/inquiry-workspace").then((module) => module.InquiryWorkspace),
  { loading: workspaceLoading },
);
export const StayWorkspace = dynamic(
  () => import("@/features/stay/stay-workspace").then((module) => module.StayWorkspace),
  { loading: workspaceLoading },
);
export const GovernanceWorkspace = dynamic(
  () => import("@/features/governance/governance-workspace").then((module) => module.GovernanceWorkspace),
  { loading: workspaceLoading },
);
export const ActionCentreWorkspace = dynamic(
  () => import("@/features/action-centre/action-centre-workspace").then((module) => module.ActionCentreWorkspace),
  { loading: workspaceLoading },
);
export const SchoolWorkspace = dynamic(
  () => import("@/features/school/school-workspace").then((module) => module.SchoolWorkspace),
  { loading: workspaceLoading },
);
export const SettingsWorkspace = dynamic(
  () => import("@/features/settings/settings-workspace").then((module) => module.SettingsWorkspace),
  { loading: workspaceLoading },
);
export const WorkspaceAgent = dynamic(
  () => import("@/features/workspace-agent/workspace-agent").then((module) => module.WorkspaceAgent),
  { loading: workspaceLoading },
);
