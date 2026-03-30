# Match-A Repo Index And Run/Deploy Runbook

## Summary

Match-A is a `pnpm` workspace with three primary surfaces:

- `artifacts/matcha-app`: Expo React Native app with checked-in native `ios/` and `android/` projects.
- `artifacts/api-server`: Nest-based API server that serves mobile auth, discovery, media, admin, and health endpoints.
- `lib/*`: shared API client, OpenAPI spec, Zod contracts, and Drizzle database package.

Use `pnpm` from the repository root. The root workspace scripts in `package.json` are the main operator entrypoint for local backend, AWS compose deployment, and app launch helpers.

## Repo Index

### Workspace

- Package manager: `pnpm`
- Workspace packages: `artifacts/*`, `lib/*`, `scripts`
- Shared libs:
  - `lib/db`: schema, migrations, runtime DB setup
  - `lib/api-zod`: shared contract types
  - `lib/api-spec`: OpenAPI source
  - `lib/api-client-react`: generated/shared client helpers

### Backend

- Path: `artifacts/api-server`
- Runtime:
  - `pnpm --dir artifacts/api-server dev`
  - `pnpm --dir artifacts/api-server build`
  - `pnpm --dir artifacts/api-server start`
- Default API port: `8082`
- Notable modules:
  - `auth`
  - `discovery`
  - `media`
  - `goals`
  - `admin`
  - `health`
  - `viewer`
- Database and seed entrypoints live in `artifacts/api-server/src/scripts`

### Mobile App

- Path: `artifacts/matcha-app`
- Runtime:
  - `pnpm --dir artifacts/matcha-app ios`
  - `pnpm --dir artifacts/matcha-app android`
- Expo config:
  - scheme: `matcha`
  - iOS bundle id: `com.xylo.matcha`
  - Android application id: `com.xylo.matcha`
- API base URL resolution:
  - `EXPO_PUBLIC_AUTH_API_URL` if defined
  - else Android emulator fallback: `http://10.0.2.2:8082`
  - else iOS/default fallback: `http://127.0.0.1:8082`

### Deployment Topology

- Local compose file: `docker-compose.yml`
  - `postgres` on `5432`
  - `mailpit` on `1025` and `8025`
  - `api` on `8082`
- AWS compose file: `docker-compose.aws.yml`
  - production-mode API
  - `.env`-driven secrets and base URLs
  - `postgres`, `mailpit`, and `api` restart unless stopped

## Runbook

### Install Dependencies

Run from the repository root:

```bash
pnpm install
```

### Run iOS On A Physical iPhone Against AWS

Do not use the app's `pnpm dev` script for physical device work. It forces `--localhost`, which is wrong for a phone.

Start Metro from the app directory:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm exec expo start --dev-client --lan
```

Install and launch the native app on the connected iPhone:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm exec expo run:ios --device
```

Current default app env points to the AWS backend:

```dotenv
EXPO_PUBLIC_AUTH_API_URL=http://ec2-3-237-0-218.compute-1.amazonaws.com:8082
```

### Run Backend Locally

Run from the repository root:

```bash
pnpm docker:up
pnpm docker:logs
```

The local compose stack builds the API image, runs migrations, seeds baseline data, and then starts the API container.

### Run iPhone Against The Local Backend

A physical phone cannot reach `127.0.0.1` on your laptop. Override the app API URL with your Mac's LAN IP.

Start Metro:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
EXPO_PUBLIC_AUTH_API_URL=http://<MAC_LAN_IP>:8082 pnpm exec expo start --dev-client --lan
```

Install and run the app:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
EXPO_PUBLIC_AUTH_API_URL=http://<MAC_LAN_IP>:8082 pnpm exec expo run:ios --device
```

### Run Or Redeploy On AWS

Run these on the EC2 host from the repository root:

```bash
pnpm docker:aws:build
pnpm docker:aws:ps
pnpm docker:aws:logs
```

Other operational commands:

```bash
pnpm docker:aws:start
pnpm docker:aws:recreate
pnpm docker:aws:down
```

### Build An Android Release APK

Build the APK from the app directory:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm android:release
```

Expected artifact path:

```text
artifacts/matcha-app/android/app/build/outputs/apk/release/app-release.apk
```

Install the release build on a connected Android device:

```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/artifacts/matcha-app
pnpm android:release:install
```

## Validation Checklist

- Local backend:
  - `pnpm docker:up`
  - `pnpm docker:logs`
  - verify `GET /api/healthz/ready`
- iPhone plus AWS:
  - `pnpm exec expo start --dev-client --lan`
  - `pnpm exec expo run:ios --device`
  - verify sign-in and discovery load
- iPhone plus local backend:
  - override `EXPO_PUBLIC_AUTH_API_URL` to `http://<MAC_LAN_IP>:8082`
  - verify auth and media traffic hit the local API
- Android APK:
  - `pnpm android:release`
  - verify `android/app/build/outputs/apk/release/app-release.apk` exists

## Caveats

- The current Android `release` build type is still signed with the debug keystore in `artifacts/matcha-app/android/app/build.gradle`. That produces a release APK build, but it is not yet a production-grade release candidate.
- The root `.env` contains deployment secrets. Do not copy raw secret values into shared docs.
- `artifacts/auth-backend` is legacy. New backend work should target `artifacts/api-server`.
