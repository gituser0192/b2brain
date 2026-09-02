"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { ApiError, apiRequest } from "@/services/api-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [resetPath, setResetPath] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const response = await apiRequest<{
        success: true;
        data: { resetPath?: string };
      }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setResetPath(response.data.resetPath ?? "");
      setDone(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to request a password reset.",
      );
    }
  }

  if (done) {
    return (
      <div className="approval-waiting">
        <span>✓</span>
        <h3>Reset requested</h3>
        <p>
          If an eligible account exists, a one-time reset was created. It expires
          in 30 minutes.
        </p>
        {resetPath && (
          <Link href={resetPath}>Open development reset link →</Link>
        )}
        <Link href="/login">Return to sign in</Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="form-alert">{error}</div>}
      <label>
        <span>Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <button className="primary-button">Request password reset</button>
    </form>
  );
}
