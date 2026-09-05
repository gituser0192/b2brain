export const queryKeys = {
  organization: (organizationId: string) =>
    ["organization", organizationId] as const,
  dashboard: (organizationId: string, days: string) =>
    [...queryKeys.organization(organizationId), "dashboard", { days }] as const,
  businessHealth: (organizationId: string, days: string) =>
    [...queryKeys.organization(organizationId), "business-health", { days }] as const,
  crm: (organizationId: string) =>
    [...queryKeys.organization(organizationId), "crm"] as const,
  customers: (
    organizationId: string,
    filters: { archived: boolean; page: number; query: string; status: string },
  ) => [...queryKeys.crm(organizationId), "customers", filters] as const,
  followUps: (organizationId: string, assignedToMe: boolean) =>
    [...queryKeys.crm(organizationId), "follow-ups", { assignedToMe }] as const,
};
