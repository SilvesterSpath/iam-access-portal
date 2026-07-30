FROM node:22.14-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Prisma generate needs a URL present for config loading; DB need not be reachable at build time.
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/access_portal?schema=public"
ENV NODE_OPTIONS="--experimental-require-module"

RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh \
  && npx prisma generate

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
