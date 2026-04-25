BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_rate_limit_counters_reset_at_idx
ON security.rate_limit_counters(reset_at);

CREATE TABLE IF NOT EXISTS auth.social_handoff_codes (
  id BIGSERIAL PRIMARY KEY,
  code_hash VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(32) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_social_handoff_codes_expires_at_idx
ON auth.social_handoff_codes(expires_at);

COMMIT;
