FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @tcc-observability/api...

FROM dependencies AS builder
COPY tsconfig.base.json eslint.config.mjs ./
COPY apps/api apps/api
COPY packages/database packages/database
RUN pnpm --filter @tcc-observability/api... build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY apps/api/src/ingestion/proto ./apps/api/dist/ingestion/proto
COPY apps/api/package.json ./apps/api/package.json
COPY packages/database/package.json ./packages/database/package.json
USER node
EXPOSE 4000 4319
CMD ["node", "apps/api/dist/main.js"]
