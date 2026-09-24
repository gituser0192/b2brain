"use client";

import { useState, type FormEvent } from "react";
import { publicEnv } from "../../../lib/env";

export function RequestAccessForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/public/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Request failed");
      form.reset();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return <form id="request-access" className="site-access-form" onSubmit={submit}>
    <h2>Request access</h2>
    <p>Tell us about your organization. Our team will review your request and contact you; submitting does not create an account.</p>
    <div className="site-access-fields">
      <label>Your name<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
      <label>Work email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Organization<input name="organization" required minLength={2} maxLength={120} autoComplete="organization" /></label>
      <label>What would you like help with?<textarea name="message" required minLength={10} maxLength={2000} rows={5} /></label>
    </div>
    <label className="site-access-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <button className="site-button" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send request"}</button>
    <p role="status" aria-live="polite">{state === "sent" ? "Request received. Our team will contact you." : state === "error" ? "We couldn’t send your request. Please try again or email sathsupport@sathos.in." : ""}</p>
  </form>;
}
