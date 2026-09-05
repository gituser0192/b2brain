import type { ActiveView } from "./dashboard-workspaces";

export const primaryViewRoutes: Partial<Record<ActiveView, string>> = {
  overview: "/dashboard",
  crm: "/crm",
  projects: "/projects",
  finance: "/finance",
  automation: "/automation",
  b2agent: "/agent",
  settings: "/settings",
  people: "/settings?section=team",
  roles: "/settings?section=roles",
};

export function routeForView(view: ActiveView) {
  return primaryViewRoutes[view] ?? `/dashboard?view=${view}`;
}

export function primaryRouteForLegacyView(view: string | null) {
  if (view === "customers") return "/crm";
  return view ? primaryViewRoutes[view as ActiveView] : undefined;
}
