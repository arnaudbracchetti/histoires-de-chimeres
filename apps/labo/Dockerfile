# syntax=docker/dockerfile:1
# PROTOTYPE (#59) : image du labo, construite depuis la racine du dépôt :
#   docker build -f apps/labo/Dockerfile -t chimeres-labo .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contract/package.json packages/contract/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/design/package.json packages/design/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/front-office/package.json apps/front-office/package.json
COPY apps/back-office/package.json apps/back-office/package.json
COPY apps/labo/package.json apps/labo/package.json
COPY e2e/package.json e2e/package.json

FROM manifests AS deps
RUN pnpm install --frozen-lockfile --filter labo...

FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter labo

FROM deps AS build
COPY packages/design packages/design
COPY apps/labo apps/labo
RUN pnpm --filter labo build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/labo/node_modules apps/labo/node_modules
COPY --from=build /repo/apps/labo/package.json apps/labo/package.json
COPY --from=build /repo/apps/labo/server/dist apps/labo/server/dist
COPY --from=build /repo/apps/labo/dist/labo/browser apps/labo/dist/labo/browser
ENV LABO_DATA=/data/labo.json
RUN mkdir /data && chown node:node /data
WORKDIR /repo/apps/labo
USER node
EXPOSE 3000
CMD ["node", "server/dist/main.js"]
