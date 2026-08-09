# B² Brain — Deferred Work

This file tracks agreed work that should be completed later, after the current core-service foundation is stable.

## Documents & File Management

Status: **DEFERRED**

- Organization folders and secure document metadata.
- File uploads and downloads through private object storage.
- Customer, project, invoice, expense, support, website, procurement, and employee attachments.
- Organization, restricted, and employee-private visibility levels.
- Document categories, tags, approvals, versions, archive, and restore.
- Upload, view, and download audit history.
- Allowed-format and file-size validation.
- Private storage keys and signed, expiring download links.
- Virus-scanning and quarantine status foundation.
- Strict organization isolation and document permissions.
- Professional empty states without mock files.

Implementation requirement: use a provider adapter for Cloudflare R2, AWS S3, Supabase Storage, or another private object-storage service. PostgreSQL must contain metadata only—not file contents, permanent public URLs, or plaintext credentials.

Credentials will be requested only when real upload and download integration begins. Until then, attachment metadata foundations must not pretend files are uploaded or accessible.

## Approvals & Audit Center

Status: **DEFERRED**

- Unified approval inbox across business services.
- Approve, reject, return, comment, assign, deadline, and escalation workflows.
- Website production-change approvals.
- Purchase-order approvals.
- Future expense, refund, discount, integration, and AI-agent approvals.
- Immutable organization audit timeline.
- Before-and-after change summaries.
- Actor classification: user, system, integration, or AI agent.
- Verified organization, actor, source, timestamp, and request context.
- Failed-action and denied-action records.
- Filters by service, action, employee, risk, and date.
- Dashboard alerts for pending and overdue approvals.
- Policy-based human approval for high-risk agent actions.
- No normal API for editing or deleting audit records.

This must be completed before high-risk autonomous agents are enabled. The intended control flow is: agent proposes an action, policy evaluates risk, an authorized human approves when required, the action executes, and an immutable audit record is preserved.

## Automation

The separate [`B2-AUTOMATION-BRIDGE`](./AUTOMATION-BRIDGE-BACKLOG.md) remains pending until the core services are stable.
