"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { useAuth } from "./auth-context";

const initial = { businessName: "", ownerName: "", industry: "", phone: "", businessSize: "", monthlyRevenueRange: "", primaryBusinessGoal: "", timezone: "Asia/Kolkata", currency: "INR" };

export function BusinessOnboardingForm() {
  const router = useRouter();
  const { session, isLoading, authorizedRequest, reloadSession } = useAuth();
  const [values, setValues] = useState(initial);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/login"); return; }
    if (session.user.isPlatformAdmin) { router.replace("/super-admin"); return; }
    if (session.membership.role.code !== "ORGANIZATION_OWNER" || session.organization.onboardingCompleted) { router.replace("/dashboard"); return; }
    if (!initialized) {
      const task = window.setTimeout(() => {
        setValues((current) => ({ ...current, businessName: session.organization.name, ownerName: [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") }));
        setInitialized(true);
      }, 0);
      return () => window.clearTimeout(task);
    }
  }, [initialized, isLoading, router, session]);

  const change = (name: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(""); setFieldErrors({});
    try {
      await authorizedRequest("/organizations/current/onboarding", { method: "POST", body: JSON.stringify(values) });
      await reloadSession();
      router.replace("/dashboard");
    } catch (reason) {
      if (reason instanceof ApiError) { setError(reason.message); setFieldErrors(reason.errors ?? {}); }
      else setError("Unable to complete onboarding right now. Your entries are still here; please retry.");
    } finally { setSubmitting(false); }
  }

  if (isLoading || !session || !initialized) return <div className="invitation-check"><span className="spinner dark" /><p>Opening your business profile…</p></div>;
  const field = (name: keyof typeof values, label: string, control: ReactNode) => <label className={fieldErrors[name] ? "has-error" : ""}><span>{label}</span>{control}{fieldErrors[name] && <small className="field-error">{fieldErrors[name]}</small>}</label>;

  return <form className="auth-form onboarding-form" onSubmit={submit}>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <div className="onboarding-grid">
      {field("businessName", "Business name", <input value={values.businessName} onChange={(event) => change("businessName", event.target.value)} autoComplete="organization" required />)}
      {field("ownerName", "Owner name", <input value={values.ownerName} onChange={(event) => change("ownerName", event.target.value)} autoComplete="name" required />)}
      {field("industry", "Industry", <input value={values.industry} onChange={(event) => change("industry", event.target.value)} placeholder="Retail, education, services…" required />)}
      {field("phone", "Phone number", <input value={values.phone} onChange={(event) => change("phone", event.target.value)} type="tel" autoComplete="tel" placeholder="+91 98765 43210" required />)}
      {field("businessSize", "Business size", <select value={values.businessSize} onChange={(event) => change("businessSize", event.target.value)} required><option value="">Select size</option><option value="JUST_ME">Just me</option><option value="2_TO_10">2–10 people</option><option value="11_TO_50">11–50 people</option><option value="51_TO_200">51–200 people</option><option value="201_PLUS">201+ people</option></select>)}
      {field("monthlyRevenueRange", "Monthly revenue range", <select value={values.monthlyRevenueRange} onChange={(event) => change("monthlyRevenueRange", event.target.value)} required><option value="">Select range</option><option value="PRE_REVENUE">Pre-revenue</option><option value="UNDER_1_LAKH">Under ₹1 lakh</option><option value="1_TO_5_LAKH">₹1–5 lakh</option><option value="5_TO_25_LAKH">₹5–25 lakh</option><option value="25_LAKH_TO_1_CRORE">₹25 lakh–₹1 crore</option><option value="ABOVE_1_CRORE">Above ₹1 crore</option></select>)}
      {field("primaryBusinessGoal", "Primary business goal", <select value={values.primaryBusinessGoal} onChange={(event) => change("primaryBusinessGoal", event.target.value)} required><option value="">Select goal</option><option value="GROW_SALES">Grow sales</option><option value="IMPROVE_MARKETING">Improve marketing</option><option value="MANAGE_CUSTOMERS">Manage customers</option><option value="CONTROL_FINANCES">Control finances</option><option value="AUTOMATE_OPERATIONS">Automate operations</option><option value="MANAGE_TEAM">Manage my team</option></select>)}
      {field("timezone", "Timezone", <select value={values.timezone} onChange={(event) => change("timezone", event.target.value)}><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New York</option><option value="Europe/London">Europe/London</option><option value="Asia/Dubai">Asia/Dubai</option><option value="Asia/Singapore">Asia/Singapore</option></select>)}
      {field("currency", "Currency", <select value={values.currency} onChange={(event) => change("currency", event.target.value)}><option value="INR">INR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option><option value="SGD">SGD</option></select>)}
    </div>
    <button className="primary-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" />Saving business profile…</> : "Open my dashboard"}<span aria-hidden="true">→</span></button>
  </form>;
}
