# B2Brain-B

Clean Version 2 foundation for B² Brain. The frontend and backend are independent npm workspaces, supported by small shared packages.

## Requirements

- Node.js 22.x
- npm 10+
- PostgreSQL-compatible connection string

## Start locally

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Copy `backend/.env.example` to `backend/.env` and add development-only secrets, including a PostgreSQL connection string. The backend verifies database readiness during startup.
3. Run `npm run dev:frontend` for http://localhost:3000.
4. Run `npm run dev:backend` for http://localhost:5000.

The backend health endpoint is `GET http://localhost:5000/api/v1/health`.

## Commands

- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run build:frontend`
- `npm run build:backend`
- `npm run typecheck`
- `npm run lint`

Production deployments must use reviewed migrations through `npm run prisma:deploy --workspace @b2brain/backend`; never use development reset commands against staging or production.
