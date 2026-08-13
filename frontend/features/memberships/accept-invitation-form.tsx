"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

export function AcceptInvitationForm() {
  const { logout } = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setError("This invitation link is incomplete."); return; }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/memberships/invitations/accept?token=${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ ...form, lastName: form.lastName || undefined }) });
      await logout().catch(() => undefined);
      setAccepted(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to accept this invitation.");
    } finally { setSubmitting(false); }
  }

  if (accepted) return <div className="accept-result"><span>✓</span><h2>You’re part of the team.</h2><p>The previous browser session has been signed out. Continue using the invited email and the password you just created.</p><Link href="/login">Sign in as the new member →</Link></div>;
  return (
    <form className="accept-form" onSubmit={submit}>
      <div><p>Secure organization invitation</p><h1>Join your team workspace</h1><span>Create your account using the email address that received this link.</span></div>
      {error && <div className="form-alert">{error}</div>}
      <label><span>First name</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label>
      <label><span>Last name <em>Optional</em></span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
      <label><span>Password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={128} required /><small>At least 8 characters with a letter and number.</small></label>
      <button disabled={submitting}>{submitting ? "Joining…" : "Accept invitation"}</button>
      <Link href="/login">Already have access? Sign in</Link>
      <Link href="/forgot-password">Existing account but forgot the password?</Link>
    </form>
  );
}
