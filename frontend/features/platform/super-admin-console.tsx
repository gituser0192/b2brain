"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

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
interface PlatformService { id: string; code: string; name: string; description: string | null; status: string; enabledOrganizationCount: number; }
interface ServicePlan { id: string; code: string; name: string; description: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; monthlyPrice: number; yearlyPrice: number; currency: string; serviceIds: string[]; organizationCount: number; }
interface PlatformInvitation { id: string; email: string; organizationName: string; status: string; expiresAt: string; createdAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION"; }
interface OverviewResponse { success: true; data: { organizations: PlatformOrganization[]; services: PlatformService[]; invitations: PlatformInvitation[]; plans: ServicePlan[] }; }
interface InviteResponse { success: true; data: { invitation: PlatformInvitation; signupPath: string; emailDelivered: boolean }; }

const BILLING_WARNING_CUTOFF = Date.now() + 7 * 86400000;
const PAYMENT_PREVIEW_COUNT = 3;

function PaymentHistory({ payments }: { payments: NonNullable<PlatformOrganization["plan"]>["payments"] }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePayments = expanded ? payments : payments.slice(0, PAYMENT_PREVIEW_COUNT);
  const hiddenCount = Math.max(0, payments.length - PAYMENT_PREVIEW_COUNT);
  return <div className="payment-history"><div className="payment-history-heading"><h4>Payment history</h4>{payments.length > 0 && <span>{payments.length} total</span>}</div>{payments.length === 0 ? <p>No subscription payments recorded.</p> : <>{visiblePayments.map((payment) => <article key={payment.id}><div><strong>{payment.currency} {Number(payment.amount).toLocaleString("en-IN")}</strong><span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.paidAt))}</span></div><small>{payment.reference || "Manual payment"} · access until {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.periodEndsAt))}</small></article>)}{hiddenCount > 0 && <button className="payment-history-toggle" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show less" : `See ${hiddenCount} more payment${hiddenCount === 1 ? "" : "s"}`}</button>}</>}</div>;
}

