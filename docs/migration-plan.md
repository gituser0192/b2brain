# Migration plan

The current B² Brain project remains untouched and operational. Version 2 will not be produced through a blind copy.

Each feature will be audited first: behavior, dependencies, data ownership, permissions, API contracts, and tests. It will then be redesigned or moved into its intended boundary. Database migrations must be reviewed for tenant safety, compatibility, rollback strategy, and production impact before execution. No destructive Prisma command is part of this process.

A feature must pass its type checks, lint rules, focused tests, integration checks, and relevant builds before migration proceeds to the next feature. Shared standards come before Authentication, which is the recommended first business module only after this foundation is approved.
