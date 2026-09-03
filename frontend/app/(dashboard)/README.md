# Authenticated workspace routes

The `(dashboard)/(workspace)` route group supplies one shared `WorkspaceShell` layout. It restores the authenticated session, loads organization-enabled services, enforces frontend permission visibility, renders the persistent sidebar/header, and keeps sidebar and main-content scrolling independent. Backend authorization remains authoritative.

## Primary routes

- `/dashboard` — organization dashboard
- `/crm` and `/crm/customers/[customerId]` — CRM workspace and customer detail
- `/projects` and `/projects/[projectId]` — project and task workspace
- `/finance` — finance workspace
- `/automation` — Automation workspace
- `/agent` — internal Business Operating Agent
- `/settings` — profile and organization settings

`/operations` and `/super-admin` remain authenticated secondary routes outside the shared tenant workspace group. Public/auth routes include `/login`, `/signup`, `/accept-invitation`, `/onboarding`, password recovery, `/forms/[formKey]`, and `/quotation/[token]`.

Legacy `/dashboard?view=...` links remain supported and redirect or resolve through `features/auth/workspace-routes.ts`. Do not remove that compatibility without a separate route-migration project.

## Structure and verification

- `app/(dashboard)/(workspace)/layout.tsx` owns the shared authenticated layout boundary.
- Route pages are thin entry points; feature implementation remains under `features/`.
- Global stylesheet imports are owned exclusively by `app/layout.tsx`; see `app/styles/README.md` for order and ownership.
- Playwright journeys cover authentication, primary and legacy navigation, refresh, Back/Forward, permissions, mobile navigation, and sign-out.
- Visual baselines cover desktop, tablet, and mobile. Run `npm run test:e2e` to verify; update an individual baseline only after reviewing and approving its visual diff.

The MVP cleanup covers foundations, shared layouts, CRM, Projects/Tasks, Finance, Automation, and the internal Workspace Agent. Non-MVP School, Stay, Inventory, Marketing, Websites, Procurement, Sales expansion, platform administration, and other secondary workspaces remain deliberately deferred. File size alone is not authorization to restructure them.
