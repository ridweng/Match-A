# Matcha API Server

`artifacts/api-server` is now the primary backend package for Matcha.

## What it is

- Nest-based API server
- Postgres-only data layer through `@workspace/db`
- Mobile-compatible auth/discovery contract on port `8082` by default

## What the mobile app uses

The Expo app talks to:

- `GET /api/auth/providers`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/refresh`
- `POST /api/auth/sign-out`
- `POST /api/auth/verify-email`
- `GET /api/auth/verify-email/confirm`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `GET /api/auth/settings`
- `PATCH /api/auth/settings`
- `POST /api/auth/onboarding/complete`
- `GET /api/auth/social/start/:provider`
- `GET|POST /api/auth/social/callback/:provider`
- `GET /api/discovery/preferences`
- `POST /api/discovery/like`

## Postgres storage

The schema lives in [`lib/db/src/schema/index.ts`](/Users/ignaciokaiser/Desktop/mines/Match-A/lib/db/src/schema/index.ts).

Current layout is explicit **source vs projection**:

- Source tables:
  - `auth.users`
  - `auth.auth_identities`
  - `auth.email_verification_tokens`
  - `auth.auth_sessions`
  - `core.profiles`
  - `core.profile_copy`
  - `core.user_settings`
  - `core.user_onboarding`
  - `core.user_sync_state`
  - `core.profile_languages`
  - `core.profile_interests`
  - `catalog.goal_categories`
  - `catalog.goal_task_templates`
  - `goals.user_goal_tasks`
  - `discovery.profile_interactions`
  - `discovery.profile_insight_tags`
  - `discovery.profile_goal_feedback`
  - `media.media_assets`
  - `media.profile_images`
- Projection tables:
  - `goals.user_category_progress`
  - `goals.user_global_progress`
  - `discovery.popular_attribute_counts`
  - `discovery.popular_attribute_modes`
  - `discovery.discovery_change_messages`

Projection rows are derived from source tables only and are rebuildable through the projection scripts.

## Required environment

At minimum:

```bash
export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME"
```

Recommended auth/runtime config:

```bash
export PORT=8082
export AUTH_BASE_URL="http://127.0.0.1:8082"
export AUTH_FRONTEND_REDIRECT_URI="matcha:///auth-callback"
export AUTH_SESSION_SECRET="<generate-a-strong-random-secret>"
export AUTH_ACCESS_TTL_MINUTES=15
export AUTH_REFRESH_TTL_DAYS=30
```

Local Postgres defaults are supported through `.env` as well. See [`artifacts/api-server/.env.example`](/Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/api-server/.env.example).

If you want the backend to create the local database automatically in local development, set:

```bash
INSTALL=true
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=matcha
DB_PASSWORD="<local-database-password>"
DB_NAME=matcha
DB_ADMIN_DB=postgres
```

Optional:

- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- Social auth:
  - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Facebook: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
  - Apple: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_SERVICE_ID`

`INSTALL=true` only creates the database itself. It does not apply schema migrations or seed business data during API startup.

## Database commands

Set up a new local database, apply the schema, and seed baseline data:

```bash
pnpm db:setup
```

Apply the current schema changes to an existing database:

```bash
pnpm db:migrate
```

Generate a checked-in SQL migration after schema changes:

```bash
pnpm db:generate
```

Check for schema/migration drift:

```bash
pnpm db:check
```

Seed catalogs, goal templates, and the default dev account:

```bash
pnpm db:seed
```

Drop the application schemas only:

```bash
pnpm db:reset
```

Drop schemas, recreate them, and reseed:

```bash
pnpm db:rebuild
```

Rebuild projections from source tables:

```bash
pnpm db:rebuild:goals-projections
pnpm db:rebuild:discovery-projections
```

Or let the backend do the local install on startup when `INSTALL=true`:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
# edit INSTALL=true and your local DB credentials
pnpm db:setup
pnpm auth:dev
```

If you start the backend before migrations or seeds are applied, startup now fails fast with one of these explicit errors:

- `DATABASE_SCHEMA_NOT_READY`
- `DATABASE_SEED_NOT_READY`
- `DATABASE_CONNECTION_FAILED`

There is also a readiness endpoint:

```bash
GET /api/healthz/ready
```

It returns `503` until required tables and baseline seed rows are present.

To seed a development account, set `SEED_DEFAULT_EMAIL` and
`SEED_DEFAULT_PASSWORD` before running the seed script. The seed script does
not create a default password unless both values are explicitly provided.

## Production build

```bash
pnpm api:build
pnpm api:start
```

## Important note

`artifacts/auth-backend` is now the legacy backend path kept only for fallback/reference during migration. New work should target `artifacts/api-server`.
