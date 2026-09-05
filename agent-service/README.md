# Internal Business Operating Agent — Phase 1

## Architecture and ownership

Browser → existing authenticated Express API → signed Python `/v1/reason` → existing TypeScript response/audit storage.

Python never connects to Prisma, Neon, CRM APIs or business tools. No customer-enquiry or WhatsApp integration is added. The existing TypeScript provider remains the default; a Python failure uses its deterministic fallback without another billable retry. No schema or migration changes.

TypeScript owns active membership validation, tenant/service/permission checks, calculations, event reservation/idempotency, budgets, audit, confirmation and human-only policies. Python explains bounded aggregate facts. The external Customer Enquiry Agent and the frontend are unchanged.

Files are deliberately flat: `app/models.py` owns the contract; `config.py` configuration; `security.py` request authentication; `providers.py` fake/disabled/hosted reasoning; `main.py` HTTP endpoints. No empty API/core/framework scaffolding.

## Contract v1

Both Zod (`backend/src/modules/workspace-agent/workspace-agent.python-contract.ts`) and Pydantic reject unknown properties and incompatible versions. `tests/contract-v1.json` is read by both suites; the opt-in wire test exercises a real FastAPI process.

Request fields: `contractVersion`, `requestId` (lowercase UUID v4), `message`, `languageHint`, `shortConversationSummary`, `structuredBusinessFacts`, `calculatedHealthResults`, `calculatedFinancialResults`, `calculatedForecastResults`, `relevantProductHelp`, `allowedToolNames`, `permissionSafeRecordReferences`, `maximumToolIterations`, `responseConstraints`.

Facts contain only `id`, `label`, scalar `value`, `period`. They are permission-filtered aggregates, financial score/margin, cautious forecast bounds and goal progress/target/pace. No tenant/user/membership IDs, cookies, credentials or raw records. Raw historical messages are intentionally not forwarded: older conversations can contain data no longer permitted to the caller. Goal labels use business types, not free-text titles. Health-history change is explicitly unavailable.

Response fields: `contractVersion`, `requestId`, `answer`, `confidence`, `evidenceReferences`, `conclusions`, `recommendations`, `assumptions`, `missingInformation`, `proposedToolCalls`, `requiresConfirmation`, `requiresHumanEscalation`, `escalationReason`, `providerUsage`.

This initial slice grants **zero executable tool capabilities**. Allowed names, record references and proposed calls must be empty. TypeScript rejects every proposed write or arbitrary argument, including identity fields. It does not interpret recommendations as commands. Confirmation/escalation flags are advisory display state, not authorization. Existing explicit TypeScript actions and human escalation remain in their existing paths. One reasoning call maximum; no tool loop.

## Authentication and operational boundary

HMAC-SHA256 covers UTF-8 bytes of `POST\n/v1/reason\nTIMESTAMP\nREQUEST_ID\nBODY`. Headers: `X-Agent-Timestamp`, `X-Agent-Request-Id`, `X-Agent-Signature`. The UUID in the signed header must equal the body ID. Timestamp skew is bounded to 60 seconds. Comparison is constant time; accepted nonces live for 121 seconds, including failed provider calls. A new retry gets a new transport ID; business idempotency remains TypeScript's existing durable integration event.

Run **one Python worker/replica**. Replay, rate and circuit state are process-local. Production warms up for 121 seconds after restart to reject captured requests from the previous process. Horizontal scaling requires a shared atomic nonce/rate store first. No production database is used for this cache.

Outside local loopback development, TypeScript requires HTTPS. Production Python also checks HTTPS. Terminate TLS at a restricted trusted ingress and configure Uvicorn `--forwarded-allow-ips` with only that proxy's IP. Never use a wildcard on an Internet-accessible service. Do not expose this port to browsers; no CORS policy or public documentation endpoints are enabled. Firewall/internal ingress restrictions and connection/time limits remain deployment responsibilities.

Requests are capped at 32 KiB; provider input has a separate conservative UTF-8 byte/token ceiling and outputs have a configured token ceiling and 64 KiB byte limit. Authenticated requests are capped at 30/minute per service process. Zero automatic hosted retries avoids double billing after uncertain timeouts. Circuit opens after three failures for 60 seconds. Readiness probes check provider/model availability, cache for 30 seconds, and never generate billable text.

Only event type, transport request UUID and response source are logged. Uvicorn access logging is disabled in commands below. Provider bodies, error text, keys and prompts are not logged. Do not enable HTTP wire/debug logs in production.

TypeScript reuses organization-scoped event usage with conservative 36,000-token reservations for in-flight/failed/uncertain requests. This can block early, but prevents assuming that a timeout was free. At the 5,000-event scan ceiling Python fails closed. The existing TypeScript-only accounting is unchanged. Historical events must be retained for the configured accounting window. Provider account spend caps are still recommended; audit failure and external billing require reconciliation before production use.

## Providers

