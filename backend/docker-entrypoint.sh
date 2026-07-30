#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until node --input-type=module -e "import net from 'node:net'; const host=process.env.DB_HOST||'db'; const port=Number(process.env.DB_PORT||5432); const s=net.connect({host,port},()=>{s.end(); process.exit(0)}); s.on('error',()=>process.exit(1));"; do
  sleep 1
done
echo "Postgres is accepting connections."

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed

echo "Starting API..."
exec npx tsx src/index.ts
