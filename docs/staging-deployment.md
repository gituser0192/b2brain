# B² Brain private staging deployment

This checklist prepares a private staging environment. It does not authorize a public launch or production customer migration.

## Architecture

- Frontend: Vercel project rooted at `frontend`
- Backend: Render Node web service built from the repository root
- Database: existing Neon PostgreSQL database
- Authentication: bearer access tokens plus an HttpOnly refresh cookie
- Access: Super-Admin invitation and approval only; public self-registration is not available
- Business Operating Agent: existing TypeScript reasoning with hosted AI and the Python service disabled for the first deployment
- External channels: disabled (`EXTERNAL_CHANNELS_ENABLED=false`, Meta inbound/outbound disabled)

Because the Vercel and Render hosts are different sites, the refresh cookie must use `Secure=true` and `SameSite=none`. Do not set `COOKIE_DOMAIN`: neither host may set a cookie for the other provider's domain.

## Environment-variable ownership

### Vercel

| Variable | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | No | Public Render API URL ending in `/api/v1` |

`NEXT_PUBLIC_*` values are embedded in browser code. Never put a password, token, database URL, or private key in them.

### Render backend: required for first staging

| Variable | Secret | Safe first-staging setting/purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `production` |
| `PORT` | No | Supplied by Render; do not override unless required |
| `FRONTEND_URL` | No | Exact stable HTTPS Vercel origin, without a trailing slash |
| `TRUST_PROXY` | No | `true`; Express trusts one Render proxy hop |
| `DATABASE_URL` | Yes | Neon pooled runtime URL with `sslmode=require` |
| `DIRECT_URL` | Yes | Neon direct migration URL with `sslmode=require` |
| `JWT_ACCESS_SECRET` | Yes | Independent random value of at least 32 characters |
| `REFRESH_TOKEN_SECRET` | Yes | Different independent random value of at least 32 characters |
| `SUPER_ADMIN_EMAIL` | Sensitive configuration | Approved platform administrator email |
| `BRIDGE_ENCRYPTION_KEY` | Yes | Independent strong key for encrypted connector credentials |

These validated defaults may be set explicitly for operational clarity: `JSON_BODY_LIMIT=1mb`, `API_RATE_LIMIT_WINDOW_MS=900000`, `API_RATE_LIMIT_MAX=1000`, `JWT_ACCESS_EXPIRES_IN=15m`, `REFRESH_TOKEN_EXPIRES_IN=30d`, `COOKIE_NAME=b2brain_refresh`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `PASSWORD_HASH_COST=12`. Leave `COOKIE_DOMAIN` unset on provider-owned domains.

### First-deployment kill switches (required)

| Variable | Required value | Secret |
| --- | --- | --- |
| `EXTERNAL_CHANNELS_ENABLED` | `false` | No |
| `META_WHATSAPP_ENABLED` | `false` | No |
| `META_WHATSAPP_OUTBOUND_ENABLED` | `false` | No |
| `META_LEAD_ADS_ENABLED` | `false` | No |
| `META_LEAD_GRAPH_ENABLED` | `false` | No |
| `ENQUIRY_AI_MODE` | `deterministic` | No |
| `ENQUIRY_AI_KILL_SWITCH` | `true` | No |
| `WORKSPACE_AGENT_REASONING_BACKEND` | `typescript` | No |
| `PYTHON_AGENT_ENABLED` | `false` | No |
| `WORKSPACE_AI_PROVIDER` | `disabled` | No |
| `WORKSPACE_AI_KILL_SWITCH` | `true` | No |
| `WORKSPACE_AI_DETERMINISTIC_ONLY` | `true` | No |

### Optional services

- Email invitations/password reset: `SMTP_HOST` (non-secret), `SMTP_PORT` (non-secret), `SMTP_SECURE` (non-secret), `SMTP_USER` (secret), `SMTP_PASSWORD` (secret), and `EMAIL_FROM` (non-secret). Without valid SMTP credentials, external mail is not delivered.
- Python Agent, later only: `PYTHON_AGENT_SERVICE_URL` (sensitive), `PYTHON_AGENT_SERVICE_SECRET` (secret), `PYTHON_AGENT_TIMEOUT_MS`, and `PYTHON_AGENT_MAX_ITERATIONS`. They may remain absent while `PYTHON_AGENT_ENABLED=false` and `WORKSPACE_AGENT_REASONING_BACKEND=typescript`.
- Hosted AI, later only: `OPENAI_API_KEY` (secret), `ENQUIRY_AI_MODEL`, `WORKSPACE_AI_MODEL`, provider base URLs, timeouts, retries, token/request limits, circuit-breaker settings, tool-iteration limit, and cost estimates. Provider credentials and model names may remain absent while the kill switches above are active.
- Meta/WhatsApp Test Mode uses synthetic configuration and needs no real Meta secret. Real activation later requires the applicable `META_WHATSAPP_*` or `META_LEAD_*` verification/app/access secrets and identifiers. Keep them absent for first staging.

