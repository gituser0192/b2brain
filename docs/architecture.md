# Architecture

## Application boundaries

The **frontend** is an independent Next.js application responsible for browser rendering, interaction, and calls to the versioned backend API. The **backend** is an independent Express application responsible for authentication, authorization, business rules, persistence, and external integrations. The **packages** workspace contains deliberately small, secret-free contracts shared across applications: API/domain types, genuinely shared validation, permission vocabulary, and non-secret configuration.

Dependencies must point toward shared packages; shared packages must not import either application or one another in cycles.

## Dashboard separation

- **Customer dashboard:** tenant-scoped experience for organization owners, organization admins, managers, sales, HR, accountants, and employees. Visibility depends on organization, enabled services, and permissions.
- **Admin dashboard:** future internal B² Brain operations workspace for onboarding, service/support/website/marketing requests, subscription assistance, and organization health.
- **Super Admin dashboard:** future platform-owner workspace for organizations, admins, services, plans, subscriptions, feature flags, entitlements, platform settings, audit logs, and suspension.

These are separate route boundaries. This foundation does not implement dashboards or access control.

## Multi-tenant ownership

Tenant-owned records must eventually carry `organizationId`, timestamps, and, where appropriate, `createdById`, `updatedById`, and `deletedAt`. Every tenant query must enforce organization scope on the server; client-side filtering is not a security boundary. Cross-tenant and platform actions require explicit authorization and auditable behavior.

## Service catalogue

Services describe software capabilities; they do not generate code. A future module is registered as a service, configured by a Super Admin, included in a plan, entitled to an organization, then exposed to a user only when permissions allow. Navigation derives from those effective entitlements and permissions.

Reserved backend boundaries include Service, Plan, PlanService, OrganizationService, Subscription, FeatureFlag, and Entitlement.

## Database strategy

Use one Neon PostgreSQL database with separate domain tables, not one database per module. The future schema may include organizations, users, memberships, roles, permissions, service-catalogue records, subscriptions, CRM customers, projects, tasks, finance records, employees, notifications, activity logs, and audit logs.

The Prisma file is intentionally model-free. No connection, introspection, push, reset, or migration is performed during foundation setup. Every future migration requires review before it reaches the existing database.

## Development order

1. Project foundation
2. Shared error and response standards
3. Authentication
4. Organizations
5. Organization memberships
6. Roles and permissions
7. Service catalogue
8. Plans and entitlements
9. Dynamic navigation
10. CRM
11. Projects
12. Tasks
13. Finance
14. Employees
15. Analytics
16. Customer dashboard
17. Admin dashboard
18. Super Admin dashboard
19. Subscriptions
20. Notifications
21. Testing
22. Deployment
