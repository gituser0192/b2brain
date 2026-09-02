# Structural refactoring plan

B² Brain Version 2 is an active application. Structural changes must preserve its frontend behavior, API contracts, authentication, organization isolation, database data, and migration history.

The current maintainability cleanup separates oversized frontend workspaces into domain-owned presentation components while leaving state and API orchestration stable. Each extraction is verified and committed independently.

Future structural work should proceed in this order:

1. Add browser-level journey and visual-regression coverage.
2. Establish shared design tokens and global CSS foundations.
3. Split feature-specific styles from `globals.css` while preserving cascade order.
4. Continue frontend component extraction one feature at a time.
5. Normalize backend module boundaries behind characterization tests.
6. Consolidate genuinely shared validation and tenant-scoped data-access patterns.
7. Evaluate Prisma multi-file schema organization without changing models or migrations.
8. Remove confirmed dead code only after import, runtime, and test verification.

Never use destructive Prisma commands for cleanup. Production migrations use `prisma migrate deploy`. Every phase requires a rollback commit and must pass typechecking, lint, relevant tests, the complete backend suite, and both production builds.
