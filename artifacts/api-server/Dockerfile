FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
ENV CI=true
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir artifacts/api-server build

FROM builder AS runtime
ENV NODE_ENV=production
WORKDIR /app
EXPOSE 8082 8083
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD-SHELL wget -qO- "http://127.0.0.1:${APP_PORT:-8082}/api/healthz/ready" >/dev/null || exit 1
USER node
CMD ["node", "artifacts/api-server/dist/index.cjs"]
