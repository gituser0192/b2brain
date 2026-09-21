import { prisma } from "../../database/prisma.js";
import { serviceMaturityRegistry, type RegisteredServiceKey, type ServiceMaturity } from "../services/service-maturity.js";
import type { WorkspaceAgentContext } from "./workspace-agent.capabilities.js";

export type SetupStatus = "READY" | "PARTIALLY_CONFIGURED" | "ACTION_REQUIRED" | "EXTERNAL_AUTHORIZATION_REQUIRED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "FORBIDDEN" | "BETA" | "PLANNED" | "UNSUPPORTED";
export type SetupArea = { key: RegisteredServiceKey; name: string; maturity: ServiceMaturity; status: SetupStatus; optional: boolean; why: string; agentCan: string; customerMust: string; href: string; externalAuthorization: boolean; credentialsAllowed: false };

const permissions: Partial<Record<RegisteredServiceKey, string>> = { LEADS: "INQUIRY_VIEW", CRM: "CRM_VIEW", SALES: "DEAL_VIEW", PROJECTS: "PROJECT_VIEW", FINANCE: "FINANCE_VIEW", BUSINESS_ANALYSIS: "ANALYSIS_VIEW", ACTION_CENTRE: "APPROVAL_VIEW", AUTOMATION: "AUTOMATION_VIEW", PEOPLE: "EMPLOYEE_VIEW", CALENDAR: "CALENDAR_VIEW" };
const links: Partial<Record<RegisteredServiceKey, string>> = { LEADS: "/dashboard?view=inquiries", CRM: "/crm", SALES: "/dashboard?view=sales", PROJECTS: "/projects", FINANCE: "/finance", BUSINESS_ANALYSIS: "/dashboard?view=analysis", ACTION_CENTRE: "/dashboard?view=governance", B2BRAIN_AGENT: "/agent", AUTOMATION: "/automation?section=connections", PEOPLE: "/people", CALENDAR: "/dashboard?view=calendar" };
const names: Partial<Record<RegisteredServiceKey, string>> = { B2BRAIN_AGENT: "Business Agent", BUSINESS_ANALYSIS: "Business Analysis", ACTION_CENTRE: "Action Centre", WEBSITES: "Website lead capture" };

