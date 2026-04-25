# Browser Security Policy

MatchA applies browser security controls at both layers:

- the API server sets CORS and response security headers for API/admin responses;
- Caddy sets equivalent edge headers for public web, API, and admin hosts.

## CORS

The API does not use wildcard CORS.

Public API routes allow only:

- `FRONTEND_BASE_URL`;
- `API_BASE_URL`, for same-host browser flows;
- comma-separated `CORS_ALLOWED_ORIGINS`;
- in non-production only, explicit localhost development origins on ports `3000`, `5173`, and `8080`.

Admin routes are handled separately. The following paths are admin/internal:

- `/`
- `/dashboard`
- `/dashboard/*`
- `/api/admin`
- `/api/admin/*`
- `/api/docs`
- `/api/docs/*`
- `/api/reference`
- `/api/openapi.json`

Admin CORS allows only:

- the same request origin;
- `ADMIN_BASE_URL`;
- comma-separated `ADMIN_CORS_ALLOWED_ORIGINS`.
- client IPs matching `ADMIN_ALLOWED_CIDRS` before the admin route is served.

`ADMIN_CORS_ALLOWED_ORIGINS` should remain empty unless an internal origin is explicitly approved.
`ADMIN_ALLOWED_CIDRS` is required in production when the admin dashboard is enabled.

Allowed public methods are `GET`, `HEAD`, `POST`, `PATCH`, `DELETE`, and `OPTIONS`.
Allowed admin CORS methods are `GET`, `HEAD`, and `OPTIONS`.

Allowed request headers are:

- `Authorization`
- `Content-Type`
- `Accept`
- `X-Matcha-Request-Id`
- `X-Matcha-Location-Source`

Credentialed CORS is disabled. MatchA uses bearer tokens for API calls; browser cookies are not required for cross-origin API access.

## Headers

API JSON responses use a non-document CSP:

```text
default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Admin pages use a scoped document CSP that permits the current inline admin templates and the Scalar CDN used by the internal API reference, while blocking framing:

```text
default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline' 'nonce-...' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' 'nonce-...' https://cdn.jsdelivr.net; connect-src 'self'
```

The public web host allows the Expo web bundle, auth-result pages, media, and API calls to the configured API host.

All surfaces include:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- production HTTPS `Strict-Transport-Security`

## Route Exceptions

Public media under `/api/media/public/*` uses `Cross-Origin-Resource-Policy: cross-origin` at the API server layer so the web app can render media from the API host. Other API responses use `same-site`.

The public web CSP includes `'unsafe-inline'` for scripts and styles because the current Expo/static-auth output and landing page rely on inline bootstrap/style behavior.

Admin pages still include `'unsafe-inline'` because current server-rendered admin HTML uses inline style attributes and inline event handlers. Admin responses also receive per-request nonces for the main inline blocks, but removing `'unsafe-inline'` fully requires replacing inline style attributes and handlers with classes and event listeners.

The Scalar docs route keeps a separate CSP that allows the Scalar CDN and inline initialization script. This exception is scoped to `/api/docs`, `/api/docs/*`, and `/api/reference`.

## Auth Token Handoff

Social auth callbacks must not place access or refresh tokens in URLs. The callback now redirects with a short-lived one-time `handoffCode` only. The app exchanges that code with:

```text
POST /api/auth/social/exchange
```

The handoff code is hashed at rest, expires after two minutes, and is consumed once. The encrypted session payload is stored server-side until exchange.

## Rate Limiting

Rate limits use the shared Postgres table `security.rate_limit_counters`, so counters survive process restarts and work across multiple API instances. Strict login-related limits remain `5` attempts per `15` minutes.

## Secret Safeguards

Run the local secret guard before committing:

```bash
pnpm security:secrets
```

Production startup rejects placeholder session/admin/database secrets and requires `ADMIN_ALLOWED_CIDRS` when admin is enabled.
