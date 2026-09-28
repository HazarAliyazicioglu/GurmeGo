# Built from the MONOREPO ROOT as build context (Railway Root Directory must be blank) --
# apps/api depends on packages/shared via pnpm's `workspace:*` protocol, which only resolves
# correctly when pnpm install runs with the full workspace (root pnpm-lock.yaml + pnpm-workspace.yaml)
# visible, not scoped to apps/api alone (see docs/STATE.md, 2026-09-25 deploy debugging notes).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# turbo's build task has dependsOn: ["^build"] (turbo.json) -- this builds @gurmego/shared
# (packages/shared/dist) before @gurmego/api, since apps/api depends on it at runtime, not just
# at compile time (e.g. zod schemas used in ZodValidationPipe).
RUN pnpm exec turbo run build --filter=@gurmego/api

FROM node:22-slim AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
WORKDIR /app/apps/api
# Uses node's own http client, not curl -- node:22-slim doesn't ship curl and adding it just for
# this would grow the runtime image. railway.json's healthcheckPath is Railway's own deploy-gate
# check; this is the container-level signal (visible via `docker ps`, usable by any orchestrator).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main.js"]
