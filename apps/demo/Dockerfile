FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/demo/package.json apps/demo/package.json
COPY packages/route-names/package.json packages/route-names/package.json
COPY packages/node/package.json packages/node/package.json
COPY packages/browser/package.json packages/browser/package.json
RUN pnpm install --frozen-lockfile --filter @tcc-observability/demo...

FROM dependencies AS builder
ARG NEXT_PUBLIC_OBS_PROJECT_ID
ARG NEXT_PUBLIC_OBS_ENDPOINT=http://localhost
ARG NEXT_PUBLIC_OBS_ENVIRONMENT=development
ENV NEXT_PUBLIC_OBS_PROJECT_ID=$NEXT_PUBLIC_OBS_PROJECT_ID
ENV NEXT_PUBLIC_OBS_ENDPOINT=$NEXT_PUBLIC_OBS_ENDPOINT
ENV NEXT_PUBLIC_OBS_ENVIRONMENT=$NEXT_PUBLIC_OBS_ENVIRONMENT
COPY tsconfig.base.json eslint.config.mjs ./
COPY apps/demo apps/demo
COPY packages/route-names packages/route-names
COPY packages/node packages/node
COPY packages/browser packages/browser
RUN pnpm --filter @tcc-observability/demo... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3100
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/demo/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/demo/.next/static ./apps/demo/.next/static
USER nextjs
EXPOSE 3100
CMD ["node", "apps/demo/server.js"]
