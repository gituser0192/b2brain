"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/services/api-client";

interface Config {
  formKey: string;
  connectorName: string;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  accentColor: string;
  askService: boolean;
  serviceLabel: string;
}
interface ConfigResponse { success: true; data: Config }
interface SubmitResponse { success: true; data: { accepted: true; successMessage?: string } }

export function WebsiteLeadForm({ formKey }: { formKey: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [form, setForm] = useState({ contactName: "", email: "", phone: "", service: "", message: "", website: "" });
  const [state, setState] = useState<"LOADING" | "READY" | "SENDING" | "SENT" | "ERROR">("LOADING");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void apiRequest<ConfigResponse>(`/public/forms/${encodeURIComponent(formKey)}`)
      .then((response) => { setConfig(response.data); setState("READY"); })
      .catch((error) => { setMessage(error instanceof ApiError ? error.message : "This inquiry form is unavailable."); setState("ERROR"); });
  }, [formKey]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("SENDING");
    try {
      const response = await apiRequest<SubmitResponse>(`/public/forms/${encodeURIComponent(formKey)}`, {
        method: "POST",
        body: JSON.stringify({ ...form, startedAt }),
      });
      setMessage(response.data.successMessage ?? config?.successMessage ?? "Thank you. Your inquiry has been received.");
      setForm({ contactName: "", email: "", phone: "", service: "", message: "", website: "" });
      setState("SENT");
      setStartedAt(Date.now());
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Unable to send your inquiry.");
      setState("ERROR");
    }
  }
  if (state === "LOADING") return <main className="public-lead-shell"><div className="public-lead-state">Loading inquiry form…</div></main>;
  if (!config) return <main className="public-lead-shell"><div className="public-lead-state error">{message}</div></main>;
  return <main className="public-lead-shell" style={{ "--form-accent": config.accentColor } as React.CSSProperties}>
    <form className="public-lead-form" onSubmit={submit}>
      <header><span>B² BRAIN · SECURE INQUIRY</span><h1>{config.title}</h1><p>{config.description}</p></header>
      {state === "SENT" && <div className="public-form-notice success">{message}</div>}
      {state === "ERROR" && <div className="public-form-notice error">{message}</div>}
      <label><span>Name</span><input required minLength={2} value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
      <div className="public-form-grid">
        <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      </div>
      {config.askService && <label><span>{config.serviceLabel}</span><input value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} /></label>}
      <label><span>How can we help?</span><textarea required minLength={3} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
      <label className="public-form-trap" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
      <button disabled={state === "SENDING" || (!form.email && !form.phone)}>{state === "SENDING" ? "Sending…" : config.submitLabel}</button>
      <footer>Your details are sent securely to {config.connectorName}.</footer>
    </form>
  </main>;
}
