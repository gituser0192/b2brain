"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { apiRequest } from "@/services/api-client";
import { useAuth } from "./auth-context";
import { FieldIcon } from "./auth-shell";

export function SignupForm() {
  const router = useRouter();
  const { register, session, isLoading } = useAuth();
  const [values, setValues] = useState({ firstName: "", lastName: "", password: "" });
  const [invitationToken] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") ?? "");
  const [invitation, setInvitation] = useState<{ email: string; organizationName: string; expiresAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION" } | null>(null);
  const [checkingInvitation, setCheckingInvitation] = useState(true);
  const [submittedForApproval, setSubmittedForApproval] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const change = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => { if (!isLoading && session) router.replace("/dashboard"); }, [isLoading, session, router]);
  useEffect(() => {
    const task = window.setTimeout(() => {
      if (!invitationToken) { setError("Registration is invitation-only. Ask the B² Brain administrator for an invitation."); setCheckingInvitation(false); return; }
      void apiRequest<{ success: true; data: { email: string; organizationName: string; expiresAt: string; type: "NEW_ORGANIZATION" | "REACTIVATE_ORGANIZATION" } }>(`/auth/registration-invitations/${encodeURIComponent(invitationToken)}`)
        .then((response) => setInvitation(response.data))
        .catch((reason) => setError(reason instanceof ApiError ? reason.message : "This registration invitation is invalid."))
        .finally(() => setCheckingInvitation(false));
    }, 0);
    return () => window.clearTimeout(task);
  }, [invitationToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({ ...values, invitationToken, lastName: values.lastName || undefined });
      setSubmittedForApproval(true);
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.message);
      } else setError("Unable to create your workspace right now.");
    } finally { setSubmitting(false); }
  }

  if (checkingInvitation) return <div className="invitation-check"><span className="spinner dark" /><p>Checking your invitation…</p></div>;
  if (!invitation) return <div className="invitation-required"><div className="form-alert" role="alert">{error}</div><strong>Accounts require Super Admin approval.</strong><p>Use the private signup link issued specifically for your email address.</p></div>;
  if (submittedForApproval) return <div className="approval-waiting"><span>✓</span><h3>{invitation.type === "REACTIVATE_ORGANIZATION" ? "Reactivation submitted" : "Registration submitted"}</h3><p>Your organization account is waiting for Super Admin approval. You can sign in after access is approved.</p><button onClick={() => router.replace("/login")}>Go to sign in</button></div>;

  return (
    <form onSubmit={submit} className="auth-form compact-form">
      {error && <div className="form-alert" role="alert">{error}</div>}
      <div className="approved-invitation"><span>{invitation.type === "REACTIVATE_ORGANIZATION" ? "Approved account reactivation" : "Approved organization"}</span><strong>{invitation.organizationName}</strong><small>{invitation.email}</small></div>
      <div className="field-grid">
        <label><span>First name</span><div className="field-wrap"><FieldIcon name="user" /><input value={values.firstName} onChange={(event) => change("firstName", event.target.value)} placeholder="Alex" autoComplete="given-name" required /></div></label>
        <label><span>Last name <em>Optional</em></span><div className="field-wrap"><FieldIcon name="user" /><input value={values.lastName} onChange={(event) => change("lastName", event.target.value)} placeholder="Morgan" autoComplete="family-name" /></div></label>
      </div>
      <label><span>Password</span><div className="field-wrap"><FieldIcon name="lock" /><input type={showPassword ? "text" : "password"} value={values.password} onChange={(event) => change("password", event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={128} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div><small className="field-hint">Use at least 8 characters with a letter and number.</small></label>
      <button className="primary-button" type="submit" disabled={submitting || isLoading}>{submitting ? <><span className="spinner" />Creating workspace…</> : "Create my workspace"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