export function SuperAdminConsole() {
  const router = useRouter();
  const { session, isLoading, authorizedRequest, logout } = useAuth();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [services, setServices] = useState<PlatformService[]>([]);
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", organizationName: "" });
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planForm, setPlanForm] = useState({ code: "", name: "", description: "", status: "DRAFT" as "DRAFT" | "ACTIVE" | "ARCHIVED", monthlyPrice: 0, yearlyPrice: 0, currency: "INR", serviceIds: [] as string[] });
  const [assignment, setAssignment] = useState({ planId: "", status: "ACTIVE" as "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED", billingCycle: "MONTHLY" as "MONTHLY" | "YEARLY", startsAt: new Date().toISOString().slice(0, 16), trialEndsAt: "", expiresAt: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", paidAt: new Date().toISOString().slice(0, 16), reference: "", note: "" });

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<OverviewResponse>("/platform/overview");
      setOrganizations(response.data.organizations);
      setServices(response.data.services);
      setInvitations(response.data.invitations);
      setPlans(response.data.plans);
      const nextSelectedId = selectedId || response.data.organizations[0]?.id || "";
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
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load the platform console."); }
    finally { setLoading(false); }
  }, [authorizedRequest, selectedId]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
    else if (!isLoading && session && !session.user.isPlatformAdmin) router.replace("/dashboard");
  }, [isLoading, session, router]);
  useEffect(() => {
    if (!session?.user.isPlatformAdmin) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [session, load]);

  const selected = useMemo(() => organizations.find((item) => item.id === selectedId), [organizations, selectedId]);
  const billingAttention = useMemo(() => {
    return organizations.filter((organization) => organization.plan && (["PAST_DUE", "EXPIRED"].includes(organization.plan.status) || (["ACTIVE", "TRIAL"].includes(organization.plan.status) && Boolean(organization.plan.expiresAt && new Date(organization.plan.expiresAt).getTime() <= BILLING_WARNING_CUTOFF))));
  }, [organizations]);
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
    event.preventDefault(); setInviting(true); setError(""); setInviteLink("");
    try {
      const response = await authorizedRequest<InviteResponse>("/platform/invitations", { method: "POST", body: JSON.stringify(inviteForm) });
      setInviteLink(`${window.location.origin}${response.data.signupPath}`);
      setInviteForm({ email: "", organizationName: "" });
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to create invitation."); }
    finally { setInviting(false); }
  }
  async function revokeInvitation(id: string) {
    setError("");
    try { await authorizedRequest(`/platform/invitations/${id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to revoke invitation."); }
  }
  async function setAccess(status: "ACTIVE" | "SUSPENDED") {
    if (!selected) return;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}/access`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update account access."); }
  }
  async function removeAccount() {
    if (!selected || !window.confirm(`Remove ${selected.name}? Login sessions and service access will be disabled.`)) return;
    setError("");
    try { await authorizedRequest(`/platform/organizations/${selected.id}`, { method: "DELETE" }); setSelectedId(""); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to remove organization account."); }
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
      <nav><button className="active"><span>O</span>Organizations</button><button onClick={() => router.push("/operations")}><span>W</span>Operations</button><button disabled><span>A</span>AI Agents <small>Soon</small></button><button disabled><span>H</span>Audit log <small>Soon</small></button></nav>
      <div className="platform-sidebar-actions"><button onClick={() => router.push("/dashboard")}>Organization workspace</button><button onClick={() => void logout().then(() => router.replace("/login"))}>Sign out</button></div>
    </aside>
    <main className="platform-main">
      <header><div><p>Restricted platform administration</p><h1>Organization access</h1><span>Assign only completed, active modules to customer organizations.</span></div><div className="platform-stats"><span><strong>{organizations.length}</strong> organizations</span><span><strong>{services.length}</strong> services</span><span><strong>{billingAttention.length}</strong> billing alerts</span></div></header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {billingAttention.length > 0 && <section className="billing-alerts"><strong>Billing needs attention</strong><span>{billingAttention.map((organization) => `${organization.name}: ${organization.plan?.status === "ACTIVE" ? "expires soon" : organization.plan?.status.replaceAll("_", " ").toLowerCase()}`).join(" · ")}</span></section>}
      <section className="platform-invitations">
        <form onSubmit={createInvitation}><div><p>Controlled onboarding</p><h2>Invite an organization owner</h2><span>Only this approved email can use the one-time registration link.</span></div><label><span>Organization</span><input value={inviteForm.organizationName} onChange={(event) => setInviteForm({ ...inviteForm, organizationName: event.target.value })} placeholder="Company name" required maxLength={120} /></label><label><span>Owner email</span><input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="owner@company.com" required /></label><button disabled={inviting}>{inviting ? "Creating…" : "Create invitation"}</button></form>
        {inviteLink && <div className="invite-link-result"><div><strong>Private signup or reactivation link created</strong><span>{inviteLink}</span></div><button onClick={() => void navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}
        {invitations.length > 0 && <div className="pending-platform-invites"><div className="panel-title"><div><p>Pending approval</p><h3>Open invitations</h3></div><span>{invitations.length}</span></div>{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.organizationName}</strong><span>{invitation.email} · {invitation.type === "REACTIVATE_ORGANIZATION" ? "Reactivation" : "New account"}</span></div><small>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small><button onClick={() => void revokeInvitation(invitation.id)}>Revoke</button></article>)}</div>}
      </section>
      <section className="platform-plans">
        <div className="panel-title"><div><p>Commercial packaging</p><h3>Service plans</h3></div><button onClick={() => editPlan()}>+ New plan</button></div>
        {plans.length === 0 ? <div className="platform-empty">No service plans created.</div> : <div className="plan-grid">{plans.map((plan) => <article key={plan.id}><header><span>{plan.code}</span><i className={`account-status ${plan.status.toLowerCase()}`}>{plan.status}</i></header><h3>{plan.name}</h3><p>{plan.description ?? "No description provided."}</p><div className="plan-pricing"><strong>{plan.currency} {plan.monthlyPrice.toLocaleString("en-IN")}</strong><span>/ month</span><small>{plan.currency} {plan.yearlyPrice.toLocaleString("en-IN")} yearly</small></div><footer><span>{plan.serviceIds.length} services · {plan.organizationCount} organizations</span><button onClick={() => editPlan(plan)}>Edit</button></footer></article>)}</div>}
        {showPlanEditor && <form className="plan-editor" onSubmit={savePlan}><header><div><p>Plan definition</p><h3>{editingPlanId ? "Edit service plan" : "Create service plan"}</h3></div><button type="button" onClick={() => setShowPlanEditor(false)}>×</button></header><div className="plan-fields"><label><span>Code</span><input value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} required /></label><label><span>Name</span><input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required /></label><label><span>Status</span><select value={planForm.status} onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as typeof planForm.status })}><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label><label><span>Monthly price</span><input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(event) => setPlanForm({ ...planForm, monthlyPrice: Number(event.target.value) })} required /></label><label><span>Yearly price</span><input type="number" min="0" step="0.01" value={planForm.yearlyPrice} onChange={(event) => setPlanForm({ ...planForm, yearlyPrice: Number(event.target.value) })} required /></label><label><span>Currency</span><input value={planForm.currency} maxLength={3} onChange={(event) => setPlanForm({ ...planForm, currency: event.target.value.toUpperCase() })} required /></label></div><label><span>Description</span><textarea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} rows={2} /></label><div className="plan-service-picker">{services.filter((service) => service.status === "ACTIVE").map((service) => <label key={service.id}><input type="checkbox" checked={planForm.serviceIds.includes(service.id)} onChange={(event) => setPlanForm({ ...planForm, serviceIds: event.target.checked ? [...planForm.serviceIds, service.id] : planForm.serviceIds.filter((id) => id !== service.id) })} /><span><strong>{service.name}</strong><small>{service.code}</small></span></label>)}</div><footer><button type="button" onClick={() => setShowPlanEditor(false)}>Cancel</button><button>Save plan</button></footer></form>}
      </section>
      <section className="platform-grid">
        <div className="organization-directory"><div className="panel-title"><div><p>Tenants</p><h3>Organizations</h3></div></div>{organizations.length === 0 ? <div className="platform-empty">No organizations registered.</div> : organizations.map((organization) => <button key={organization.id} className={selectedId === organization.id ? "active" : ""} onClick={() => setSelectedId(organization.id)}><span>{organization.name.slice(0, 2).toUpperCase()}</span><div><strong>{organization.name}</strong><small>{organization.owner?.email ?? "Owner unavailable"}</small></div><em className={`account-status ${organization.status.toLowerCase()}`}>{organization.status.replaceAll("_", " ")}</em></button>)}</div>
        <div className="service-assignment"><div className="panel-title"><div><p>Account & entitlements</p><h3>{selected ? selected.name : "Select an organization"}</h3></div>{selected && <span>{selected.enabledServiceIds.length} services</span>}</div>
          {selected && <div className="organization-access-bar"><div><span>Owner</span><strong>{selected.owner ? `${selected.owner.firstName} ${selected.owner.lastName ?? ""}` : "Unavailable"}</strong><small>{selected.owner?.email}</small></div><div><span>Login status</span><strong>{selected.status.replaceAll("_", " ")}</strong>{selected.owner?.isPlatformAdmin && <small>Protected Super Admin organization</small>}</div><div className="access-actions">{selected.status !== "ACTIVE" && <button className="approve" onClick={() => void setAccess("ACTIVE")}>{selected.status === "PENDING_APPROVAL" ? "Approve login" : "Restore access"}</button>}{selected.status === "ACTIVE" && !selected.owner?.isPlatformAdmin && <button onClick={() => void setAccess("SUSPENDED")}>Suspend</button>}{!selected.owner?.isPlatformAdmin && <button className="remove" onClick={() => void removeAccount()}>Remove account</button>}</div></div>}
          {selected && <section className="organization-plan-assignment"><header><div><span>Assigned plan</span><strong>{selected.plan?.plan.name ?? "Manual services"}</strong></div>{selected.plan && <i className={`account-status ${selected.plan.status.toLowerCase()}`}>{selected.plan.status.replaceAll("_", " ")}</i>}</header>{selected.plan && <div className="subscription-summary"><span><small>Current charge</small><strong>{selected.plan.currency} {Number(selected.plan.amount).toLocaleString("en-IN")} / {selected.plan.billingCycle === "YEARLY" ? "year" : "month"}</strong></span><span><small>Next billing</small><strong>{selected.plan.nextBillingAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(selected.plan.nextBillingAt)) : "Not scheduled"}</strong></span><span><small>Access ends</small><strong>{selected.plan.expiresAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(selected.plan.expiresAt)) : "No expiry"}</strong></span></div>}<div><label><span>Plan</span><select value={assignment.planId} onChange={(event) => { const planId = event.target.value; const plan = plans.find((item) => item.id === planId); setAssignment({ ...assignment, planId }); if (plan) setPaymentForm((current) => ({ ...current, amount: (assignment.billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice).toString() })); }}><option value="">Select a plan</option>{plans.filter((plan) => plan.status === "ACTIVE").map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label><span>Billing cycle</span><select value={assignment.billingCycle} onChange={(event) => { const billingCycle = event.target.value as typeof assignment.billingCycle; const plan = plans.find((item) => item.id === assignment.planId); setAssignment({ ...assignment, billingCycle }); if (plan) setPaymentForm((current) => ({ ...current, amount: (billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice).toString() })); }}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><label><span>Access type</span><select value={assignment.status} onChange={(event) => setAssignment({ ...assignment, status: event.target.value as typeof assignment.status })}><option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="PAST_DUE">Past due</option><option value="CANCELED">Canceled</option></select></label><label><span>Starts</span><input type="datetime-local" value={assignment.startsAt} onChange={(event) => setAssignment({ ...assignment, startsAt: event.target.value })} /></label><label><span>Trial ends</span><input type="datetime-local" value={assignment.trialEndsAt} onChange={(event) => setAssignment({ ...assignment, trialEndsAt: event.target.value })} /></label><label><span>Expires</span><input type="datetime-local" value={assignment.expiresAt} onChange={(event) => setAssignment({ ...assignment, expiresAt: event.target.value })} /></label><button disabled={!assignment.planId || selected.status !== "ACTIVE"} onClick={() => void assignPlan()}>Apply plan</button></div><p>Expired, past-due, and canceled subscriptions lose service access without deleting business data.</p>{selected.plan && <div className="billing-console"><form onSubmit={recordPayment}><h4>Record payment & renew</h4><label><span>Amount ({selected.plan.currency})</span><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label><label><span>Paid at</span><input type="datetime-local" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} required /></label><label><span>Reference</span><input value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} placeholder="UPI / bank reference" /></label><label><span>Note</span><input value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} placeholder="Optional internal note" /></label><button>Record & renew</button></form><PaymentHistory key={selected.plan.id} payments={selected.plan.payments} /></div>}</section>}
          {!selected ? <div className="platform-empty">Choose an organization to manage access.</div> : services.length === 0 ? <div className="service-empty"><div className="service-empty-icon"><span /><span /><span /></div><h3>No platform services registered</h3><p>Build a real module first. It can then be registered and assigned here—never through customer signup.</p></div> : <div className="assignment-list">{services.map((service) => { const enabled = selected.enabledServiceIds.includes(service.id); return <article key={service.id}><div><span>{service.code}</span><h3>{service.name}</h3><p>{service.description || "No description provided."}</p></div><label className="access-switch"><input type="checkbox" checked={enabled} disabled={updatingId === service.id || service.status !== "ACTIVE" || selected.status !== "ACTIVE"} onChange={(event) => void toggle(service.id, event.target.checked)} /><span /><small>{selected.status !== "ACTIVE" ? "Approve first" : service.status === "ACTIVE" ? enabled ? "Enabled" : "Disabled" : service.status}</small></label></article>; })}</div>}
        </div>
      </section>
    </main>
  </div>;
}
