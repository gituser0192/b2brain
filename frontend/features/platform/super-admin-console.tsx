"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { SuperAdminCommerce } from "./super-admin-commerce";

interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  activeMemberCount: number;
  enabledServiceIds: string[];
  owner: { id: string; firstName: string; lastName: string | null; email: string; status: string; isPlatformAdmin: boolean } | null;
  plan: { id: string; planId: string; status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELED"; billingCycle: "MONTHLY" | "YEARLY"; amount: string; currency: string; nextBillingAt: string | null; startsAt: string; trialEndsAt: string | null; expiresAt: string | null; plan: { id: string; code: string; name: string; monthlyPrice: string; yearlyPrice: string; currency: string }; overrides: { serviceId: string; type: "ADD" | "REMOVE" }[]; payments: { id: string; amount: string; currency: string; status: string; paidAt: string; periodStartsAt: string; periodEndsAt: string; reference: string | null }[] } | null;
}
interface MaturityMetadata { maturity: "AVAILABLE" | "BETA" | "TEST_MODE" | "FOUNDATION_ONLY" | "PLANNED"; maturityLabel: string; availabilityNote: string; sellability: "GENERAL" | "BETA_ONLY" | "NOT_SELLABLE"; hasCustomerNavigation: boolean; }
interface PlatformService { id: string; code: string; name: string; description: string | null; status: string; enabledOrganizationCount: number; maturity: MaturityMetadata | null; }
interface ServicePlan { id: string; code: string; name: string; description: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; monthlyPrice: number; yearlyPrice: number; currency: string; serviceIds: string[]; organizationCount: number; }
interface PlatformInvitation { id: string; email: string; organizationName: string; status: string; expiresAt: string; createdAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION"; }
interface OverviewResponse { success: true; data: { organizations: PlatformOrganization[]; services: PlatformService[]; invitations: PlatformInvitation[]; plans: ServicePlan[] }; }
interface InviteResponse { success: true; data: { invitation: PlatformInvitation; signupPath: string; signupUrl: string; emailDelivered: boolean }; }
type OrganizationFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "TRIAL" | "ATTENTION";
type Confirmation = { kind: "revoke"; invitation: PlatformInvitation } | { kind: "suspend" | "reactivate" | "remove"; organization: PlatformOrganization };

const BILLING_WARNING_CUTOFF = Date.now() + 7 * 86400000;
const PAYMENT_PREVIEW_COUNT = 3;
const PLATFORM_SECTIONS = ["overview", "organizations", "plans", "services", "operations", "support", "agents", "audit", "settings"] as const;
type PlatformSection = (typeof PLATFORM_SECTIONS)[number];
const SECTION_LABELS: Record<PlatformSection, string> = {
  overview: "Overview", organizations: "Organizations", plans: "Plans and Billing", services: "Services",
  operations: "Operations", support: "Support", agents: "Platform Agents", audit: "Audit Log", settings: "Platform Settings",
};
const PLANNED_SECTIONS = {
  operations: {
    description: "A cross-organization Platform Admin operations queue is not available yet.",
    existing: "The existing Operations workspace belongs to service-provider organizations and requires provider permissions. It is not a Platform Admin queue.",
  },
  support: {
    description: "A centralized platform support inbox is not available yet.",
    existing: "Customer Help and Support requests and the SUPPORT ticket service remain organization-scoped and are not exposed here.",
  },
  agents: {
    description: "Platform-owned agent management is not available yet.",
    existing: "Organization Business Agents remain managed inside their customer workspaces. Their conversations and business data are not exposed here.",
  },
  audit: {
    description: "A centralized platform audit timeline is not available yet.",
    existing: "Existing audit records are organization-scoped and are not aggregated across customers in this workspace.",
  },
  settings: {
    description: "Safe Platform Admin settings are not available yet.",
    existing: "Infrastructure configuration remains deployment-owned. Environment variables, credentials, database access, and provider keys are never displayed here.",
  },
} satisfies Record<"operations" | "support" | "agents" | "audit" | "settings", { description: string; existing: string }>;

function PaymentHistory({ payments }: { payments: NonNullable<PlatformOrganization["plan"]>["payments"] }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePayments = expanded ? payments : payments.slice(0, PAYMENT_PREVIEW_COUNT);
  const hiddenCount = Math.max(0, payments.length - PAYMENT_PREVIEW_COUNT);
  return <div className="payment-history"><div className="payment-history-heading"><h4>Payment history</h4>{payments.length > 0 && <span>{payments.length} total</span>}</div>{payments.length === 0 ? <p>No subscription payments recorded.</p> : <>{visiblePayments.map((payment) => <article key={payment.id}><div><strong>{payment.currency} {Number(payment.amount).toLocaleString("en-IN")}</strong><span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.paidAt))}</span></div><small>{payment.reference || "Manual payment"} · access until {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.periodEndsAt))}</small></article>)}{hiddenCount > 0 && <button className="payment-history-toggle" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show less" : `See ${hiddenCount} more payment${hiddenCount === 1 ? "" : "s"}`}</button>}</>}</div>;
}

