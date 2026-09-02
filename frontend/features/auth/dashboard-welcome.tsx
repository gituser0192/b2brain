"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import type { AuthSession } from "./auth.types";

export interface OrganizationPreferencesForm {
  name: string;
  timezone: string;
  currency: string;
}

interface DashboardWelcomeProps {
  editing: boolean;
  form: OrganizationPreferencesForm;
  hasOrganizationUpdate: boolean;
  initials: string;
  isOrganizationOwner: boolean;
  saving: boolean;
  session: AuthSession;
  onCloseEditor: () => void;
  onFormChange: (form: OrganizationPreferencesForm) => void;
  onOpenPeople: () => void;
  onSaveOrganization: (event: FormEvent<HTMLFormElement>) => void;
  onToggleEditor: () => void;
}

export function DashboardWelcome({
  editing,
  form,
  hasOrganizationUpdate,
  initials,
  isOrganizationOwner,
  saving,
  session,
  onCloseEditor,
  onFormChange,
  onOpenPeople,
  onSaveOrganization,
  onToggleEditor,
}: DashboardWelcomeProps) {
  return (
    <>
      <section className="welcome-hero">
        <div className="hero-copy">
          <span className="welcome-badge">Welcome to your workspace</span>
          <h2>Good to have you here,<br /><em>{session.user.firstName}.</em></h2>
          <p>
            This is the starting point for {session.organization.name}.
            Complete the essentials below, then add real business modules when you are ready.
          </p>
          <div className="hero-assurances">
            <span>✓ No sample data</span>
            <span>✓ Private to your organization</span>
            <span>✓ Role-protected access</span>
          </div>
        </div>
        <div className="hero-brain" aria-hidden="true">
          <div className="hero-logo">
            <Image src="/brand/b2brain-logo.png" alt="" fill sizes="190px" />
          </div>
          <span className="orbit-dot dot-a" />
          <span className="orbit-dot dot-b" />
          <span className="orbit-dot dot-c" />
        </div>
      </section>

      <div className="dashboard-content-grid">
        <section className="setup-section">
          <div className="section-heading">
            <div><p>Getting started</p><h2>Set up your foundation</h2></div>
            <span>1 of 4 ready</span>
          </div>
          <div className="setup-list">
            <article className="setup-item complete">
              <span className="setup-state">✓</span>
              <div><h3>Workspace created</h3><p>Your isolated organization and owner account are ready.</p></div>
              <span className="item-status">Complete</span>
            </article>
            <article className="setup-item">
              <span className="setup-state">2</span>
              <div><h3>Confirm organization preferences</h3><p>Check your name, timezone, and operating currency.</p></div>
              <button onClick={onToggleEditor} disabled={!hasOrganizationUpdate}>{editing ? "Close" : "Review"}</button>
            </article>
            {isOrganizationOwner && (
              <article className="setup-item">
                <span className="setup-state">3</span>
                <div><h3>Invite your team</h3><p>Create secure invitations and assign the right starting role.</p></div>
                <button onClick={onOpenPeople}>Open People</button>
              </article>
            )}
            <article className="setup-item">
              <span className="setup-state">4</span>
              <div><h3>Start your first business module</h3><p>Assigned modules will appear automatically when your platform plan enables them.</p></div>
              <span className="item-status">Awaiting access</span>
            </article>
          </div>

          {editing && (
            <form className="organization-form" onSubmit={onSaveOrganization}>
              <div className="settings-title">
                <div><p>Organization preferences</p><h3>Make the workspace yours</h3></div>
                <button type="button" onClick={onCloseEditor}>×</button>
              </div>
              <label>
                <span>Organization name</span>
                <input
                  value={form.name}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                  maxLength={120}
                  required
                />
              </label>
              <div className="settings-grid">
                <label>
                  <span>Timezone</span>
                  <select value={form.timezone} onChange={(event) => onFormChange({ ...form, timezone: event.target.value })}>
                    <option>Asia/Kolkata</option>
                    <option>UTC</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>Asia/Dubai</option>
                    <option>Asia/Singapore</option>
                  </select>
                </label>
                <label>
                  <span>Currency</span>
                  <select value={form.currency} onChange={(event) => onFormChange({ ...form, currency: event.target.value })}>
                    <option>INR</option>
                    <option>USD</option>
                    <option>GBP</option>
                    <option>EUR</option>
                    <option>AED</option>
                    <option>SGD</option>
                  </select>
                </label>
              </div>
              <button className="save-settings" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
            </form>
          )}
        </section>

        <aside className="workspace-summary">
          <div className="summary-card">
            <p>Account & access</p>
            <div className="summary-user">
              <div className="avatar large">{initials}</div>
              <div><strong>{session.user.firstName} {session.user.lastName}</strong><span>{session.user.email}</span></div>
            </div>
            <dl>
              <div><dt>Role</dt><dd>{session.membership.role.name}</dd></div>
              <div><dt>Timezone</dt><dd>{session.organization.timezone}</dd></div>
              <div><dt>Currency</dt><dd>{session.organization.currency}</dd></div>
            </dl>
          </div>
          <div className="clean-state-card">
            <span className="clean-icon">◇</span>
            <div><strong>Clean workspace</strong><p>No customers, projects, tasks, invoices, employees, or analytics have been created.</p></div>
          </div>
        </aside>
      </div>
    </>
  );
}
