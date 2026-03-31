# Maestro E2E Flows

These flows validate the DB-backed onboarding/profile/discovery path on the mobile app.

Assumptions:
- The app is installed as `com.xylo.matcha`
- The build is a dev build so the dev-only inspectors are visible
- Test data is seeded before running

Happy-path seed requirements:
- One actor account with valid credentials
- The actor lands in onboarding with shared profile data already present
- The actor has a primary DB-backed profile image
- At least two queue-eligible real users with ready media exist
- At least one fallback dummy profile exists

Stale-cursor seed requirements:
- One authenticated actor already in discovery
- At least three candidates are available in the visible deck

Environment variables used by the flows:
- `ACTOR_EMAIL`
- `ACTOR_PASSWORD`

Run:

```sh
maestro test artifacts/matcha-app/e2e/maestro/real-user-happy-path.yaml \
  -e ACTOR_EMAIL='actor@example.com' \
  -e ACTOR_PASSWORD='secret1234'

maestro test artifacts/matcha-app/e2e/maestro/stale-cursor-recovery.yaml \
  -e ACTOR_EMAIL='actor@example.com' \
  -e ACTOR_PASSWORD='secret1234'
```

Acceptance criteria covered by the happy path:
- first card action succeeds
- second card action succeeds
- queue order changes after each action
- previously decided profile id does not reappear
- rendered image source is visible in debug metadata
- onboarding/profile primary image match is exposed via `primaryMatchStatus=ok`

Acceptance criteria covered by the stale-cursor path:
- backend stale cursor can be simulated from the dev-only discovery inspector
- client performs a hard refresh
- stale top card is not kept
- actions become enabled again only after the refreshed deck is active