- `disabled`: readiness 503; TypeScript stays usable.
- `fake`: deterministic synthetic explanation, explicitly `DETERMINISTIC_FALLBACK`, zero tokens. Not real AI.
- `openai`: existing OpenAI Responses API, strict JSON schema, `store: false`, HTTPX timeout, circuit breaker and usage validation. A model/key must be configured locally in the Python process. The adapter has been tested with mocked provider HTTP responses, not real credentials.

Structured output guidance: https://developers.openai.com/api/docs/guides/structured-outputs

Evidence IDs and numeric claims are checked server-side. This is conservative validation, **not proof that arbitrary generated prose is true**. Unsupported numbers fail safely; rounding/numbered plans can cause false rejection. No unsupported prices/policies should be requested or trusted. A live provider needs adversarial and grounding evaluation before rollout.

## Windows local setup (Python 3.11)

Run from the repository root:

```powershell
python -m venv agent-service/.venv
agent-service/.venv/Scripts/python.exe -m pip install -c agent-service/constraints.txt -e "agent-service[dev]"
```

Set an independently generated random secret in the Python and backend process environments, with the same value in each. Do not paste it into chat or source control. The `.env.example` is documentation only; Python does not automatically load `.env` files. Supply variables in the terminal or secret manager.

In the Python terminal, set `AGENT_PROVIDER` to `fake`, `AGENT_ENV` to `development`, and `PYTHON_AGENT_SERVICE_SECRET` privately, then:

```powershell
cd agent-service
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
```

Backend environment:

```dotenv
WORKSPACE_AGENT_REASONING_BACKEND=python
PYTHON_AGENT_ENABLED=true
PYTHON_AGENT_SERVICE_URL=http://127.0.0.1:8000
PYTHON_AGENT_TIMEOUT_MS=15000
PYTHON_AGENT_MAX_ITERATIONS=1
WORKSPACE_AI_KILL_SWITCH=false
WORKSPACE_AI_DETERMINISTIC_ONLY=false
```

Also supply the same `PYTHON_AGENT_SERVICE_SECRET` privately. Existing backend authentication/database variables remain unchanged. Do not copy production customer data for tests. Then, in separate root terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

Emergency disable: set `WORKSPACE_AI_KILL_SWITCH=true` and restart the backend. To return to the original path set `WORKSPACE_AGENT_REASONING_BACKEND=typescript` and `PYTHON_AGENT_ENABLED=false`, then restart. Existing TypeScript provider configuration determines hosted vs deterministic behaviour.

### Environment variable names

Backend additions: `WORKSPACE_AGENT_REASONING_BACKEND`, `PYTHON_AGENT_ENABLED`, `PYTHON_AGENT_SERVICE_URL`, `PYTHON_AGENT_SERVICE_SECRET`, `PYTHON_AGENT_TIMEOUT_MS`, `PYTHON_AGENT_MAX_ITERATIONS`.

Existing backend controls used: `WORKSPACE_AI_KILL_SWITCH`, `WORKSPACE_AI_DETERMINISTIC_ONLY`, `WORKSPACE_AI_MAX_OUTPUT_TOKENS`, `WORKSPACE_AI_DAILY_REQUEST_LIMIT`, `WORKSPACE_AI_DAILY_TOKEN_LIMIT`, `WORKSPACE_AI_MONTHLY_TOKEN_LIMIT`, `WORKSPACE_AI_INPUT_COST_PER_MILLION_USD`, `WORKSPACE_AI_OUTPUT_COST_PER_MILLION_USD`.

Python: `AGENT_ENV`, `AGENT_PROVIDER`, `PYTHON_AGENT_SERVICE_SECRET`, `OPENAI_API_KEY`, `AGENT_MODEL`, `AGENT_PROVIDER_TIMEOUT_SECONDS`, `AGENT_MAX_OUTPUT_TOKENS`, `AGENT_MAX_INPUT_BYTES`.

Opt-in synthetic integration test only: `PYTHON_AGENT_TEST_URL`.

## Verification commands

```powershell
cd agent-service
.venv/Scripts/python.exe -m ruff format --check app tests
.venv/Scripts/python.exe -m ruff check app tests
.venv/Scripts/python.exe -m mypy app
.venv/Scripts/python.exe -m pytest -q
cd ..
npm test --workspace @b2brain/backend
npm run lint --workspace @b2brain/backend
npm run typecheck --workspace @b2brain/backend
npm run build --workspace @b2brain/backend
npm run typecheck --workspace @b2brain/frontend
npm run build --workspace @b2brain/frontend
git diff --check
```

