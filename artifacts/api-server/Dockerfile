FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir artifacts/api-server build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/artifacts/api-server/dist /app/artifacts/api-server/dist
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:8082/api/healthz/ready >/dev/null || exit 1
USER node
CMD ["node", "artifacts/api-server/dist/index.cjs"]
