# B2Brain-B

Clean Version 2 foundation for B² Brain. The frontend and backend are independent npm workspaces, supported by small shared packages.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL-compatible connection string only when database-backed development begins

## Start locally

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Copy `backend/.env.example` to `backend/.env` and add development-only secrets. A database connection is not made on startup.
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

No production database migration or connection belongs in foundation setup.
