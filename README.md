# Access Provisioning & Audit Portal

Minimal prototype of an internal administration tool for assigning user roles and reviewing an audit history of who changed what access, and when.

Stack: **TypeScript**, **Node.js / Express**, **PostgreSQL (Prisma)**, **Vue 3**, **Docker Compose**.

---

## Run with Docker (recommended for reviewers)

From the repository root:

```bash
docker compose up --build
```

Then open:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health check:** http://localhost:3000/health

On first start the backend waits for Postgres, runs migrations, seeds demo roles/users, then serves the API. The frontend container waits until the backend health check (`GET /health`) passes, so the UI should not appear before the API is ready.

### Troubleshooting

- Free ports **5432**, **3000**, and **5173** if something else is already using them (local `npm run dev`, another Postgres container, etc.).
- Docker Desktop (WSL 2 backend on Windows) must be running.

Stop with `Ctrl+C`, or in another terminal: `docker compose down`.

---

## Run locally (without Compose for the app)

### Prerequisites

- Node.js **20.19+** or **22.12+** (Prisma 7)
- PostgreSQL 16 reachable at localhost (Compose `db` service or any local Postgres)

### Database

Create a database named `access_portal`, then in `backend/`:

```bash
cp .env.example .env
# edit DATABASE_URL if needed
```

Default URL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/access_portal?schema=public"
```

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

API: http://localhost:3000

> On some Node 22.x versions, Prisma CLI may need:
> `NODE_OPTIONS=--experimental-require-module`
> (already set in Compose; npm scripts for migrate/generate/seed include it).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173  
Vite proxies `/api` to `http://localhost:3000`.

---

## Tests

Backend tests use **Vitest + Supertest** against a real Postgres database (`access_portal_test`). Prisma is not mocked.

### One-time test DB setup

With Postgres running (e.g. the Compose `db` service on port 5432):

```bash
# create DB (example via docker)
docker compose exec db psql -U postgres -c "CREATE DATABASE access_portal_test;"

cd backend
cp .env.test.example .env.test

# apply migrations to the test DB
# PowerShell:
$env:NODE_OPTIONS='--experimental-require-module'
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/access_portal_test?schema=public'
npx prisma migrate deploy
```

More detail: [`backend/TESTING.md`](backend/TESTING.md).

### Run

```bash
cd backend
npm test
```

The suite covers role replace-set + audit, invalid role rollback, duplicate roleId normalization, and user-creation audit.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List users with assigned roles |
| `POST` | `/api/users` | Create user (`name`, `email`, optional `roleIds`); writes `USER_CREATED` audit in the same transaction |
| `PUT` | `/api/users/:id/roles` | Replace the user’s full role set (`{ "roleIds": string[] }`); writes `ROLES_UPDATED` audit in the same transaction |
| `GET` | `/api/roles` | List roles |
| `GET` | `/api/audit-logs` | Chronological audit history (newest first) |

Role IDs are deduplicated before validation and persistence. Unknown role IDs return `400` with no role or audit changes.

---

## Architectural trade-offs

Because of the 6-hour timebox, I focused on a reliable vertical slice: normalized access-control schema, role-assignment updates, audit logging, Dockerized local setup, and a small backend test suite around the most important behavior. I intentionally kept authentication, advanced authorization, pagination, advanced UI styling, and production-grade observability out of scope, but structured the schema and API so these could be added later.

Authentication is out of scope for the prototype, so audit entries use a fixed demo operator, `ops@example.com`, as the actor. The schema keeps actor information explicit so it could later be connected to authenticated staff users.

The senior signal for this slice is **transactional role updates**: replacing a user’s roles and writing the audit log happen in one Prisma transaction, with replace-set semantics and normalized `roleIds`.
