export const serviceMaturityLevels = ["AVAILABLE", "BETA", "TEST_MODE", "FOUNDATION_ONLY", "PLANNED"] as const;
export type ServiceMaturity = (typeof serviceMaturityLevels)[number];
export type ServiceSellability = "GENERAL" | "BETA_ONLY" | "NOT_SELLABLE";

export interface ServiceMaturityMetadata {
  maturity: ServiceMaturity;
  maturityLabel: "Available" | "Beta" | "Test Mode" | "Internal foundation" | "Planned";
  availabilityNote: string;
  sellability: ServiceSellability;
  hasCustomerNavigation: boolean;
}

const available = (availabilityNote: string, hasCustomerNavigation = true): ServiceMaturityMetadata => ({ maturity: "AVAILABLE", maturityLabel: "Available", availabilityNote, sellability: "GENERAL", hasCustomerNavigation });
const beta = (availabilityNote: string, hasCustomerNavigation = false): ServiceMaturityMetadata => ({ maturity: "BETA", maturityLabel: "Beta", availabilityNote, sellability: "BETA_ONLY", hasCustomerNavigation });

export const serviceMaturityRegistry = {
  LEADS: available("Available for managing enquiries and lead follow-up."),
  CRM: available("Available for customer records, activity and follow-up."),
  SALES: available("Available for sales pipelines and quotations."),
  PROJECTS: available("Available for project and task management."),
  FINANCE: available("Available for finance records, invoices and collections."),
  BUSINESS_ANALYSIS: available("Available for verified business analysis."),
  ACTION_CENTRE: available("Available for approvals and recommended actions."),
  B2BRAIN_AGENT: beta("Beta business guidance using verified workspace data.", true),
  CATALOGUE: beta("Beta catalogue capability; no primary workspace shortcut is available yet."),
  SCHOOL: beta("Beta school-management capability; no primary workspace shortcut is available yet."),
  STAY: beta("Beta stay-management capability; no primary workspace shortcut is available yet."),
  CALENDAR: beta("Beta calendar workspace for appointments and schedules.", true),
  ORDERS: beta("Beta order-management capability; no primary workspace shortcut is available yet."),
  INVENTORY: beta("Beta inventory capability; no primary workspace shortcut is available yet."),
  PROCUREMENT: beta("Beta procurement capability; no primary workspace shortcut is available yet."),
  PEOPLE: beta("Beta employee-management capability; no primary workspace shortcut is available yet."),
  SUPPORT: beta("Beta support capability; no primary workspace shortcut is available yet."),
  WEBSITES: beta("Beta website-management capability; no primary workspace shortcut is available yet."),
  MARKETING: beta("Beta marketing capability; no primary workspace shortcut is available yet."),
  GOVERNANCE: beta("Beta governance capability; no primary workspace shortcut is available yet."),
  AUTOMATION: beta("Beta automation workspace. Individual integrations may remain in Test Mode.", true),
} as const satisfies Record<string, ServiceMaturityMetadata>;

export type RegisteredServiceKey = keyof typeof serviceMaturityRegistry;

export function serviceMaturityFor(code: string): ServiceMaturityMetadata | null {
  return Object.prototype.hasOwnProperty.call(serviceMaturityRegistry, code)
    ? serviceMaturityRegistry[code as RegisteredServiceKey]
    : null;
}
