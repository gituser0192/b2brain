# B² Brain private staging deployment

This checklist prepares a private staging environment. It does not authorize a public launch or production customer migration.

## Architecture

- Frontend: Vercel project rooted at `frontend`
- Backend: Render Node web service built from the repository root
- Database: existing Neon PostgreSQL database
- Authentication: bearer access tokens plus an HttpOnly refresh cookie
- Access: Super-Admin invitation and approval only; public self-registration is not available
- Business Operating Agent: hosted reasoning for selected analysis routes with deterministic fallback
- External channels: disabled (`EXTERNAL_CHANNELS_ENABLED=false`, Meta inbound/outbound disabled)

Because the Vercel and Render hosts are different sites, the refresh cookie must use `Secure=true` and `SameSite=none`. Do not set `COOKIE_DOMAIN`: neither host may set a cookie for the other provider's domain.

## Required environment variables

### Vercel

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public Render API URL ending in `/api/v1` |

`NEXT_PUBLIC_*` values are embedded in browser code. Never put a password, token, database URL, or private key in them.

### Render

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Must be `production` |
| `PORT` | Supplied by Render; the app reads it automatically |
| `FRONTEND_URL` | Exact HTTPS Vercel staging origin, without a trailing slash |
| `TRUST_PROXY` | Must be `true` behind Render's proxy |
| `EXTERNAL_CHANNELS_ENABLED` | Must be `false` for private staging |
| `JSON_BODY_LIMIT` | Global JSON request limit, recommended `1mb` |
| `API_RATE_LIMIT_WINDOW_MS` | Global API limiter window |
| `API_RATE_LIMIT_MAX` | Global requests allowed per IP/window |
| `DATABASE_URL` | Neon pooled runtime URL with `sslmode=require` |
| `DIRECT_URL` | Neon direct migration URL with `sslmode=require` |
| `JWT_ACCESS_SECRET` | Random secret of at least 32 characters |
| `JWT_ACCESS_EXPIRES_IN` | Access-token duration, recommended `15m` |
| `REFRESH_TOKEN_SECRET` | A different random secret of at least 32 characters |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh duration, recommended `30d` |
| `COOKIE_NAME` | Refresh-cookie name, recommended `b2brain_refresh` |
| `COOKIE_SECURE` | Must be `true` |
| `COOKIE_SAME_SITE` | Must be `none` for Vercel-to-Render staging |
| `COOKIE_DOMAIN` | Leave unset for provider-owned domains |
| `PASSWORD_HASH_COST` | Password cost, recommended `12` |
| `SUPER_ADMIN_EMAIL` | Approved B² Brain platform administrator email |
| `BRIDGE_ENCRYPTION_KEY` | Strong random key for encrypted connector credentials |
| `META_WHATSAPP_ENABLED` | Must be `false` |
| `META_WHATSAPP_OUTBOUND_ENABLED` | Must be `false` |
| `ENQUIRY_AI_MODE` | Keep `deterministic` while external customer channels are disabled |
| `ENQUIRY_AI_KILL_SWITCH` | Keep `true` for private staging |
| `WORKSPACE_AI_PROVIDER` | Hosted provider selector, currently `openai` |
| `WORKSPACE_AI_KILL_SWITCH` | Emergency hosted-reasoning shutdown switch |
| `WORKSPACE_AI_DETERMINISTIC_ONLY` | `false` to permit selected hosted analysis routes |
| `WORKSPACE_AI_MODEL` | Hosted structured-output model name |
| `WORKSPACE_AI_BASE_URL` | Hosted provider API base URL |
| `OPENAI_API_KEY` | Hosted provider secret; Render only |
| `WORKSPACE_AI_TIMEOUT_MS` | Per-provider-call timeout |
| `WORKSPACE_AI_MAX_RETRIES` | Bounded provider retry count |
| `WORKSPACE_AI_MAX_INPUT_CHARS` | Maximum grounded context size |
| `WORKSPACE_AI_MAX_OUTPUT_TOKENS` | Maximum model output tokens |
| `WORKSPACE_AI_DAILY_TOKEN_LIMIT` | Per-organization daily token ceiling |
| `WORKSPACE_AI_MONTHLY_TOKEN_LIMIT` | Per-organization monthly token ceiling |
| `WORKSPACE_AI_DAILY_REQUEST_LIMIT` | Per-organization daily hosted-request ceiling |
| `WORKSPACE_AI_MAX_TOOL_ITERATIONS` | Must remain `1`; proposed actions are not auto-executed |
| `WORKSPACE_AI_CIRCUIT_FAILURE_THRESHOLD` | Consecutive failures before circuit opens |
| `WORKSPACE_AI_CIRCUIT_RESET_MS` | Circuit cooling period |
| `WORKSPACE_AI_INPUT_COST_PER_MILLION_USD` | Provider input-token cost for internal estimation |
| `WORKSPACE_AI_OUTPUT_COST_PER_MILLION_USD` | Provider output-token cost for internal estimation |
| `SMTP_HOST` | SMTP hostname |
| `SMTP_PORT` | SMTP port |
| `SMTP_SECURE` | `true` for implicit TLS, otherwise `false` for STARTTLS |
| `SMTP_USER` | SMTP account username |
| `SMTP_PASSWORD` | SMTP account password or app password |
| `EMAIL_FROM` | Verified sender identity |

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
4. Build command: `npm ci && npm run build:production --workspace @b2brain/backend`
5. Pre-deploy command: `npm run prisma:deploy --workspace @b2brain/backend`
6. Start command: `npm run start --workspace @b2brain/backend`
7. Health-check path: `/api/v1/ready`
8. Add every Render environment variable listed above.
9. Deploy and wait for `/api/v1/health` and `/api/v1/ready` to return HTTP 200.
10. Confirm the Render environment shows Meta and external-channel flags as disabled before opening access.
11. Confirm logs are structured JSON and redact authorization, cookies, passwords, token hashes, API keys and secrets.

