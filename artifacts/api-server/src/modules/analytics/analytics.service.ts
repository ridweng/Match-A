import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
import { runtimeConfig } from "../../config/runtime";
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_METADATA_KEYS,
  type AnalyticsContext,
} from "./analytics.types";

type UserProfileContext = {
  userId: number;
  profileId: number | null;
  profileKind: "user" | "dummy" | null;
  country: string | null;
};

type EventInput = AnalyticsContext & {
  eventName: string;
  screenName?: string | null;
  areaName?: string | null;
  occurredAt?: string | null;
  durationMs?: number | null;
  targetProfilePublicId?: string | null;
  targetProfileKind?: "user" | "dummy" | "synthetic" | "unknown" | null;
  targetProfileBatchKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ScreenTimeInput = AnalyticsContext & {
  screenName: string;
  areaName?: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  endedBy?: "blur" | "background" | "logout" | "app_close" | "navigation" | null;
};

type ProfileCardInput = AnalyticsContext & {
  targetProfilePublicId: string;
  targetProfileKind?: "user" | "dummy" | "synthetic" | "unknown" | null;
  targetProfileBatchKey?: string | null;
  shownAt: string;
  decidedAt?: string | null;
  visibleDurationMs?: number | null;
  decision?: "like" | "pass" | "none" | null;
  openedInfo?: boolean | null;
  photosViewed?: number | null;
};

const allowedEventNames = new Set<string>(ANALYTICS_EVENT_NAMES);
const allowedMetadataKeys = new Set<string>(ANALYTICS_METADATA_KEYS);
const secretKeyPattern = /(password|token|secret|authorization|cookie|bio|description|free.?text|private)/i;

// Product study/testing analytics only. Event metadata must stay allowlisted and
// must never include passwords, tokens, reset/verification secrets, bios, or raw private text.
function parseDate(value: string | null | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function truncateText(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function clampInt(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

export function sanitizeAnalyticsMetadata(input: unknown, maxBytes: number) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowedMetadataKeys.has(key) || secretKeyPattern.test(key)) {
      continue;
    }
    if (value == null || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (typeof value === "number") {
      sanitized[key] = Number.isFinite(value) ? value : null;
    } else if (typeof value === "string") {
      sanitized[key] = truncateText(value, 160);
    }
  }

  const encoded = JSON.stringify(sanitized);
  if (encoded.length <= maxBytes) {
    return sanitized;
  }

  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitized)) {
    compact[key] = typeof value === "string" ? truncateText(value, 48) : value;
    if (JSON.stringify(compact).length > maxBytes) {
      delete compact[key];
      break;
    }
  }
  return compact;
}

@Injectable()
export class AnalyticsService {
  isEnabled() {
    return runtimeConfig.analytics.enabled;
  }

  private debug(event: string, payload: Record<string, unknown>) {
    if (!runtimeConfig.analytics.debugLogs) return;
    console.log("[analytics]", event, payload);
  }

