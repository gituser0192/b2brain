# B² Brain private staging deployment

This checklist prepares a private staging environment. It does not authorize a public launch or production customer migration.

## Architecture

- Frontend: Vercel project rooted at `frontend`
- Backend: Render Node web service built from the repository root
- Database: existing Neon PostgreSQL database
- Authentication: bearer access tokens plus an HttpOnly refresh cookie

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
| `META_GRAPH_API_VERSION` | Meta API version when WhatsApp is enabled |
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
7. Never run `prisma migrate dev`, `prisma db push`, reset, or the business-data seed against staging.

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

## Release record

For every staging release, record the Git commit, Vercel deployment ID, Render deployment ID, Neon branch/restore point, migration count, operator, start time, completion time, and smoke-test result. Never record secret values.