Render pre-deploy commands require an eligible paid service. If the selected plan does not support them, run the exact `prisma:deploy` command as a controlled one-off job immediately before deploying the web service. Do not replace it with `migrate dev` or `db push`.

## Vercel checklist

1. Import the same Git repository as a new Vercel project.
2. Set Root Directory to `frontend`.
3. Select the Next.js framework preset.
4. Keep the build command as `npm run build` and output configuration as the Next.js default.
5. Set `NEXT_PUBLIC_API_URL` to the HTTPS Render URL ending in `/api/v1`.
6. Deploy the production environment to obtain the stable staging URL.
7. Copy that exact origin into Render as `FRONTEND_URL`, then redeploy Render.
8. Redeploy Vercel once more if the Render URL changed.

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
14. Ask a complex analysis question and confirm it is labeled AI-assisted, cites organization facts and respects usage limits.
15. Turn `WORKSPACE_AI_KILL_SWITCH=true`, redeploy, and confirm the same complex request produces a clearly labeled deterministic fallback; restore it only after the check.
16. Confirm `/webhooks/intake`, `/webhooks/whatsapp`, and `/public/forms` return 404 while external channels are disabled.

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

### Database rollback

Prisma production migrations are forward-only. Do not delete migration rows or run destructive down scripts manually.

1. If a deploy fails before migrations complete, keep the previous Render version active and inspect the failed migration.
2. If a compatible migration succeeded but application code failed, roll back application code only.
3. If a migration caused data corruption or an incompatible schema, stop writes, preserve logs, and restore or promote the pre-deploy Neon branch/restore point.
4. Update both Render database URLs if a restored Neon branch has a different endpoint.
5. Verify migration status and the complete smoke test before reopening staging.

### Emergency AI rollback

1. Set `WORKSPACE_AI_KILL_SWITCH=true` in Render and redeploy.
2. Verify deterministic customer counts, finance summaries, health calculations and other tools still work.
3. Complex analysis must show the verified-data fallback and must not lose the original request.
4. Investigate provider errors using redacted request IDs and usage diagnostics; never paste prompts, keys or complete business payloads into tickets.

## Release record

For every staging release, record the Git commit, Vercel deployment ID, Render deployment ID, Neon branch/restore point, migration count, operator, start time, completion time, and smoke-test result. Never record secret values.