Do not reuse the JWT, refresh-token, and bridge-encryption secrets.

## Neon checklist

1. Open the existing staging branch in Neon. Do not use a production customer branch for first staging tests.
2. Copy the pooled connection string for `DATABASE_URL`; its hostname contains `-pooler`.
3. Copy the non-pooled connection string for `DIRECT_URL`.
4. Confirm both URLs contain `sslmode=require`; retain `channel_binding=require` when Neon supplies it.
5. Store both only in Render's secret environment settings.
6. Before the first deploy, create a Neon restore point or branch from the current state.
7. Never run `prisma migrate dev`, `prisma db push`, or reset against staging.
8. Review migration SQL, then run only `npm run prisma:deploy --workspace @b2brain/backend`.
9. If platform roles/services are absent, run `npm run seed:platform --workspace @b2brain/backend`. This seed is idempotent platform configuration and must not contain tenant business records.
10. Before connecting, inspect only the parsed hostname and database name (never print the full URL) and confirm the database name is not `b2brain_v2_dev`.
11. Run `npx prisma migrate status --schema backend/prisma/schema.prisma` with the staging URLs supplied through the operator's secure environment. Confirm all 71 migration directories are applied.

Runtime traffic uses the pooled `DATABASE_URL`; Prisma migrations use the direct `DIRECT_URL` declared by the schema. Before migration, create a Neon branch/restore point and record it in the release log. This task never runs either command against production.

## Synthetic staging data only

Do not export or copy the local Neon database, customer spreadsheets, message history, phone numbers, emails, invoices, or other customer records into staging.

1. Run the platform seed only after migrations.
2. From Super Admin, create two invitation-only organizations named `Beta Synthetic A` and `Beta Synthetic B` using dedicated test inboxes.
3. Approve both accounts and enable `B2BRAIN_AGENT` plus only the services needed by the smoke test.
4. Create invented customers, phone numbers reserved for testing, projects, invoices, expenses and activities through the UI/API.
5. Prefix every record with `STAGING-SYNTHETIC` and never use a real person's data.
6. Verify each organization cannot list, view, update, archive or reference the other organization's records.
7. Archive synthetic records through the application when the test ends; do not run database-wide delete or reset commands.

## Render checklist

The repository includes `render.yaml`, but do not apply the Blueprint until all secret values are ready.

1. Connect the Git repository and create a Node web service.
2. Keep the repository root as Render's root directory.
3. Disable automatic deployment for the first private staging release.
4. Build command: `npm ci --include=dev && npm run build:production --workspace @b2brain/backend`
5. Start command: `npm run start --workspace @b2brain/backend`
6. Health-check path: `/api/v1/ready`; this deliberately checks database connectivity. `/api/v1/health` is the non-database liveness endpoint.
7. Add every required Render environment variable listed above.
8. Confirm the Render environment shows all external, Meta, hosted-AI, and Python switches disabled before opening access.
9. Confirm logs are structured JSON and redact authorization, cookies, passwords, token hashes, API keys and full URLs.

The checked-in Blueprint selects the free plan and therefore intentionally omits `preDeployCommand`. A paid web service may configure `npm run prisma:deploy --workspace @b2brain/backend` as its Render pre-deploy command; Render runs it before activating the new version and keeps the previous successful deploy serving if it fails.

For a free service, do not hide migration inside the build or start command. Immediately before manually deploying the new backend commit, use a trusted local/CI environment with Node 22, the same commit checked out, dependencies installed, and staging `DATABASE_URL`/`DIRECT_URL` supplied securely. Run migration status, then `npm run prisma:deploy --workspace @b2brain/backend`, then migration status again. Deploy only after it reports all 71 migrations applied. If migration fails, do not deploy the new backend; keep the current service active, preserve the logs, and investigate or restore from the prepared Neon recovery point. Never retry with `migrate dev`, `db push`, or `migrate reset`.

## Vercel checklist

1. Use the existing Vercel project; do not create another one. Confirm its stable production URL in the Vercel dashboard before copying it to Render.
2. Set Root Directory to `frontend`.
3. Select the Next.js framework preset.
4. Keep the build command as `npm run build` and output configuration as the Next.js default.
5. Set `NEXT_PUBLIC_API_URL` to the HTTPS Render URL ending in `/api/v1`.
6. Deploy the production environment to obtain the stable staging URL.
7. Copy that exact origin into Render as `FRONTEND_URL`, then redeploy Render.
8. Redeploy Vercel once more if the Render URL changed.

