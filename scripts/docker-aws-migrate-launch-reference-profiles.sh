#!/bin/sh
set -eu

docker compose --env-file .env -f docker-compose.aws.yml run --rm api-migrate
docker compose --env-file .env -f docker-compose.aws.yml run --rm api \
  pnpm --dir artifacts/api-server db:refresh:launch-reference-profiles
docker compose --env-file .env -f docker-compose.aws.yml restart api
