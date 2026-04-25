#!/usr/bin/env sh
set -eu

tracked_env_files="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env(\.[A-Za-z0-9_-]+)?\.example$|^\.env\.aws\.example$' | while IFS= read -r file; do [ ! -f "$file" ] || echo "$file"; done || true)"
if [ -n "$tracked_env_files" ]; then
  echo "Tracked non-example env files are not allowed:" >&2
  echo "$tracked_env_files" >&2
  exit 1
fi

if git grep -n -I -E \
  '(accessToken=|refreshToken=|demo-access-token|demo-refresh-token|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|postgresql://[^[:space:]]+:[^[:space:]@]+@|mongodb://[^[:space:]]+:[^[:space:]@]+@|redis://[^[:space:]]+:[^[:space:]@]+@|AUTH_SESSION_SECRET=["'\'']?change-me|ADMIN_BASIC_AUTH_PASSWORD=["'\'']?change-me)' \
  -- \
  ':!pnpm-lock.yaml' \
  ':!*.png' ':!*.jpg' ':!*.jpeg' ':!*.gif' ':!*.webp' \
  ':!.env.example' ':!.env.aws.example' ':!artifacts/api-server/.env.example'
then
  echo "Potential committed secret or URL-delivered token pattern found." >&2
  exit 1
fi

echo "Secret scan passed."