export async function assessWorkspaceSetup(context: WorkspaceAgentContext, request: string) {
  const lower = request.toLowerCase();
  if (/\b(exit|close)\s+(guided\s+)?setup\b/i.test(request)) return { answer: "Guided setup closed. Your verified setup data was not changed.", exited: true, areas: [], steps: [], mutationPerformed: false, externalCallPerformed: false };
  if (/(password|otp|access token|app secret|verify token|encryption key|signing secret|webhook secret)/i.test(request)) return { answer: "I will never ask for passwords, OTPs, tokens or secrets. Use only the official setup screen.", refused: true, areas: [], steps: [] };
  if (/(enable|disable).*(service)|service.*(enable|disable)/i.test(request)) return { answer: "I cannot enable or disable organization services. Contact your SATHOS administrator.", refused: true, areas: [], steps: [] };
  const [organization, enabledRows, memberAccess] = await Promise.all([
    prisma.organization.findFirst({ where: { id: context.organizationId, deletedAt: null }, select: { name: true, industry: true, phone: true, businessSize: true, monthlyRevenueRange: true, primaryBusinessGoal: true, timezone: true, currency: true } }),
    prisma.organizationService.findMany({ where: { organizationId: context.organizationId, status: "ENABLED", deletedAt: null, service: { status: "ACTIVE", archivedAt: null } }, select: { service: { select: { code: true } } }, take: 21 }),
    prisma.membershipServiceAccess.findMany({ where: { organizationId: context.organizationId, membershipId: context.membershipId }, select: { accessMode: true, service: { select: { code: true } } }, take: 21 }),
  ]);
  const enabled = new Set(enabledRows.map((row) => row.service.code));
  const assigned = new Set(memberAccess.map((row) => row.service.code));
  const owner = context.roleCode === "ORGANIZATION_OWNER";
  const canRead = (key: RegisteredServiceKey) => enabled.has(key) && (owner || assigned.has(key)) && (!permissions[key] || context.permissions.includes(permissions[key]));
  const [teamCount, customerCount, inquiryCount, projectCount, invoiceCount, accountCount, connectors] = await Promise.all([
    owner && context.permissions.includes("MEMBERSHIP_VIEW") ? prisma.organizationMembership.count({ where: { organizationId: context.organizationId, status: "ACTIVE" } }) : Promise.resolve(0),
    canRead("CRM") ? prisma.customer.count({ where: { organizationId: context.organizationId, deletedAt: null } }) : Promise.resolve(0),
    canRead("LEADS") ? prisma.inquiry.count({ where: { organizationId: context.organizationId, deletedAt: null } }) : Promise.resolve(0),
    canRead("PROJECTS") ? prisma.project.count({ where: { organizationId: context.organizationId, deletedAt: null } }) : Promise.resolve(0),
    canRead("FINANCE") ? prisma.invoice.count({ where: { organizationId: context.organizationId, deletedAt: null } }) : Promise.resolve(0),
    canRead("FINANCE") ? prisma.paymentAccount.count({ where: { organizationId: context.organizationId } }) : Promise.resolve(0),
    canRead("AUTOMATION") ? prisma.integrationConnector.findMany({ where: { organizationId: context.organizationId, deletedAt: null }, select: { type: true, provider: true, status: true, credentialsConfiguredAt: true }, take: 50 }) : Promise.resolve([]),
  ]);
  const counts: Partial<Record<RegisteredServiceKey, number>> = { CRM: customerCount, LEADS: inquiryCount, PROJECTS: projectCount, FINANCE: invoiceCount + accountCount };
  const automation = connectors.filter((item) => item.type !== "CUSTOM");
  const whatsapp = connectors.find((item) => item.type === "WHATSAPP" && item.provider === "META_WHATSAPP_CLOUD");
  const website = connectors.find((item) => item.type === "WEBSITE");
  const areas = (Object.keys(serviceMaturityRegistry) as RegisteredServiceKey[]).map((key): SetupArea => {
    const metadata = serviceMaturityRegistry[key], permission = permissions[key];
    let status: SetupStatus = !enabled.has(key) ? "UNAVAILABLE" : !owner && !assigned.has(key) ? "FORBIDDEN" : permission && !context.permissions.includes(permission) ? "FORBIDDEN" : metadata.maturity === "PLANNED" ? "PLANNED" : metadata.maturity !== "AVAILABLE" ? "BETA" : "READY";
    if (["CRM", "LEADS", "PROJECTS", "FINANCE"].includes(key) && status !== "UNAVAILABLE" && status !== "FORBIDDEN") status = counts[key] ? "READY" : "ACTION_REQUIRED";
    if (key === "AUTOMATION" && status !== "UNAVAILABLE" && status !== "FORBIDDEN") status = automation.length ? "PARTIALLY_CONFIGURED" : "NOT_CONFIGURED";
    if (key === "WEBSITES" && status !== "UNAVAILABLE" && status !== "FORBIDDEN") status = website ? "PARTIALLY_CONFIGURED" : "NOT_CONFIGURED";
    return { key, name: names[key] ?? key.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (value) => value.toUpperCase()), maturity: metadata.maturity, status, optional: metadata.maturity !== "AVAILABLE", why: metadata.availabilityNote, agentCan: status === "ACTION_REQUIRED" && key === "CRM" ? "Prepare the first customer for confirmation." : "Check verified readiness and explain the next step.", customerMust: status === "UNAVAILABLE" ? "Contact your SATHOS administrator." : status === "FORBIDDEN" ? "Ask an organization owner for access." : "Use the existing workspace setup screen.", href: links[key] ?? "/settings?section=services", externalAuthorization: false, credentialsAllowed: false };
  });
  const profileComplete = Boolean(organization?.name && organization.industry && organization.timezone && organization.currency);
  const focusWhatsapp = /whatsapp/i.test(lower), focusFinance = /finance|vitt|वित्त/i.test(lower), focusCrm = /crm|lead/i.test(lower);
  const prioritized = [
    { key: "business-profile", name: "Business profile", status: profileComplete ? "READY" : "ACTION_REQUIRED", why: "Accurate defaults keep reports and dates meaningful.", customerMust: profileComplete ? "Nothing right now." : "Complete your industry and business defaults.", href: "/settings?section=business" },
    { key: "team-access", name: "Team and Access", status: !owner || !context.permissions.includes("MEMBERSHIP_VIEW") ? "FORBIDDEN" : teamCount > 1 ? "READY" : "ACTION_REQUIRED", why: "Roles keep business access controlled.", customerMust: !owner || !context.permissions.includes("MEMBERSHIP_VIEW") ? "Ask an organization owner to review team access." : teamCount > 1 ? "Review access when roles change." : "Invite teammates from Team and Access.", href: "/settings?section=team" },
    ...areas.filter((area) => ["CRM", "LEADS", "FINANCE", "PROJECTS", "B2BRAIN_AGENT", "AUTOMATION"].includes(area.key)).map((area) => ({ key: area.key, name: area.name, status: area.status, optional: area.optional, why: area.why, customerMust: area.customerMust, href: area.href })),
  ];
  const selected = focusWhatsapp ? [{ key: "whatsapp", name: "WhatsApp Business", status: !enabled.has("AUTOMATION") || !enabled.has("LEADS") ? "UNAVAILABLE" : !canRead("AUTOMATION") || !canRead("LEADS") ? "FORBIDDEN" : !whatsapp ? "NOT_CONFIGURED" : whatsapp.status === "ACTIVE" && whatsapp.credentialsConfiguredAt ? "PARTIALLY_CONFIGURED" : whatsapp.status === "ERROR" ? "ACTION_REQUIRED" : "EXTERNAL_AUTHORIZATION_REQUIRED", optional: true, why: "WhatsApp setup currently supports Test Mode; real Embedded Signup is not available.", customerMust: "Open the existing WhatsApp Business Test Mode setup. Never paste credentials into chat.", href: "/automation?section=connections", testMode: true }] : focusFinance ? prioritized.filter((step) => step.key === "FINANCE") : focusCrm ? prioritized.filter((step) => step.key === "CRM" || step.key === "LEADS") : prioritized.filter((step) => step.status !== "READY");
  const steps = selected.slice(0, 5);
  return { answer: steps.length ? `I checked your permitted workspace. Let’s start with ${steps[0]!.name}. ${steps[0]!.why}` : "Your currently supported setup checks are ready. Optional integrations can be reviewed when needed.", counts: { complete: prioritized.filter((step) => step.status === "READY").length, actionRequired: prioritized.filter((step) => step.status === "ACTION_REQUIRED" || step.status === "NOT_CONFIGURED").length, externalAuthorization: prioritized.filter((step) => step.status === "EXTERNAL_AUTHORIZATION_REQUIRED").length, optional: areas.filter((area) => area.optional && area.status !== "UNAVAILABLE" && area.status !== "FORBIDDEN").length }, areas, steps, currentStep: steps[0] ?? null, mutationPerformed: false, externalCallPerformed: false };
}