Wire test: start a separate fake-only Python process on loopback port 8017 using the **synthetic test-only secret from `tests/test_service.py`**, never a deployment secret. Set `PYTHON_AGENT_TEST_URL=http://127.0.0.1:8017` in the test terminal and run `npm test --workspace @b2brain/backend -- tests/workspace-agent.python-live.test.ts`. Without this explicit opt-in the one wire test is skipped. No database or real account is used.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/ready
docker build -t b2brain-agent:phase1 agent-service
```

For a local container smoke test, provide `AGENT_ENV=development`, `AGENT_PROVIDER=fake` and the secret in your shell; run:

```powershell
docker run --rm --name b2brain-agent-phase1 -p 127.0.0.1:8000:8000 -e AGENT_ENV -e AGENT_PROVIDER -e PYTHON_AGENT_SERVICE_SECRET b2brain-agent:phase1
docker inspect --format '{{.State.Health.Status}}' b2brain-agent-phase1
```

Docker verification passed: the image built, the container started, `/health` returned 200, disabled-provider `/ready` returned 503 as expected, the process ran as non-root UID 10001 without database access or application secrets, and the container stopped cleanly. No Jenkins, Kubernetes or deployment manifests were added.

## Manual checks

Use synthetic organizations/accounts with the required services and permissions. The live application's default configuration has not been changed by this task.

1. With Python disabled, count customers and open the brief; original TypeScript behaviour remains.
2. Enable fake Python locally. Ask the five Phase-1 examples: falling business health, first improvement, financial score explanation, monthly revenue goal plan, and Hinglish leads/conversion/overdue follow-ups.
3. Confirm fallback attribution and visible evidence. Missing historical health change must not become an asserted trend. Financial/goal facts require corresponding access.
4. Ask a simple count or overdue-task query; no Python call should occur.
5. Stop Python and repeat a complex query; TypeScript fallback should complete. Existing write actions must remain unaffected.
6. Repeat the same external message ID through the supported API; existing response is returned without another action.
7. Repeat with another synthetic organization and a restricted employee. No previous tenant/permission facts should appear.
8. Do not expect Python to execute tasks, refunds, payments, approvals or escalations in Phase 1; all proposed tools are rejected.

## Remaining work / Phase 2

This is an explanation-only vertical slice, not a new autonomous execution engine. Rich permission-safe multi-turn summaries, tool-result loops, and authorized tool proposals need a separately reviewed extension of the contract. No raw conversation history is sent yet. Existing explicit TypeScript CRUD/confirmation/human routes stay authoritative.

Before staging enablement: evaluate a real configured model with synthetic tenants, confirm trusted TLS ingress, test restart warmup and harden shared replay/accounting before multiple replicas. Review dependency deprecation warnings (Starlette's HTTPX TestClient and AnyIO portal); don't hide them or add another HTTP library solely to suppress warnings.

## Implementation verification — 2026-09-03

- Python: 22 pytest cases passed; Ruff lint/format checks passed; mypy strict passed for all six application modules.
- Backend: 364 tests passed across 78 test files with the synthetic wire test enabled. Default runs skip only that opt-in wire test. Full backend ESLint, typecheck and production TypeScript build passed.
- A real local FastAPI process accepted the signed TypeScript request and returned a validated fake-provider response; `/health` and `/ready` returned successful status. Temporary test server was stopped afterward.
- Frontend typecheck and production build passed. Initial checks exposed a pre-existing duplicate declaration in generated `.next/dev/types/routes.d.ts`; stale generated types were preserved under ignored `.codex-artifacts/phase1-old-next-dev-types` and isolated from production compilation. No frontend source, `next-env.d.ts`, CSS or baseline changes.
- Docker verification passed: image build and container startup succeeded; `/health` returned 200; disabled-provider `/ready` returned the expected 503; the container ran as non-root UID 10001 without database access or application secrets and stopped cleanly.
- Real hosted AI has NOT been activated or tested. Python provider tests use synthetic/mock responses only.
- `git diff --check` passed. No database migrations, commits, pushes or deployments.

Changed existing files:

- `.gitignore`
- `backend/.env.example`
- `backend/src/config/env.ts`
- `backend/src/modules/workspace-agent/workspace-agent.provider.ts`
- `backend/src/modules/workspace-agent/workspace-agent.router.ts`
- `backend/src/modules/workspace-agent/workspace-agent.service.ts`
- `backend/tests/workspace-agent.test.ts`

New backend files:

- `backend/src/modules/workspace-agent/workspace-agent.python-contract.ts`
- `backend/src/modules/workspace-agent/workspace-agent.python.ts`
- `backend/tests/workspace-agent.python.test.ts`
- `backend/tests/workspace-agent.python-live.test.ts`

New service files:

- `agent-service/app/__init__.py`, `config.py`, `main.py`, `models.py`, `providers.py`, `security.py`
- `agent-service/tests/contract-v1.json`, `test_service.py`
- `agent-service/pyproject.toml`, `constraints.txt`, `.env.example`, `.dockerignore`, `Dockerfile`, `README.md`

The Ponytail approach kept this integration behind the existing provider interface and avoided new agent frameworks, duplicate tool executors, or empty package directories. Full executable tool proposals and safe multi-turn reasoning are explicitly deferred, not claimed as implemented.
