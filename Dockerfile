# ── Stage 1: Install dependencies ──
FROM node:22-slim AS deps

RUN corepack enable pnpm

# Native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build the application ──
FROM deps AS build

COPY . .
RUN pnpm build

# ── Stage 3: Production image ──
FROM node:22-slim AS production

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Install Chromium + system dependencies for Playwright
RUN npx playwright install --with-deps chromium

# Copy build output and migration files
COPY --from=build /app/.output ./.output
COPY --from=build /app/lib/db/migrations ./lib/db/migrations

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/jobs.db

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
