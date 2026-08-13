"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { useAuth } from "./auth-context";
import { FieldIcon } from "./auth-shell";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const { login, session, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && session) router.replace(session.user.isPlatformAdmin ? "/super-admin" : "/dashboard");
  }, [isLoading, session, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const authenticatedSession = await login({ email, password });
      router.replace(authenticatedSession.user.isPlatformAdmin ? "/super-admin" : "/dashboard");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to sign in right now.");
    } finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {error && <div className="form-alert" role="alert">{error}</div>}
      <label><span>Email address</span><div className="field-wrap"><FieldIcon name="mail" /><input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
      <label><span>Password</span><div className="field-wrap"><FieldIcon name="lock" /><input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
      <Link className="forgot-password-link" href="/forgot-password">Forgot password?</Link>
      <button className="primary-button" type="submit" disabled={submitting || isLoading}>{submitting ? <><span className="spinner" />Signing in…</> : "Sign in to workspace"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
