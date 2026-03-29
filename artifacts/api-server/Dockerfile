FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir artifacts/api-server build

FROM base AS runtime
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 8082
CMD ["node", "artifacts/api-server/dist/index.cjs"]
