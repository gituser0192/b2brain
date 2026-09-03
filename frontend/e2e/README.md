# Frontend browser and visual safety harness

This Playwright suite protects future route, CSS, and component restructuring. It never uses Neon or production credentials: `/api/v1` requests are intercepted by a controlled fixture using reserved `example.test` identities and deterministic IDs.

## Local setup

From the repository root:

```powershell
npm install
npx playwright install chromium
npm run test:e2e
```

The configuration starts the frontend at `http://localhost:3000`. Set `PLAYWRIGHT_SKIP_WEBSERVER=1` to reuse an already running frontend, or `PLAYWRIGHT_BASE_URL` to use another local origin.

Environment variable names (no values are stored here):

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_SKIP_WEBSERVER`
- `CI`

No database, backend, password, token, or provider environment variable is required.

## Commands

- `npm run test:e2e` — headless journeys and visual tests
- `npm run test:e2e:headed` — visible browser run
- `npm run test:e2e:debug` — Playwright Inspector
- `npm run test:e2e:update` — intentionally regenerate screenshot baselines

Do not update screenshots merely because a test failed. Open `playwright-report/index.html`, inspect expected/actual/diff images at all three viewports, confirm the change is intentional, then update and review the PNG diff in Git.

The browser fixtures validate frontend behavior, route state, permission-driven controls, and rendering. Backend authorization and tenant isolation remain covered by backend tests.