  async getUserProfileContext(userId: number): Promise<UserProfileContext> {
    const result = await pool.query<{
      profile_id: number | null;
      kind: "user" | "dummy" | null;
      country: string | null;
    }>(
      `SELECT id AS profile_id, kind, NULLIF(country, '') AS country
       FROM core.profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    return {
      userId,
      profileId: row?.profile_id ?? null,
      profileKind: row?.kind ?? null,
      country: row?.country ?? null,
    };
  }

  async resolveActiveTestRun(ctx: UserProfileContext) {
    const result = await pool.query<{ id: string }>(
      `SELECT tr.id
       FROM analytics.test_runs tr
       WHERE tr.status = 'active'
         AND tr.starts_at <= NOW()
         AND (tr.ends_at IS NULL OR tr.ends_at >= NOW())
         AND (
           (
             tr.include_all_real_users = true
             AND ($2::text = 'user' OR tr.include_dummy_users_as_actors = true)
             AND NOT EXISTS (
               SELECT 1 FROM analytics.test_run_members m
               WHERE m.test_run_id = tr.id AND m.user_id = $1 AND m.included = false
             )
           )
           OR EXISTS (
             SELECT 1 FROM analytics.test_run_members m
             WHERE m.test_run_id = tr.id AND m.user_id = $1 AND m.included = true
           )
         )
       ORDER BY tr.starts_at DESC, tr.created_at DESC
       LIMIT 1`,
      [ctx.userId, ctx.profileKind]
    );
    return result.rows[0]?.id ?? null;
  }

  async startSession(userId: number, input: AnalyticsContext & { startedAt?: string | null }) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    const ctx = await this.getUserProfileContext(userId);
    if (ctx.profileKind === "dummy") return { ok: true, analyticsEnabled: false as const };
    const testRunId = await this.resolveActiveTestRun(ctx);
    const startedAt = parseDate(input.startedAt);
    const result = await pool.query<{ id: string; test_run_id: string | null }>(
      `INSERT INTO analytics.app_sessions (
         test_run_id, user_id, profile_id, started_at, last_heartbeat_at,
         platform, app_version, build_number, device_family, country
       )
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9)
       RETURNING id, test_run_id`,
      [
        testRunId,
        userId,
        ctx.profileId,
        startedAt.toISOString(),
        input.platform ?? null,
        truncateText(input.appVersion, 64) || null,
        truncateText(input.buildNumber, 64) || null,
        truncateText(input.deviceFamily, 120) || null,
        ctx.country,
      ]
    );
    this.debug("session_started", { sessionId: result.rows[0]?.id, testRunId });
    return { ok: true, analyticsEnabled: true as const, ...result.rows[0] };
  }

  async heartbeat(userId: number, sessionId: string | null | undefined) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    if (!sessionId) return { ok: true, analyticsEnabled: true as const };
    await pool.query(
      `UPDATE analytics.app_sessions
       SET last_heartbeat_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [sessionId, userId]
    );
    this.debug("session_heartbeat", { sessionId });
    return { ok: true, analyticsEnabled: true as const };
  }

  async endSession(
    userId: number,
    input: { sessionId?: string | null; endedAt?: string | null; endReason?: string | null }
  ) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    if (!input.sessionId) return { ok: true, analyticsEnabled: true as const };
    const endedAt = parseDate(input.endedAt);
    await pool.query(
      `UPDATE analytics.app_sessions
       SET ended_at = $3,
           duration_seconds = LEAST(GREATEST(EXTRACT(EPOCH FROM ($3 - started_at))::int, 0), 14400),
           active_duration_seconds = LEAST(GREATEST(EXTRACT(EPOCH FROM ($3 - started_at))::int, 0), 14400),
           idle_duration_seconds = 0,
           end_reason = $4,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [input.sessionId, userId, endedAt.toISOString(), input.endReason ?? "background"]
    );
    this.debug("session_ended", { sessionId: input.sessionId, endReason: input.endReason });
    return { ok: true, analyticsEnabled: true as const };
  }

  async recordEvent(userId: number, input: EventInput) {
    const result = await this.recordEvents(userId, [input]);
    return { ok: true, analyticsEnabled: result.analyticsEnabled };
  }

  async recordEvents(userId: number, events: EventInput[]) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    const ctx = await this.getUserProfileContext(userId);
    if (ctx.profileKind === "dummy") return { ok: true, analyticsEnabled: false as const };
    const testRunId = await this.resolveActiveTestRun(ctx);
    const maxBatchSize = Math.max(1, runtimeConfig.analytics.maxBatchSize);
    const accepted = events.slice(0, maxBatchSize).filter((event) =>
      allowedEventNames.has(event.eventName)
    );
    if (!accepted.length) {
      return { ok: true, analyticsEnabled: true as const, accepted: 0 };
    }

    const values: unknown[] = [];
    const placeholders = accepted.map((event, index) => {
      const base = index * 16;
      const metadata = sanitizeAnalyticsMetadata(
        event.metadata,
        runtimeConfig.analytics.eventMaxMetadataBytes
      );
      values.push(
        testRunId,
        event.sessionId ?? null,
        userId,
        ctx.profileId,
        event.eventName,
        truncateText(event.screenName, 80) || null,
        truncateText(event.areaName, 80) || null,
        parseDate(event.occurredAt).toISOString(),
        clampInt(event.durationMs, 0, 86_400_000),
        truncateText(event.targetProfilePublicId, 80) || null,
        event.targetProfileKind ?? null,
        truncateText(event.targetProfileBatchKey, 120) || null,
        metadata ? JSON.stringify(metadata) : null,
        event.platform ?? null,
        truncateText(event.appVersion, 64) || null,
        truncateText(event.buildNumber, 64) || null
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}::jsonb, $${base + 14}, $${base + 15}, $${base + 16})`;
    });

    await pool.query(
      `INSERT INTO analytics.app_events (
         test_run_id, session_id, user_id, profile_id, event_name, screen_name,
         area_name, occurred_at, duration_ms, target_profile_public_id,
         target_profile_kind, target_profile_batch_key, metadata, platform, app_version, build_number
       ) VALUES ${placeholders.join(", ")}`,
      values
    );
    this.debug("events_batch", { count: accepted.length, testRunId });
    return { ok: true, analyticsEnabled: true as const, accepted: accepted.length };
  }

  async recordScreenTime(userId: number, input: ScreenTimeInput) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    const durationMs = clampInt(input.durationMs, 0, 86_400_000);
    if (!durationMs || durationMs < 250) return { ok: true, analyticsEnabled: true as const };
    const ctx = await this.getUserProfileContext(userId);
    if (ctx.profileKind === "dummy") return { ok: true, analyticsEnabled: false as const };
    const testRunId = await this.resolveActiveTestRun(ctx);
    await pool.query(
      `INSERT INTO analytics.screen_time_segments (
        test_run_id, session_id, user_id, profile_id, screen_name, area_name,
        started_at, ended_at, duration_ms, ended_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        testRunId,
        input.sessionId ?? null,
        userId,
        ctx.profileId,
        truncateText(input.screenName, 80),
        truncateText(input.areaName, 80) || null,
        parseDate(input.startedAt).toISOString(),
        parseDate(input.endedAt).toISOString(),
        durationMs,
        input.endedBy ?? null,
      ]
    );
    await this.recordEvent(userId, {
      ...input,
      eventName: "screen_time",
      screenName: input.screenName,
      areaName: input.areaName,
      occurredAt: input.endedAt,
      durationMs,
      metadata: { endedBy: input.endedBy ?? null },
    });
    this.debug("screen_time", { screenName: input.screenName, durationMs });
    return { ok: true, analyticsEnabled: true as const };
  }

  async recordProfileCardTime(userId: number, input: ProfileCardInput) {
    if (!this.isEnabled()) return { ok: true, analyticsEnabled: false as const };
    const ctx = await this.getUserProfileContext(userId);
    if (ctx.profileKind === "dummy") return { ok: true, analyticsEnabled: false as const };
    const testRunId = await this.resolveActiveTestRun(ctx);
    await pool.query(
      `INSERT INTO analytics.profile_card_segments (
        test_run_id, session_id, user_id, actor_profile_id, target_profile_public_id,
        target_profile_kind, target_profile_batch_key, shown_at, decided_at,
        visible_duration_ms, decision, opened_info, photos_viewed
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        testRunId,
        input.sessionId ?? null,
        userId,
        ctx.profileId,
        truncateText(input.targetProfilePublicId, 80),
        input.targetProfileKind ?? null,
        truncateText(input.targetProfileBatchKey, 120) || null,
        parseDate(input.shownAt).toISOString(),
        input.decidedAt ? parseDate(input.decidedAt).toISOString() : null,
        clampInt(input.visibleDurationMs, 0, 86_400_000),
        input.decision ?? "none",
        Boolean(input.openedInfo),
        clampInt(input.photosViewed, 0, 99) ?? 0,
      ]
    );
    return { ok: true, analyticsEnabled: true as const };
  }

  async expireStaleSessions() {
    if (!this.isEnabled()) return;
    await pool.query(
      `UPDATE analytics.app_sessions
       SET ended_at = last_heartbeat_at + ($1::int * INTERVAL '1 second'),
           duration_seconds = LEAST(GREATEST(EXTRACT(EPOCH FROM ((last_heartbeat_at + ($1::int * INTERVAL '1 second')) - started_at))::int, 0), 14400),
           active_duration_seconds = LEAST(GREATEST(EXTRACT(EPOCH FROM ((last_heartbeat_at + ($1::int * INTERVAL '1 second')) - started_at))::int, 0), 14400),
           idle_duration_seconds = 0,
           end_reason = 'heartbeat_expired',
           updated_at = NOW()
       WHERE ended_at IS NULL
         AND last_heartbeat_at < NOW() - ($1::int * INTERVAL '1 second')`,
      [runtimeConfig.analytics.sessionStaleSeconds]
    );
  }
}
