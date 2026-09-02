# B² Brain architecture

## Repository boundaries

B² Brain is an npm-workspace monorepo:

- `frontend` is a Next.js App Router application responsible for browser rendering and interaction.
- `backend` is an Express API responsible for authentication, authorization, organization isolation, business rules, persistence, agents, and external integrations.
- `packages` contains small shared configuration, permission, type, and validation workspaces.
- `backend/prisma` owns the PostgreSQL schema, reviewed migrations, and platform seed.

The frontend communicates with the versioned backend API through `frontend/services/api-client.ts`. The backend is the security boundary; client-side service visibility and filtering are not authorization controls.

## Frontend architecture

Public authentication routes live under `frontend/app/(auth)`. The authenticated customer workspace, provider operations desk, and platform administration routes live under `frontend/app/(dashboard)`.

The customer workspace currently uses `/dashboard` with a `view` query parameter. `ProtectedDashboard` owns authentication redirects, service discovery, sidebar/header composition, and workspace selection. Business UI is organized under `frontend/features` by domain. Large workspaces are being split incrementally into stateful orchestration components and smaller presentation components without changing behavior.

Global styles are imported in this order from the root layout:

1. `globals.css`
2. `styles/customer-enquiry-agent.css`
3. `styles/knowledge-management.css`
4. `styles/dashboard-mobile.css`

Their cascade order is intentional and must be preserved until visual-regression coverage exists.

## Backend architecture

`server.ts` owns startup, database readiness, background dispatcher startup, and graceful shutdown. `app.ts` composes security headers, CORS, logging, rate limits, body parsing, routes, and error handling. `routes.ts` registers the versioned API modules.

Backend domains live under `backend/src/modules`. Established core modules generally use route/controller/service/repository/validation layers. Newer workflow modules often use route/service/validation layers and may access Prisma directly. Any normalization of these boundaries must be incremental and test-protected.

## Authentication and organization isolation

Users belong to organizations through `OrganizationMembership`. Refresh sessions are tied to a membership. Access tokens identify a user, membership, and organization, but every protected request reloads the active context from the database.

The authenticated request context contains `userId`, `membershipId`, `organizationId`, role code and permissions, platform-administrator status, and effective service access mode where applicable.

Tenant-owned identifiers are never trusted from frontend state. Backend queries must scope records using the authenticated `organizationId`, validate related records against that organization, and return safe errors for inaccessible records. Service plans, organization service enablement, member assignments, permission checks, and read-only access are enforced by backend middleware.

## Business domains

The Prisma schema and backend include identity, organizations, memberships, permissions, plans, CRM, inquiries, projects, employees, finance, sales, quotations, payments, notifications, governance, automation, customer enquiry agents, the internal Business Operating Agent, service requests, websites, inventory, procurement, marketing, support, stay management, and school management.

System roles, permissions, services, and platform plans may be seeded. Tenant business data must not be seeded for newly registered organizations.

## Agents and integrations

The Customer Enquiry Agent handles restricted external customer conversations and organization-approved customer-facing knowledge. The Business Operating Agent is a separate authenticated internal assistant and must not expose information across organizations.

External channels are controlled by environment kill switches. Meta inbound and outbound processing remain separately gated. Agent actions are constrained by backend policy, approval, idempotency, human-takeover, usage-limit, and tenant-isolation controls.

## Deployment

The frontend is deployed to Vercel, the backend to Render, and PostgreSQL is hosted by Neon. Render uses `render.yaml`, `prisma migrate deploy`, and `/api/v1/ready` for readiness. Production secrets belong only in provider environment settings and must never be committed.

## Change discipline

Structural cleanup must use small reviewable commits. Preserve authentication, organization isolation, permission enforcement, API contracts, migration history, and existing behavior. Run typechecking, lint, focused tests, the complete backend test suite, and frontend/backend production builds before deployment.