export function SuperAdminConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section") ?? "overview";
  const requestedOrganizationId = searchParams.get("organization");
  const showLegacyCommerce = false as boolean;
  const section: PlatformSection = PLATFORM_SECTIONS.includes(requestedSection as PlatformSection) ? requestedSection as PlatformSection : "overview";
  const { session, isLoading, authorizedRequest, logout } = useAuth();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [services, setServices] = useState<PlatformService[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", organizationName: "" });
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviting, setInviting] = useState(false);
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>("ALL");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planForm, setPlanForm] = useState({ code: "", name: "", description: "", status: "DRAFT" as "DRAFT" | "ACTIVE" | "ARCHIVED", monthlyPrice: 0, yearlyPrice: 0, currency: "INR", serviceIds: [] as string[] });
  const [assignment, setAssignment] = useState({ planId: "", status: "ACTIVE" as "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED", billingCycle: "MONTHLY" as "MONTHLY" | "YEARLY", startsAt: new Date().toISOString().slice(0, 16), trialEndsAt: "", expiresAt: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", paidAt: new Date().toISOString().slice(0, 16), reference: "", note: "" });

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const response = await authorizedRequest<OverviewResponse>("/platform/overview");
      setOrganizations(response.data.organizations);
      setServices(response.data.services);
      setInvitations(response.data.invitations);
      setPlans(response.data.plans);
      const nextSelectedId = selectedIdRef.current || response.data.organizations[0]?.id || "";
      const nextSelected = response.data.organizations.find((item) => item.id === nextSelectedId);
      setSelectedId(nextSelectedId);
      if (nextSelected?.plan) {
        setAssignment({ planId: nextSelected.plan.planId, status: nextSelected.plan.status === "EXPIRED" ? "CANCELED" : nextSelected.plan.status, billingCycle: nextSelected.plan.billingCycle, startsAt: nextSelected.plan.startsAt.slice(0, 16), trialEndsAt: nextSelected.plan.trialEndsAt?.slice(0, 16) ?? "", expiresAt: nextSelected.plan.expiresAt?.slice(0, 16) ?? "" });
        setPaymentForm((current) => ({ ...current, amount: Number(nextSelected.plan?.amount ?? 0).toString() }));
      } else {
        const defaultPlan = response.data.plans.find((plan) => plan.status === "ACTIVE");
        setAssignment({ planId: defaultPlan?.id ?? "", status: "ACTIVE", billingCycle: "MONTHLY", startsAt: new Date().toISOString().slice(0, 16), trialEndsAt: "", expiresAt: "" });
        setPaymentForm((current) => ({ ...current, amount: defaultPlan?.monthlyPrice.toString() ?? "" }));
      }
    } catch (reason) { setLoadFailed(true); setError(reason instanceof ApiError ? reason.message : "Unable to load the platform console."); }
    finally { setLoading(false); }
  }, [authorizedRequest, setAssignment, setInvitations, setLoadFailed, setLoading, setOrganizations, setPaymentForm, setPlans, setSelectedId, setServices]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (!isLoading && session && !session.user.isPlatformAdmin) router.replace("/dashboard");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session?.user.isPlatformAdmin) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [session, load]);
  useEffect(() => {
    if (requestedSection !== section) router.replace("/super-admin?section=overview");
  }, [requestedSection, router, section]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const selected = useMemo(() => organizations.find((item) => item.id === (section === "organizations" ? requestedOrganizationId : requestedOrganizationId ?? selectedId)), [organizations, requestedOrganizationId, section, selectedId]);
  const billingAttention = useMemo(() => {
    return organizations.filter((organization) => organization.plan && (["PAST_DUE", "EXPIRED"].includes(organization.plan.status) || (["ACTIVE", "TRIAL"].includes(organization.plan.status) && Boolean(organization.plan.expiresAt && new Date(organization.plan.expiresAt).getTime() <= BILLING_WARNING_CUTOFF))));
  }, [organizations]);
  const maturitySummary = useMemo(() => ({
    available: services.filter((service) => service.maturity?.maturity === "AVAILABLE").length,
    beta: services.filter((service) => service.maturity?.maturity === "BETA").length,
  }), [services]);
  const selectedMaturitySummary = useMemo(() => {
    const assigned = new Set(selected?.enabledServiceIds ?? []);
    return {
      available: services.filter((service) => assigned.has(service.id) && service.maturity?.maturity === "AVAILABLE").length,
      beta: services.filter((service) => assigned.has(service.id) && service.maturity?.maturity === "BETA").length,
    };
  }, [selected, services]);
  const pendingInvitations = useMemo(() => invitations.filter((item) => item.status === "PENDING"), [invitations]);
  const activeOrganizations = useMemo(() => organizations.filter((item) => item.status === "ACTIVE"), [organizations]);
  const activeSubscriptions = useMemo(() => organizations.filter((item) => item.plan?.status === "ACTIVE"), [organizations]);
  const suspendedOrganizations = useMemo(() => organizations.filter((item) => item.status === "SUSPENDED"), [organizations]);
  const attention = pendingInvitations.length > 0
    ? { title: "Review pending invitations", detail: `${pendingInvitations.length} owner invitation${pendingInvitations.length === 1 ? " is" : "s are"} waiting.`, href: "/super-admin?section=organizations" }
    : billingAttention.length > 0
      ? { title: "Review billing alerts", detail: `${billingAttention.length} subscription${billingAttention.length === 1 ? " needs" : "s need"} attention.`, href: "/super-admin?section=plans" }
      : suspendedOrganizations.length > 0
        ? { title: "Review suspended organizations", detail: `${suspendedOrganizations.length} organization${suspendedOrganizations.length === 1 ? " is" : "s are"} suspended.`, href: "/super-admin?section=organizations" }
        : { title: "Review organizations", detail: "No urgent platform item is currently identified.", href: "/super-admin?section=organizations" };
  const organizationNotFound = section === "organizations" && Boolean(requestedOrganizationId) && !selected;
  const filteredOrganizations = useMemo(() => {
    const query = organizationSearch.trim().toLowerCase();
    return organizations.filter((organization) => {
      const matchesSearch = !query || [organization.name, organization.owner?.firstName, organization.owner?.lastName, organization.owner?.email].some((value) => value?.toLowerCase().includes(query));
      const needsAttention = Boolean(organization.plan && ["PAST_DUE", "EXPIRED"].includes(organization.plan.status));
      const matchesFilter = organizationFilter === "ALL"
        || (organizationFilter === "ACTIVE" && organization.status === "ACTIVE")
        || (organizationFilter === "SUSPENDED" && organization.status === "SUSPENDED")
        || (organizationFilter === "TRIAL" && organization.plan?.status === "TRIAL")
        || (organizationFilter === "ATTENTION" && needsAttention);
      return matchesSearch && matchesFilter;
    });
  }, [organizationFilter, organizationSearch, organizations]);
  async function toggle(serviceId: string, enabled: boolean) {
    if (!selected) return;
    setUpdatingId(serviceId); setError("");
    try {
      await authorizedRequest(`/platform/organizations/${selected.id}/services/${serviceId}`, { method: "PUT", body: JSON.stringify({ enabled }) });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update service access."); }
    finally { setUpdatingId(""); }
  }
  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviting) return;
    setInviting(true); setError(""); setInviteSuccess("");
    try {
      const response = await authorizedRequest<InviteResponse>("/platform/invitations", { method: "POST", body: JSON.stringify(inviteForm) });
      setInviteSuccess(response.data.emailDelivered ? "Invitation created and email delivery was accepted." : "Invitation created. Email delivery is not confirmed; review the pending invitation below.");
      setInviteForm({ email: "", organizationName: "" });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to create invitation."); }
    finally { setInviting(false); }
  }
  async function revokeInvitation(id: string) {
    setError("");
    try { await authorizedRequest(`/platform/invitations/${id}`, { method: "DELETE" }); await load(); return true; }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to revoke invitation."); return false; }
  }
  async function setAccess(status: "ACTIVE" | "SUSPENDED") {
    if (!selected) return false;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}/access`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); return true; }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update account access."); return false; }
  }
  async function removeAccount() {
    if (!selected) return false;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}`, { method: "DELETE" }); setSelectedId(""); router.replace("/super-admin?section=organizations"); await load(); return true; }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to remove organization account."); return false; }
  }
  async function confirmAction() {
    if (!confirmation || actionPending) return;
    setActionPending(true);
    try {
      const succeeded = confirmation.kind === "revoke"
        ? await revokeInvitation(confirmation.invitation.id)
        : confirmation.kind === "remove"
          ? await removeAccount()
          : await setAccess(confirmation.kind === "suspend" ? "SUSPENDED" : "ACTIVE");
      if (succeeded) closeConfirmation();
    } finally { setActionPending(false); }
  }
  function openConfirmation(next: Confirmation, trigger: HTMLButtonElement) {
    confirmationTriggerRef.current = trigger;
    setConfirmation(next);
  }
  function closeConfirmation() {
    setConfirmation(null);
    window.setTimeout(() => confirmationTriggerRef.current?.focus(), 0);
  }
  function editPlan(plan?: ServicePlan) {
    setEditingPlanId(plan?.id ?? "");
    setPlanForm(plan ? { code: plan.code, name: plan.name, description: plan.description ?? "", status: plan.status, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, currency: plan.currency, serviceIds: plan.serviceIds } : { code: "", name: "", description: "", status: "DRAFT", monthlyPrice: 0, yearlyPrice: 0, currency: "INR", serviceIds: [] });
    setShowPlanEditor(true);
  }
  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      await authorizedRequest(editingPlanId ? `/platform/plans/${editingPlanId}` : "/platform/plans", { method: editingPlanId ? "PUT" : "POST", body: JSON.stringify({ ...planForm, description: planForm.description || null }) });
      setShowPlanEditor(false); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save service plan."); }
  }
  async function assignPlan() {
    if (!selected || !assignment.planId) return;
    setError("");
    try {
      await authorizedRequest(`/platform/organizations/${selected.id}/plan`, { method: "PUT", body: JSON.stringify({ planId: assignment.planId, status: assignment.status, billingCycle: assignment.billingCycle, startsAt: new Date(assignment.startsAt).toISOString(), trialEndsAt: assignment.trialEndsAt ? new Date(assignment.trialEndsAt).toISOString() : null, expiresAt: assignment.expiresAt ? new Date(assignment.expiresAt).toISOString() : null, additionalServiceIds: selected.plan?.overrides.filter((item) => item.type === "ADD").map((item) => item.serviceId) ?? [], removedServiceIds: selected.plan?.overrides.filter((item) => item.type === "REMOVE").map((item) => item.serviceId) ?? [] }) });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to assign service plan."); }
  }
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.plan) return;
    setError("");
    try {
      await authorizedRequest(`/platform/organizations/${selected.id}/subscription-payments`, { method: "POST", body: JSON.stringify({ amount: Number(paymentForm.amount), paidAt: new Date(paymentForm.paidAt).toISOString(), reference: paymentForm.reference || null, note: paymentForm.note || null }) });
      setPaymentForm((current) => ({ ...current, reference: "", note: "" }));
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to record subscription payment."); }
  }

  if (isLoading || loading || !session?.user.isPlatformAdmin) return <main className="screen-loader"><span className="spinner dark" /><p>Opening secure platform console…</p></main>;

  return <div className="platform-shell">
    <aside className="platform-sidebar">
      <div className="dashboard-logo"><Image src="/brand/b2brain-logo.png" alt="" width={38} height={38} /><span><strong>B² Brain</strong><small>Super Admin</small></span></div>
      <div className="platform-identity"><span>Platform control</span><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.user.email}</small></div>
      <nav aria-label="Platform administration">{PLATFORM_SECTIONS.map((item) => <Link key={item} href={item === "overview" ? "/super-admin" : `/super-admin?section=${item}`} className={section === item ? "active" : ""} aria-current={section === item ? "page" : undefined}><span aria-hidden="true">{SECTION_LABELS[item].slice(0, 1)}</span>{SECTION_LABELS[item]}{item in PLANNED_SECTIONS && <small>Planned</small>}</Link>)}</nav>
      <div className="platform-sidebar-actions"><button onClick={() => router.push("/dashboard")}>Organization workspace</button><button onClick={() => void logout().then(() => router.replace("/login"))}>Sign out</button></div>
    </aside>
    <main className={`platform-main platform-section-${section}`}>
      <header><div><p>Restricted platform administration</p><h1>{SECTION_LABELS[section]}</h1><span>Manage verified platform access, subscriptions and service availability.</span></div>{section === "overview" && <div className="platform-stats"><span><strong>{organizations.length}</strong> organizations</span><span><strong>{pendingInvitations.length}</strong> pending invitations</span><span><strong>{billingAttention.length}</strong> billing alerts</span><span><strong>{maturitySummary.available}</strong> Available · {maturitySummary.beta} Beta</span></div>}</header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {section === "overview" && !loadFailed && <section className="platform-overview" aria-label="Platform overview">
        <div className="platform-overview-metrics"><article><span>Active organizations</span><strong>{activeOrganizations.length}</strong></article><article><span>Active subscriptions</span><strong>{activeSubscriptions.length}</strong></article><article><span>Pending invitations</span><strong>{pendingInvitations.length}</strong></article><article><span>Billing alerts</span><strong>{billingAttention.length}</strong></article></div>
        <article className="platform-attention"><p>Recommended next action</p><h2>{attention.title}</h2><span>{attention.detail}</span><Link href={attention.href}>Review now</Link></article>
        <div className="platform-preview-grid"><section><div className="panel-title"><div><p>Recent customers</p><h2>Organizations</h2></div><Link href="/super-admin?section=organizations">View organizations</Link></div>{organizations.slice(0, 5).map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.status.replaceAll("_", " ").toLowerCase()}</span></article>)}{organizations.length === 0 && <p>No organizations registered.</p>}</section><section><div className="panel-title"><div><p>Owner access</p><h2>Pending invitations</h2></div><Link href="/super-admin?section=organizations">Review invitations</Link></div>{pendingInvitations.slice(0, 5).map((item) => <article key={item.id}><strong>{item.organizationName}</strong><span>{item.email}</span></article>)}{pendingInvitations.length === 0 && <p>No pending invitations.</p>}</section><section><div className="panel-title"><div><p>Subscriptions</p><h2>Needs attention</h2></div><Link href="/super-admin?section=plans">Manage plans</Link></div>{billingAttention.slice(0, 5).map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.plan?.status.replaceAll("_", " ").toLowerCase()}</span></article>)}{billingAttention.length === 0 && <p>No billing alerts.</p>}</section><section><div className="panel-title"><div><p>Service maturity</p><h2>Availability</h2></div><Link href="/super-admin?section=services">Review services</Link></div><article><strong>{maturitySummary.available} Available</strong><span>{maturitySummary.beta} Beta services</span></article><Link href="/super-admin?section=operations">Open operations</Link></section></div>
      </section>}
      {section === "organizations" && !loadFailed && <section className={`platform-organizations ${selected || organizationNotFound ? "show-detail" : ""}`}>
        <div className="organization-directory-panel">
          <div className="panel-title"><div><p>Customer accounts</p><h2>Organization directory</h2></div><span>{filteredOrganizations.length} shown</span></div>
          <div className="organization-tools">
            <label><span>Search organizations</span><input type="search" value={organizationSearch} onChange={(event) => setOrganizationSearch(event.target.value)} placeholder="Name or owner" /></label>
            <label><span>Filter</span><select value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value as OrganizationFilter)}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="TRIAL">Trial</option><option value="ATTENTION">Needs attention</option></select></label>
          </div>
          <div className="organization-directory" role="list">{organizations.length === 0 ? <div className="platform-empty">No organizations registered.</div> : filteredOrganizations.length === 0 ? <div className="platform-empty">No organizations match this search or filter.</div> : filteredOrganizations.map((organization) => <Link role="listitem" key={organization.id} href={`/super-admin?section=organizations&organization=${encodeURIComponent(organization.id)}`} className={selected?.id === organization.id ? "active" : ""} aria-current={selected?.id === organization.id ? "true" : undefined}><span aria-hidden="true">{organization.name.slice(0, 2).toUpperCase()}</span><div><strong>{organization.name}</strong><small>{organization.owner?.email ?? "Owner unavailable"}</small><small>{organization.plan?.plan.name ?? "No plan"} · {organization.enabledServiceIds.length} services</small></div><em className={`account-status ${organization.status.toLowerCase()}`}>{organization.status.replaceAll("_", " ")}</em></Link>)}</div>
          <section className="platform-invitations">
            <form onSubmit={createInvitation}><div><p>Controlled onboarding</p><h2>Invite organization owner</h2><span>Only the invited email can use the link. The invitation does not activate an organization until accepted.</span></div><label><span>Organization name</span><input value={inviteForm.organizationName} onChange={(event) => setInviteForm({ ...inviteForm, organizationName: event.target.value })} placeholder="Company name" required maxLength={120} /></label><label><span>Owner email</span><input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="owner@company.com" required /></label><button disabled={inviting}>{inviting ? "Creating invitation…" : "Invite organization owner"}</button></form>
            {inviteSuccess && <div className="invite-link-result" role="status"><strong>Invitation created</strong><span>{inviteSuccess}</span></div>}
            <div className="pending-platform-invites"><div className="panel-title"><div><p>Owner access</p><h3>Pending invitations</h3></div><span>{pendingInvitations.length}</span></div>{pendingInvitations.length === 0 ? <p>No pending invitations.</p> : pendingInvitations.slice(0, 10).map((invitation) => <article key={invitation.id}><div><strong>{invitation.organizationName}</strong><span>{invitation.email} · {invitation.type === "REACTIVATE_ORGANIZATION" ? "Reactivation" : "New organization"}</span></div><small>Pending · expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small><button type="button" onClick={(event) => openConfirmation({ kind: "revoke", invitation }, event.currentTarget)}>Revoke</button></article>)}</div>
          </section>
        </div>
        <div className="organization-detail" aria-live="polite">
          {organizationNotFound ? <div className="platform-empty"><h2>Organization not found</h2><p>The selected organization is unavailable or no longer accessible.</p><Link href="/super-admin?section=organizations">Back to organizations</Link></div> : !selected ? <div className="platform-empty"><h2>Select an organization</h2><p>Choose a customer account to review access without changing your own organization membership.</p></div> : <>
            <Link className="organization-mobile-back" href="/super-admin?section=organizations">← Back to organizations</Link>
            <header><div><p>Administrative target</p><h2>{selected.name}</h2><span>Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(selected.createdAt))}</span></div><span className={`account-status ${selected.status.toLowerCase()}`}>{selected.status.replaceAll("_", " ")}</span></header>
            <div className="organization-detail-grid"><article><span>Owner</span><strong>{selected.owner ? `${selected.owner.firstName} ${selected.owner.lastName ?? ""}`.trim() : "Unavailable"}</strong><small>{selected.owner?.email ?? "No owner returned"}</small></article><article><span>Subscription</span><strong>{selected.plan?.plan.name ?? "No assigned plan"}</strong><small>{selected.plan?.status.replaceAll("_", " ") ?? "Manual access only"}</small></article><article><span>Enabled services</span><strong>{selected.enabledServiceIds.length}</strong><small>{selectedMaturitySummary.available} Available · {selectedMaturitySummary.beta} Beta</small></article><article><span>Active members</span><strong>{selected.activeMemberCount}</strong><small>Verified workspace memberships</small></article></div>
            <div className="organization-related-links"><Link href={`/super-admin?section=plans&organization=${encodeURIComponent(selected.id)}`}>Plans and Billing</Link><Link href={`/super-admin?section=services&organization=${encodeURIComponent(selected.id)}`}>Services</Link></div>
            <section className="organization-access-actions"><div><p>Account access</p><h3>Login and workspace access</h3><span>Suspension blocks access without deleting business data. Restoring access does not change plans or services.</span></div>{selected.owner?.isPlatformAdmin ? <p>Protected Super Admin organization</p> : <div>{selected.status === "ACTIVE" ? <button type="button" onClick={(event) => openConfirmation({ kind: "suspend", organization: selected }, event.currentTarget)}>Suspend access</button> : <button type="button" onClick={(event) => openConfirmation({ kind: "reactivate", organization: selected }, event.currentTarget)}>Restore access</button>}<button type="button" className="remove" onClick={(event) => openConfirmation({ kind: "remove", organization: selected }, event.currentTarget)}>Remove account</button></div>}</section>
          </>}
        </div>
      </section>}
      {showLegacyCommerce && section === "plans" && !loadFailed && <section className="platform-plans">
        <div className="panel-title"><div><p>Commercial packaging</p><h3>Service plans</h3></div><button onClick={() => editPlan()}>+ New plan</button></div>
        {plans.length === 0 ? <div className="platform-empty">No service plans created.</div> : <div className="plan-grid">{plans.map((plan) => <article key={plan.id}><header><span>{plan.code}</span><i className={`account-status ${plan.status.toLowerCase()}`}>{plan.status}</i></header><h3>{plan.name}</h3><p>{plan.description ?? "No description provided."}</p><div className="plan-pricing"><strong>{plan.currency} {plan.monthlyPrice.toLocaleString("en-IN")}</strong><span>/ month</span><small>{plan.currency} {plan.yearlyPrice.toLocaleString("en-IN")} yearly</small></div><footer><span>{plan.serviceIds.length} services · {plan.organizationCount} organizations</span><button onClick={() => editPlan(plan)}>Edit</button></footer></article>)}</div>}
        {showPlanEditor && <form className="plan-editor" onSubmit={savePlan}><header><div><p>Plan definition</p><h3>{editingPlanId ? "Edit service plan" : "Create service plan"}</h3></div><button type="button" onClick={() => setShowPlanEditor(false)}>×</button></header><div className="plan-fields"><label><span>Code</span><input value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} required /></label><label><span>Name</span><input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required /></label><label><span>Status</span><select value={planForm.status} onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as typeof planForm.status })}><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label><label><span>Monthly price</span><input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(event) => setPlanForm({ ...planForm, monthlyPrice: Number(event.target.value) })} required /></label><label><span>Yearly price</span><input type="number" min="0" step="0.01" value={planForm.yearlyPrice} onChange={(event) => setPlanForm({ ...planForm, yearlyPrice: Number(event.target.value) })} required /></label><label><span>Currency</span><input value={planForm.currency} maxLength={3} onChange={(event) => setPlanForm({ ...planForm, currency: event.target.value.toUpperCase() })} required /></label></div><label><span>Description</span><textarea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} rows={2} /></label><p className="maturity-explanation">Beta services are assignable only for approved testing. Internal foundation and Planned services cannot be assigned here.</p><div className="plan-service-picker">{services.filter((service) => service.status === "ACTIVE").map((service) => { const blocked = service.maturity?.sellability === "NOT_SELLABLE"; return <label key={service.id}><input type="checkbox" checked={planForm.serviceIds.includes(service.id)} disabled={blocked} aria-describedby={`plan-maturity-${service.id}`} onChange={(event) => setPlanForm({ ...planForm, serviceIds: event.target.checked ? [...planForm.serviceIds, service.id] : planForm.serviceIds.filter((id) => id !== service.id) })} /><span><strong>{service.name}</strong><small>{service.code} · {service.maturity?.maturityLabel ?? "Maturity unregistered"}</small><small id={`plan-maturity-${service.id}`}>{service.maturity?.availabilityNote}</small></span></label>; })}</div><footer><button type="button" onClick={() => setShowPlanEditor(false)}>Cancel</button><button>Save plan</button></footer></form>}
      </section>}
      {!loadFailed && (section === "plans" || section === "services") && <SuperAdminCommerce key={`${section}:${requestedOrganizationId ?? "catalogue"}`} section={section} organizations={organizations} services={services} plans={plans} organizationId={requestedOrganizationId} request={authorizedRequest} refresh={load} />}
      {showLegacyCommerce && !loadFailed && ["plans", "services"].includes(section) && <section className={`platform-grid platform-grid-${section}`}>
        <div className="organization-directory"><div className="panel-title"><div><p>Tenants</p><h3>Organizations</h3></div></div>{organizations.length === 0 ? <div className="platform-empty">No organizations registered.</div> : organizations.map((organization) => <button key={organization.id} className={selectedId === organization.id ? "active" : ""} onClick={() => setSelectedId(organization.id)}><span>{organization.name.slice(0, 2).toUpperCase()}</span><div><strong>{organization.name}</strong><small>{organization.owner?.email ?? "Owner unavailable"}</small></div><em className={`account-status ${organization.status.toLowerCase()}`}>{organization.status.replaceAll("_", " ")}</em></button>)}</div>
        <div className="service-assignment"><div className="panel-title"><div><p>Account & entitlements</p><h3>{selected ? selected.name : "Select an organization"}</h3></div>{selected && <span>{selected.enabledServiceIds.length} enabled · {selectedMaturitySummary.available} Available · {selectedMaturitySummary.beta} Beta</span>}</div>
          {selected && <div className="organization-access-bar"><div><span>Owner</span><strong>{selected.owner ? `${selected.owner.firstName} ${selected.owner.lastName ?? ""}` : "Unavailable"}</strong><small>{selected.owner?.email}</small></div><div><span>Login status</span><strong>{selected.status.replaceAll("_", " ")}</strong>{selected.owner?.isPlatformAdmin && <small>Protected Super Admin organization</small>}</div><div className="access-actions">{selected.status !== "ACTIVE" && <button className="approve" onClick={() => void setAccess("ACTIVE")}>{selected.status === "PENDING_APPROVAL" ? "Approve login" : "Restore access"}</button>}{selected.status === "ACTIVE" && !selected.owner?.isPlatformAdmin && <button onClick={() => void setAccess("SUSPENDED")}>Suspend</button>}{!selected.owner?.isPlatformAdmin && <button className="remove" onClick={() => void removeAccount()}>Remove account</button>}</div></div>}
          {selected && <section className="organization-plan-assignment"><header><div><span>Assigned plan</span><strong>{selected.plan?.plan.name ?? "Manual services"}</strong></div>{selected.plan && <i className={`account-status ${selected.plan.status.toLowerCase()}`}>{selected.plan.status.replaceAll("_", " ")}</i>}</header>{selected.plan && <div className="subscription-summary"><span><small>Current charge</small><strong>{selected.plan.currency} {Number(selected.plan.amount).toLocaleString("en-IN")} / {selected.plan.billingCycle === "YEARLY" ? "year" : "month"}</strong></span><span><small>Next billing</small><strong>{selected.plan.nextBillingAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(selected.plan.nextBillingAt)) : "Not scheduled"}</strong></span><span><small>Access ends</small><strong>{selected.plan.expiresAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(selected.plan.expiresAt)) : "No expiry"}</strong></span></div>}<div><label><span>Plan</span><select value={assignment.planId} onChange={(event) => { const planId = event.target.value; const plan = plans.find((item) => item.id === planId); setAssignment({ ...assignment, planId }); if (plan) setPaymentForm((current) => ({ ...current, amount: (assignment.billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice).toString() })); }}><option value="">Select a plan</option>{plans.filter((plan) => plan.status === "ACTIVE").map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label><span>Billing cycle</span><select value={assignment.billingCycle} onChange={(event) => { const billingCycle = event.target.value as typeof assignment.billingCycle; const plan = plans.find((item) => item.id === assignment.planId); setAssignment({ ...assignment, billingCycle }); if (plan) setPaymentForm((current) => ({ ...current, amount: (billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice).toString() })); }}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><label><span>Access type</span><select value={assignment.status} onChange={(event) => setAssignment({ ...assignment, status: event.target.value as typeof assignment.status })}><option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="PAST_DUE">Past due</option><option value="CANCELED">Canceled</option></select></label><label><span>Starts</span><input type="datetime-local" value={assignment.startsAt} onChange={(event) => setAssignment({ ...assignment, startsAt: event.target.value })} /></label><label><span>Trial ends</span><input type="datetime-local" value={assignment.trialEndsAt} onChange={(event) => setAssignment({ ...assignment, trialEndsAt: event.target.value })} /></label><label><span>Expires</span><input type="datetime-local" value={assignment.expiresAt} onChange={(event) => setAssignment({ ...assignment, expiresAt: event.target.value })} /></label><button disabled={!assignment.planId || selected.status !== "ACTIVE"} onClick={() => void assignPlan()}>Apply plan</button></div><p>Expired, past-due, and canceled subscriptions lose service access without deleting business data.</p>{selected.plan && <div className="billing-console"><form onSubmit={recordPayment}><h4>Record payment & renew</h4><label><span>Amount ({selected.plan.currency})</span><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label><label><span>Paid at</span><input type="datetime-local" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} required /></label><label><span>Reference</span><input value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} placeholder="UPI / bank reference" /></label><label><span>Note</span><input value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} placeholder="Optional internal note" /></label><button>Record & renew</button></form><PaymentHistory key={selected.plan.id} payments={selected.plan.payments} /></div>}</section>}
          {!selected ? <div className="platform-empty">Choose an organization to manage access.</div> : services.length === 0 ? <div className="service-empty"><div className="service-empty-icon"><span /><span /><span /></div><h3>No platform services registered</h3><p>Build a real module first. It can then be registered and assigned here—never through customer signup.</p></div> : <div className="assignment-list">{services.map((service) => { const enabled = selected.enabledServiceIds.includes(service.id); const blocked = service.maturity?.sellability === "NOT_SELLABLE"; return <article key={service.id}><div><span>{service.code}</span><h3>{service.name}</h3>{service.maturity && <span className={`maturity-badge ${service.maturity.maturity.toLowerCase()}`}>{service.maturity.maturityLabel}</span>}<p>{service.maturity?.availabilityNote ?? service.description ?? "No description provided."}</p>{service.maturity?.maturity === "BETA" && <p className="maturity-warning">Beta access is intended for approved testing.</p>}</div><label className="access-switch"><input type="checkbox" checked={enabled} disabled={blocked || updatingId === service.id || service.status !== "ACTIVE" || selected.status !== "ACTIVE"} aria-describedby={`assignment-maturity-${service.id}`} onChange={(event) => void toggle(service.id, event.target.checked)} /><span /><small id={`assignment-maturity-${service.id}`}>{blocked ? "Not assignable" : selected.status !== "ACTIVE" ? "Approve first" : service.status === "ACTIVE" ? enabled ? "Enabled" : "Disabled" : service.status}</small></label></article>; })}</div>}
        </div>
      </section>}
      {section in PLANNED_SECTIONS && (() => {
        const planned = PLANNED_SECTIONS[section as keyof typeof PLANNED_SECTIONS];
        return <section className="platform-planned platform-planned-detail" aria-labelledby="platform-planned-title">
          <span className="platform-planned-badge">Planned</span>
          <p>Platform capability</p>
          <h2 id="platform-planned-title">{SECTION_LABELS[section]}</h2>
          <strong>Not available yet</strong>
          <span>{planned.description}</span>
          <div><small>What exists today</small><p>{planned.existing}</p></div>
        </section>;
      })()}
      {confirmation && <div className="platform-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionPending) closeConfirmation(); }}><section className="platform-confirmation" role="dialog" aria-modal="true" aria-labelledby="platform-confirmation-title" aria-describedby="platform-confirmation-description" onKeyDown={(event) => { if (event.key === "Escape" && !actionPending) closeConfirmation(); if (event.key === "Tab") { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")); const next = event.shiftKey ? buttons.at(-1) : buttons[0]; if ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons.at(-1))) { event.preventDefault(); next?.focus(); } } }}><p>Confirm platform action</p><h2 id="platform-confirmation-title">{confirmation.kind === "revoke" ? "Revoke owner invitation?" : confirmation.kind === "suspend" ? `Suspend ${confirmation.organization.name}?` : confirmation.kind === "reactivate" ? `Restore ${confirmation.organization.name}?` : `Remove ${confirmation.organization.name}?`}</h2><span id="platform-confirmation-description">{confirmation.kind === "revoke" ? `The pending invitation for ${confirmation.invitation.email} will no longer be usable.` : confirmation.kind === "suspend" ? "Login sessions and workspace access will be blocked. Business data is retained." : confirmation.kind === "reactivate" ? "Workspace access will be restored. Existing plans and services are not changed." : "The existing backend disables memberships and service access, then archives this organization account. Business records are not presented as permanently deleted."}</span><footer><button type="button" autoFocus disabled={actionPending} onClick={closeConfirmation}>Cancel</button><button type="button" className={confirmation.kind === "remove" ? "remove" : ""} disabled={actionPending} onClick={() => void confirmAction()}>{actionPending ? "Working…" : confirmation.kind === "revoke" ? "Revoke invitation" : confirmation.kind === "suspend" ? "Suspend access" : confirmation.kind === "reactivate" ? "Restore access" : "Remove account"}</button></footer></section></div>}
    </main>
  </div>;
}
