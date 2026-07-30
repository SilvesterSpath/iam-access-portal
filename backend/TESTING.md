# Backend tests

## Prerequisites

1. Postgres running (e.g. `docker compose up db -d`, or any Postgres on port `5432`)
2. A dedicated test database:

```powershell
docker compose exec db psql -U postgres -c "CREATE DATABASE access_portal_test;"
# or, if using a standalone container named access-portal-db:
# docker exec access-portal-db psql -U postgres -c "CREATE DATABASE access_portal_test;"
```

3. Apply migrations to the test DB:

```powershell
cd backend
$env:NODE_OPTIONS='--experimental-require-module'
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/access_portal_test?schema=public'
npx prisma migrate deploy
```

4. Copy env file if needed:

```powershell
Copy-Item .env.test.example .env.test
```

`.env.test` must point at `access_portal_test` (not the dev DB). The test setup refuses to run otherwise.

## Run

```powershell
cd backend
npm test
```