After deployment, inspect the browser Network panel on sign-in and confirm requests target the Render HTTPS host rather than `localhost`. The API client sends credentials; successful sign-in must set the Render-hosted HttpOnly refresh cookie with `Secure` and `SameSite=None`. Verify refresh on a non-dashboard route, browser Back/Forward, sign-out cookie removal, and unauthenticated protected-route redirection.

## Python Agent deployment boundary

The Python reasoning service is not part of the first staging deployment. The TypeScript backend remains fully functional with `WORKSPACE_AGENT_REASONING_BACKEND=typescript` and `PYTHON_AGENT_ENABLED=false`. Do not configure its URL/secret, add an `agent-service` Render service, or enable a hosted provider now. Deploy it separately in a later reviewed change if Python reasoning is authorized.

Do not use a temporary Vercel preview URL as `FRONTEND_URL`; preview hostnames change. Use the stable project production URL for private staging.

## Smoke test

1. `GET <render>/api/v1/health` returns `{ status: "healthy" }`.
2. `GET <render>/api/v1/ready` returns `{ status: "ready" }`.
3. An unapproved origin receives no CORS access header.
4. Super Admin creates an invitation and the email link points to Vercel, not localhost.
5. Register one dedicated staging organization and complete onboarding.
6. Sign in, refresh the browser, sign out, and sign in again.
7. Create a customer, project/task, invoice/payment, expense, and service request.
8. Confirm dashboard totals use those records.
9. Repeat with another organization and verify no record IDs or totals cross tenants.
10. Test an owner and a read-only member in different browser profiles.
11. Test password reset and invitation email delivery.
12. Inspect browser console, Render logs, and Neon monitoring for errors without copying secrets into tickets or chat.
13. Ask a simple deterministic agent question and confirm token usage remains zero.
14. Ask a complex analysis question and confirm it produces a clearly labeled deterministic response without a hosted-provider call.
15. Confirm `/webhooks/intake`, `/webhooks/whatsapp`, and `/public/forms` return 404 while external channels are disabled.

## Private-beta gate

- Keep Vercel's stable staging URL unadvertised and distribute it only to approved testers.
- Accounts remain invitation-only and require Super Admin approval.
- Invite only dedicated beta email addresses; revoke expired or unused invitations.
- Enable `B2BRAIN_AGENT` per organization in Super Admin and assign it only to intended memberships.
- Use separate browser profiles for owners and members.
- Do not enable Meta, public forms, external intake webhooks, or customer-facing enquiry AI during this stage.
- Vercel Deployment Protection may be enabled for an additional outer access gate; ensure Render CORS still names the stable Vercel origin.

## Rollback

### Application rollback

1. Disable automatic deploys.
2. In Vercel, promote the last known-good deployment.
3. In Render, roll back to the last successful deploy.
4. Re-run `/health`, `/ready`, sign-in, and a read-only dashboard smoke test.

Application rollback cannot reverse an already-applied database migration. Roll back application code only when the migrated schema remains backward-compatible.

### Database rollback

Prisma production migrations are forward-only. Do not delete migration rows or run destructive down scripts manually.

1. If a deploy fails before migrations complete, keep the previous Render version active and inspect the failed migration.
2. If a compatible migration succeeded but application code failed, roll back application code only.
3. If a migration caused data corruption or an incompatible schema, stop writes, preserve logs, and restore or promote the pre-deploy Neon branch/restore point.
4. Update both Render database URLs if a restored Neon branch has a different endpoint.
5. Verify migration status and the complete smoke test before reopening staging.

### Future hosted-AI rollback

Hosted AI is disabled for the first deployment. If it is enabled in a later release:

1. Set `WORKSPACE_AI_KILL_SWITCH=true`, `WORKSPACE_AI_PROVIDER=disabled`, and `WORKSPACE_AI_DETERMINISTIC_ONLY=true` in Render, then redeploy.
2. Verify deterministic customer counts, finance summaries, health calculations and other tools still work.
3. Complex analysis must show the verified-data fallback and must not lose the original request.
4. Investigate provider errors using redacted request IDs and usage diagnostics; never paste prompts, keys or complete business payloads into tickets.

## Release record

For every staging release, record the Git commit, Vercel deployment ID, Render deployment ID, Neon branch/restore point, migration count, operator, start time, completion time, and smoke-test result. Never record secret values.
