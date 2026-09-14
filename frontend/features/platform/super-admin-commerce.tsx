"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";

type Maturity = {
  maturity: "AVAILABLE" | "BETA" | "TEST_MODE" | "FOUNDATION_ONLY" | "PLANNED";
  maturityLabel: string;
  availabilityNote: string;
  sellability: "GENERAL" | "BETA_ONLY" | "NOT_SELLABLE";
  hasCustomerNavigation: boolean;
};
type Service = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  maturity: Maturity | null;
};
type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  serviceIds: string[];
  organizationCount: number;
};
type Subscription = {
  planId: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELED";
  billingCycle: "MONTHLY" | "YEARLY";
  amount: string;
  currency: string;
  nextBillingAt: string | null;
  startsAt: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  plan: { name: string };
  payments: {
    id: string;
    amount: string;
    currency: string;
    paidAt: string;
    periodEndsAt: string;
    reference: string | null;
  }[];
};
type Organization = {
  id: string;
  name: string;
  status: string;
  enabledServiceIds: string[];
  plan: Subscription | null;
};
type Request = <T>(path: string, init?: RequestInit) => Promise<T>;
type Confirmation =
  | { kind: "plan"; title: string; description: string }
  | { kind: "payment"; title: string; description: string }
  | {
      kind: "service";
      title: string;
      description: string;
      service: Service;
      enabled: boolean;
    };

const fmt = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );

