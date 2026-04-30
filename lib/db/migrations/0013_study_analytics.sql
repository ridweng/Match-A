CREATE SCHEMA IF NOT EXISTS analytics;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS analytics.test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  include_all_real_users boolean NOT NULL DEFAULT true,
  include_dummy_users_as_actors boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_test_runs_status_window_idx
  ON analytics.test_runs (status, starts_at DESC, ends_at);

CREATE TABLE IF NOT EXISTS analytics.test_run_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES analytics.test_runs(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id bigint REFERENCES core.profiles(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'participant',
  included boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_run_id, user_id)
);

CREATE INDEX IF NOT EXISTS analytics_test_run_members_user_idx
  ON analytics.test_run_members (user_id, included);

CREATE TABLE IF NOT EXISTS analytics.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES analytics.test_runs(id) ON DELETE SET NULL,
  user_id bigint NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id bigint REFERENCES core.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL,
  duration_seconds integer,
  active_duration_seconds integer,
  idle_duration_seconds integer,
  platform text CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
  app_version text,
  build_number text,
  device_family text,
  country text,
  end_reason text CHECK (end_reason IS NULL OR end_reason IN ('foreground_end', 'background', 'logout', 'heartbeat_expired', 'crash_or_unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_app_sessions_test_run_started_idx
  ON analytics.app_sessions (test_run_id, started_at DESC);
CREATE INDEX IF NOT EXISTS analytics_app_sessions_user_started_idx
  ON analytics.app_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS analytics.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES analytics.test_runs(id) ON DELETE SET NULL,
  session_id uuid REFERENCES analytics.app_sessions(id) ON DELETE SET NULL,
  user_id bigint NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id bigint REFERENCES core.profiles(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  screen_name text,
  area_name text,
  occurred_at timestamptz NOT NULL,
  duration_ms integer,
  target_profile_public_id text,
  target_profile_kind text CHECK (target_profile_kind IS NULL OR target_profile_kind IN ('user', 'dummy', 'synthetic', 'unknown')),
  target_profile_batch_key text,
  metadata jsonb,
  platform text CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
  app_version text,
  build_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_app_events_test_run_occurred_idx
  ON analytics.app_events (test_run_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_app_events_user_occurred_idx
  ON analytics.app_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_app_events_session_idx
  ON analytics.app_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_app_events_name_occurred_idx
  ON analytics.app_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_app_events_screen_occurred_idx
  ON analytics.app_events (screen_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_app_events_target_kind_occurred_idx
  ON analytics.app_events (target_profile_kind, occurred_at DESC);

CREATE TABLE IF NOT EXISTS analytics.screen_time_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES analytics.test_runs(id) ON DELETE SET NULL,
  session_id uuid REFERENCES analytics.app_sessions(id) ON DELETE SET NULL,
  user_id bigint NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id bigint REFERENCES core.profiles(id) ON DELETE SET NULL,
  screen_name text NOT NULL,
  area_name text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  ended_by text CHECK (ended_by IS NULL OR ended_by IN ('blur', 'background', 'logout', 'app_close', 'navigation')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_screen_time_test_run_started_idx
  ON analytics.screen_time_segments (test_run_id, started_at DESC);
CREATE INDEX IF NOT EXISTS analytics_screen_time_user_started_idx
  ON analytics.screen_time_segments (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS analytics_screen_time_screen_started_idx
  ON analytics.screen_time_segments (screen_name, started_at DESC);

CREATE TABLE IF NOT EXISTS analytics.profile_card_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES analytics.test_runs(id) ON DELETE SET NULL,
  session_id uuid REFERENCES analytics.app_sessions(id) ON DELETE SET NULL,
  user_id bigint NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_profile_id bigint REFERENCES core.profiles(id) ON DELETE SET NULL,
  target_profile_public_id text NOT NULL,
  target_profile_kind text CHECK (target_profile_kind IS NULL OR target_profile_kind IN ('user', 'dummy', 'synthetic', 'unknown')),
  target_profile_batch_key text,
  shown_at timestamptz NOT NULL,
  decided_at timestamptz,
  visible_duration_ms integer,
  decision text CHECK (decision IS NULL OR decision IN ('like', 'pass', 'none')),
  opened_info boolean NOT NULL DEFAULT false,
  photos_viewed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_profile_card_test_run_shown_idx
  ON analytics.profile_card_segments (test_run_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS analytics_profile_card_user_shown_idx
  ON analytics.profile_card_segments (user_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS analytics_profile_card_target_kind_shown_idx
  ON analytics.profile_card_segments (target_profile_kind, shown_at DESC);

COMMENT ON SCHEMA analytics IS 'Product study/testing analytics. Sensitive inputs, credentials, tokens, and raw private form text must not be stored here.';
COMMENT ON COLUMN analytics.app_events.metadata IS 'Allowlisted product-study metadata only. Do not store passwords, auth tokens, reset tokens, verification tokens, bios, or raw private form content.';

