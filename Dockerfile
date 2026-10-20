# syntax=docker/dockerfile:1

# Image unique : l'API NestJS sert aussi les deux fronts Angular
# (front office sur /, back office sur /gestion/, API sur /api).

FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contract/package.json packages/contract/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/application/package.json packages/application/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/front-office/package.json apps/front-office/package.json
COPY apps/back-office/package.json apps/back-office/package.json
COPY e2e/package.json e2e/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Ordre topologique : packages, puis api (avec `prisma generate`) et fronts.
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# On reprend node_modules du stage de build (liens du workspace pnpm, CLI Prisma pour les
# migrations) plutôt qu'un `pnpm install --prod` séparé, comme pour Agilometre.
COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/contract/package.json packages/contract/package.json
COPY --from=build /repo/packages/contract/dist packages/contract/dist
COPY --from=build /repo/packages/domain/package.json packages/domain/package.json
COPY --from=build /repo/packages/domain/dist packages/domain/dist
COPY --from=build /repo/packages/application/package.json packages/application/package.json
COPY --from=build /repo/packages/application/node_modules packages/application/node_modules
COPY --from=build /repo/packages/application/dist packages/application/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /repo/apps/front-office/dist/front-office/browser apps/api/public/front-office
COPY --from=build /repo/apps/back-office/dist/back-office/browser apps/api/public/back-office

WORKDIR /repo/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Migrations appliquées à chaque démarrage (idempotent) ; `exec` fait de Node le PID 1
# pour un arrêt propre (enableShutdownHooks).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