export function SuperAdminCommerce({
  section,
  organizations,
  services,
  plans,
  organizationId,
  request,
  refresh,
}: {
  section: "plans" | "services";
  organizations: Organization[];
  services: Service[];
  plans: Plan[];
  organizationId: string | null;
  request: Request;
  refresh: () => Promise<void>;
}) {
  const selected = organizations.find((item) => item.id === organizationId);
  const invalid = Boolean(organizationId) && !selected;
  const [editing, setEditing] = useState<Plan | null | undefined>();
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    description: "",
    status: "DRAFT" as Plan["status"],
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    serviceIds: [] as string[],
  });
  const [assignment, setAssignment] = useState({
    planId: selected?.plan?.planId ?? "",
    status:
      selected?.plan?.status === "EXPIRED"
        ? "CANCELED"
        : (selected?.plan?.status ?? "ACTIVE"),
    billingCycle: selected?.plan?.billingCycle ?? "MONTHLY",
    startsAt: (selected?.plan?.startsAt ?? new Date().toISOString()).slice(
      0,
      16,
    ),
    trialEndsAt: selected?.plan?.trialEndsAt?.slice(0, 16) ?? "",
    expiresAt: selected?.plan?.expiresAt?.slice(0, 16) ?? "",
  });
  const [payment, setPayment] = useState({
    amount: selected?.plan?.amount ?? "",
    paidAt: new Date().toISOString().slice(0, 16),
    reference: "",
    note: "",
  });
  const summary = useMemo(
    () => ({
      available: services.filter(
        (item) => item.maturity?.maturity === "AVAILABLE",
      ).length,
      beta: services.filter((item) => item.maturity?.maturity === "BETA")
        .length,
    }),
    [services],
  );

  function openPlan(plan?: Plan) {
    setEditing(plan ?? null);
    setPlanForm(
      plan
        ? { ...plan, description: plan.description ?? "" }
        : {
            code: "",
            name: "",
            description: "",
            status: "DRAFT",
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: "INR",
            serviceIds: [],
          },
    );
  }
  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await request(
        editing?.id ? `/platform/plans/${editing.id}` : "/platform/plans",
        {
          method: editing?.id ? "PUT" : "POST",
          body: JSON.stringify({
            ...planForm,
            description: planForm.description || null,
          }),
        },
      );
      setEditing(undefined);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to save service plan.",
      );
    } finally {
      setSaving(false);
    }
  }
  function openConfirmation(next: Confirmation, button: HTMLElement) {
    trigger.current = button;
    setConfirmation(next);
  }
  function closeConfirmation() {
    setConfirmation(null);
    window.setTimeout(() => trigger.current?.focus(), 0);
  }
  async function confirm() {
    if (!confirmation || !selected || pending) return;
    setPending(true);
    setError("");
    try {
      if (confirmation.kind === "plan")
        await request(`/platform/organizations/${selected.id}/plan`, {
          method: "PUT",
          body: JSON.stringify({
            ...assignment,
            startsAt: new Date(assignment.startsAt).toISOString(),
            trialEndsAt: assignment.trialEndsAt
              ? new Date(assignment.trialEndsAt).toISOString()
              : null,
            expiresAt: assignment.expiresAt
              ? new Date(assignment.expiresAt).toISOString()
              : null,
            additionalServiceIds: [],
            removedServiceIds: [],
          }),
        });
      if (confirmation.kind === "payment") {
        await request(
          `/platform/organizations/${selected.id}/subscription-payments`,
          {
            method: "POST",
            body: JSON.stringify({
              amount: Number(payment.amount),
              paidAt: new Date(payment.paidAt).toISOString(),
              reference: payment.reference || null,
              note: payment.note || null,
            }),
          },
        );
        setPayment((value) => ({ ...value, reference: "", note: "" }));
      }
      if (confirmation.kind === "service")
        await request(
          `/platform/organizations/${selected.id}/services/${confirmation.service.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ enabled: confirmation.enabled }),
          },
        );
      await refresh();
      closeConfirmation();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to complete the platform action.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`platform-commerce platform-commerce-${section}`}>
      {error && (
        <div className="dashboard-notice error" role="alert">
          {error}
        </div>
      )}
      <div className="commerce-directory">
        <div className="panel-title">
          <div>
            <p>Administrative target</p>
            <h2>Organizations</h2>
          </div>
        </div>
        {organizations.map((organization) => (
          <Link
            key={organization.id}
            href={`/super-admin?section=${section}&organization=${encodeURIComponent(organization.id)}`}
            className={selected?.id === organization.id ? "active" : ""}
            aria-current={selected?.id === organization.id ? "true" : undefined}
          >
            <strong>{organization.name}</strong>
            <span>{organization.plan?.plan.name ?? "No plan"}</span>
          </Link>
        ))}
      </div>
      <div className="commerce-workspace">
        {invalid ? (
          <div className="platform-empty">
            <h2>Organization not found</h2>
            <p>The selected administrative target is unavailable.</p>
          </div>
        ) : section === "plans" ? (
          <>
            {!selected && <>
            <header className="commerce-heading">
              <div>
                <p>Plan catalogue</p>
                <h2>Plans and Billing</h2>
                <span>
                  Manage plan definitions, subscriptions, and offline payments
                  without charging a customer.
                </span>
              </div>
              <button onClick={() => openPlan()}>+ New plan</button>
            </header>
            {plans.length === 0 ? (
              <div className="platform-empty">
                <h3>No service plans</h3>
              </div>
            ) : (
              <div className="commerce-plan-grid">
                {plans.map((plan) => {
                  const owned = services.filter((service) =>
                    plan.serviceIds.includes(service.id),
                  );
                  const beta = owned.filter(
                    (service) => service.maturity?.maturity === "BETA",
                  ).length;
                  return (
                    <article key={plan.id}>
                      <header>
                        <strong>{plan.name}</strong>
                        <span
                          className={`account-status ${plan.status.toLowerCase()}`}
                        >
                          {plan.status}
                        </span>
                      </header>
                      <p>{plan.description ?? "No description provided."}</p>
                      <div>
                        <strong>
                          {plan.currency}{" "}
                          {plan.monthlyPrice.toLocaleString("en-IN")}
                        </strong>{" "}
                        monthly · {plan.currency}{" "}
                        {plan.yearlyPrice.toLocaleString("en-IN")} yearly
                      </div>
                      <small>
                        {plan.serviceIds.length} services ·{" "}
                        {plan.organizationCount} organizations
                      </small>
                      <small>
                        {
                          owned.filter(
                            (service) =>
                              service.maturity?.maturity === "AVAILABLE",
                          ).length
                        }{" "}
                        Available · {beta} Beta
                      </small>
                      {beta > 0 && <em>Contains approved Beta services.</em>}
                      <button onClick={() => openPlan(plan)}>Edit plan</button>
                    </article>
                  );
                })}
              </div>
            )}
            {editing !== undefined && (
              <form className="commerce-editor" onSubmit={savePlan}>
                <header>
                  <h3>
                    {editing ? `Edit ${editing.name}` : "Create service plan"}
                  </h3>
                  <button
                    type="button"
                    aria-label="Close plan editor"
                    onClick={() => setEditing(undefined)}
                  >
                    ×
                  </button>
                </header>
                <p>
                  Editing a plan definition does not silently rewrite existing
                  subscriptions.
                </p>
                <div>
                  <label>
                    Code
                    <input
                      required
                      minLength={2}
                      maxLength={40}
                      value={planForm.code}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          code: e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_]/g, "_"),
                        })
                      }
                    />
                  </label>
                  <label>
                    Name
                    <input
                      required
                      minLength={2}
                      value={planForm.name}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={planForm.status}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          status: e.target.value as Plan["status"],
                        })
                      }
                    >
                      <option>DRAFT</option>
                      <option>ACTIVE</option>
                      <option>ARCHIVED</option>
                    </select>
                  </label>
                  <label>
                    Monthly price
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={planForm.monthlyPrice}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          monthlyPrice: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Yearly price
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={planForm.yearlyPrice}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          yearlyPrice: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Currency
                    <input
                      required
                      minLength={3}
                      maxLength={3}
                      value={planForm.currency}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    maxLength={1000}
                    value={planForm.description}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, description: e.target.value })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Plan service composition</legend>
                  <p>
                    Beta services require approved testing. Foundation and
                    Planned services cannot be selected.
                  </p>
                  {services.map((service) => (
                    <label key={service.id}>
                      <input
                        type="checkbox"
                        disabled={
                          service.maturity?.sellability === "NOT_SELLABLE"
                        }
                        checked={planForm.serviceIds.includes(service.id)}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            serviceIds: e.target.checked
                              ? [...planForm.serviceIds, service.id]
                              : planForm.serviceIds.filter(
                                  (id) => id !== service.id,
                                ),
                          })
                        }
                      />
                      {service.name} — {service.maturity?.maturityLabel}
                    </label>
                  ))}
                </fieldset>
                <button disabled={saving}>
                  {saving ? "Saving…" : "Save plan"}
                </button>
              </form>
            )}
            </>}
            {!selected ? (
              <div className="platform-empty">
                <h3>Select an organization</h3>
                <p>
                  Choose an administrative target to review its subscription.
                  This does not change your membership.
                </p>
              </div>
            ) : (
              <section className="subscription-workspace">
                <header>
                  <div>
                    <p>Selected organization</p>
                    <h2>{selected.name}</h2>
                  </div>
                  <span
                    className={`account-status ${(selected.plan?.status ?? "none").toLowerCase()}`}
                  >
                    {selected.plan?.status.replaceAll("_", " ") ?? "NO PLAN"}
                  </span>
                </header>
                {selected.plan && (
                  <div className="subscription-facts">
                    <span>
                      <small>Current plan</small>
                      <strong>{selected.plan.plan.name}</strong>
                    </span>
                    <span>
                      <small>Billing cycle</small>
                      <strong>{selected.plan.billingCycle}</strong>
                    </span>
                    <span>
                      <small>Current charge</small>
                      <strong>
                        {selected.plan.currency}{" "}
                        {Number(selected.plan.amount).toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span>
                      <small>Starts</small>
                      <strong>{fmt(selected.plan.startsAt)}</strong>
                    </span>
                    <span>
                      <small>Trial ends</small>
                      <strong>
                        {selected.plan.trialEndsAt
                          ? fmt(selected.plan.trialEndsAt)
                          : "Not applicable"}
                      </strong>
                    </span>
                    <span>
                      <small>Access ends</small>
                      <strong>
                        {selected.plan.expiresAt
                          ? fmt(selected.plan.expiresAt)
                          : "No expiry"}
                      </strong>
                    </span>
                  </div>
                )}
                <div className="subscription-forms">
                  <div>
                    <h3>Assign subscription</h3>
                    <label>
                      Plan
                      <select
                        value={assignment.planId}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            planId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select active plan</option>
                        {plans
                          .filter((plan) => plan.status === "ACTIVE")
                          .map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Billing cycle
                      <select
                        value={assignment.billingCycle}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            billingCycle: e.target.value as
                              "MONTHLY" | "YEARLY",
                          })
                        }
                      >
                        <option>MONTHLY</option>
                        <option>YEARLY</option>
                      </select>
                    </label>
                    <label>
                      Access type
                      <select
                        value={assignment.status}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            status: e.target.value as typeof assignment.status,
                          })
                        }
                      >
                        <option>ACTIVE</option>
                        <option>TRIAL</option>
                        <option>PAST_DUE</option>
                        <option>CANCELED</option>
                      </select>
                    </label>
                    <label>
                      Starts
                      <input
                        type="datetime-local"
                        value={assignment.startsAt}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            startsAt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Trial ends
                      <input
                        type="datetime-local"
                        value={assignment.trialEndsAt}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            trialEndsAt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Access ends
                      <input
                        type="datetime-local"
                        value={assignment.expiresAt}
                        onChange={(e) =>
                          setAssignment({
                            ...assignment,
                            expiresAt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      disabled={
                        !assignment.planId || selected.status !== "ACTIVE"
                      }
                      onClick={(e) => {
                        const plan = plans.find(
                          (item) => item.id === assignment.planId,
                        );
                        if (plan)
                          openConfirmation(
                            {
                              kind: "plan",
                              title: `Apply ${plan.name} to ${selected.name}?`,
                              description: `${assignment.status} access will use ${assignment.billingCycle.toLowerCase()} billing. Existing business data is preserved.${services.some((service) => plan.serviceIds.includes(service.id) && service.maturity?.maturity === "BETA") ? " This plan includes Beta services for approved testing." : ""}`,
                            },
                            e.currentTarget,
                          );
                      }}
                    >
                      Review plan change
                    </button>
                  </div>
                  {selected.plan && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        openConfirmation(
                          {
                            kind: "payment",
                            title: `Record payment for ${selected.name}?`,
                            description: `Record ${selected.plan?.currency} ${Number(payment.amount).toLocaleString("en-IN")} already received outside B² Brain. This does not charge the customer and the existing backend renews access.`,
                          },
                          e.currentTarget.querySelector("button")!,
                        );
                      }}
                    >
                      <h3>Record offline/manual payment</h3>
                      <p>
                        For UPI, bank transfer, cash, or another external
                        method. This does not charge the customer.
                      </p>
                      <label>
                        Amount ({selected.plan.currency})
                        <input
                          required
                          type="number"
                          min="0.01"
                          max="100000000"
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) =>
                            setPayment({ ...payment, amount: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Paid at
                        <input
                          required
                          type="datetime-local"
                          value={payment.paidAt}
                          onChange={(e) =>
                            setPayment({ ...payment, paidAt: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Reference
                        <input
                          maxLength={120}
                          value={payment.reference}
                          onChange={(e) =>
                            setPayment({
                              ...payment,
                              reference: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Internal note
                        <input
                          maxLength={500}
                          value={payment.note}
                          onChange={(e) =>
                            setPayment({ ...payment, note: e.target.value })
                          }
                        />
                      </label>
                      <button>Review payment and renewal</button>
                    </form>
                  )}
                </div>
                {selected.plan && (
                  <div className="payment-history">
                    <h3>Payment history</h3>
                    {selected.plan.payments.length === 0 ? (
                      <p>No subscription payments recorded.</p>
                    ) : (
                      selected.plan.payments.slice(0, 10).map((item) => (
                        <article key={item.id}>
                          <strong>
                            {item.currency}{" "}
                            {Number(item.amount).toLocaleString("en-IN")}
                          </strong>
                          <span>{fmt(item.paidAt)}</span>
                          <small>
                            {item.reference || "Manual payment"} · access until{" "}
                            {fmt(item.periodEndsAt)}
                          </small>
                        </article>
                      ))
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            {!selected && <>
            <header className="commerce-heading">
              <div>
                <p>Service catalogue</p>
                <h2>Services</h2>
                <span>
                  {summary.available} Available · {summary.beta} Beta across the
                  verified 21-service catalogue.
                </span>
              </div>
            </header>
            <div className="service-catalogue">
              {services.map((service) => (
                <article key={service.id}>
                  <header>
                    <strong>{service.name}</strong>
                    <span
                      className={`maturity-badge ${service.maturity?.maturity.toLowerCase()}`}
                    >
                      {service.maturity?.maturityLabel}
                    </span>
                  </header>
                  <p>
                    {service.maturity?.availabilityNote ?? service.description}
                  </p>
                  <span>
                    {service.maturity?.hasCustomerNavigation
                      ? "Customer navigation available"
                      : "No primary customer navigation"}
                  </span>
                  <details>
                    <summary>Advanced details</summary>
                    <code>{service.code}</code>
                  </details>
                </article>
              ))}
            </div>
            </>}
            {!selected ? (
              <div className="platform-empty">
                <h3>Select an organization</h3>
                <p>
                  Choose an administrative target to review service
                  entitlements.
                </p>
              </div>
            ) : (
              <section className="entitlement-workspace">
                <header>
                  <div>
                    <p>Selected organization</p>
                    <h2>{selected.name}</h2>
                  </div>
                  <span>{selected.enabledServiceIds.length} enabled</span>
                </header>
                {services.map((service) => {
                  const enabled = selected.enabledServiceIds.includes(
                    service.id,
                  );
                  const blocked =
                    service.maturity?.sellability === "NOT_SELLABLE";
                  return (
                    <article key={service.id}>
                      <div>
                        <strong>{service.name}</strong>
                        <span
                          className={`maturity-badge ${service.maturity?.maturity.toLowerCase()}`}
                        >
                          {service.maturity?.maturityLabel}
                        </span>
                        <p>
                          {service.maturity?.hasCustomerNavigation
                            ? "Appears in customer navigation when permissions also allow it."
                            : "No primary customer navigation exists for this service."}
                        </p>
                      </div>
                      <label className="access-switch">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={
                            blocked || pending || selected.status !== "ACTIVE"
                          }
                          onChange={(e) =>
                            openConfirmation(
                              {
                                kind: "service",
                                title: `${e.target.checked ? "Enable" : "Disable"} ${service.name} for ${selected.name}?`,
                                description: e.target.checked
                                  ? `${service.maturity?.maturity === "BETA" ? "This enables approved Beta testing; it is not a production-readiness claim. " : ""}Member permissions remain independent.`
                                  : "Workspace access is removed immediately, but existing business data is preserved.",
                                service,
                                enabled: e.target.checked,
                              },
                              e.currentTarget
                                .closest("label")!
                                .querySelector("input")!,
                            )
                          }
                        />
                        <span />
                        <small>
                          {blocked
                            ? "Not assignable"
                            : enabled
                              ? "Enabled"
                              : "Disabled"}
                        </small>
                      </label>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
      {confirmation && (
        <div
          className="platform-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending) closeConfirmation();
          }}
        >
          <section
            className="platform-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commerce-confirm-title"
            aria-describedby="commerce-confirm-description"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !pending) closeConfirmation();
            }}
          >
            <h2 id="commerce-confirm-title">{confirmation.title}</h2>
            <p id="commerce-confirm-description">{confirmation.description}</p>
            {error && <div role="alert">{error}</div>}
            <footer>
              <button autoFocus disabled={pending} onClick={closeConfirmation}>
                Cancel
              </button>
              <button disabled={pending} onClick={() => void confirm()}>
                {pending ? "Working…" : "Confirm"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
