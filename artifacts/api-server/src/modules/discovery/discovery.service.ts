import { Inject, Injectable, Logger } from "@nestjs/common";
import { pool } from "@workspace/db";
import { runtimeConfig } from "../../config/runtime";
import {
  diffPopularAttributeSnapshots,
  normalizePopularAttributeInput,
  createEmptyPopularAttributesByCategory,
  type PopularAttributeCategory,
} from "../../utils/popular-attributes";
import {
  getDiscoveryPreferencesForActor,
  rebuildDiscoveryProjectionsForActor,
} from "./discovery.projections";
import { GoalsService } from "../goals/goals.service";
import {
  DISCOVERY_POLICY_V1,
  computeStableDiscoveryRank,
  decodeDiscoveryWindowCursor,
  encodeDiscoveryWindowCursor,
  evaluateGenderTherianReason,
  getDominantExclusionReason,
  type DiscoveryCandidateBucket,
  type DiscoveryExhaustedReason,
  type DiscoveryExclusionReason,
  type DiscoveryFilters,
  type DiscoveryQueueInvalidationReason,
  type DiscoveryWindowCursorPayload,
} from "./discovery.policy";

type BaseGender = "male" | "female" | "non_binary" | "fluid";
type TherianMode = "exclude" | "include" | "only";

type DiscoveryFeedProfileRow = {
  id: number;
  kind: "user" | "dummy";
  public_id: string;
  display_name: string;
  profession: string;
  bio: string;
  content_locale: "es" | "en";
  date_of_birth: string | null;
  location: string;
  is_discoverable: boolean;
  gender_identity: string;
  pronouns: string;
  personality: string;
  relationship_goals: string;
  education: string;
  children_preference: string;
  physical_activity: string;
  alcohol_use: string;
  tobacco_use: string;
  political_interest: string;
  religion_importance: string;
  religion: string;
  body_type: string;
  height: string;
  hair_color: string;
  ethnicity: string;
  synthetic_group: string | null;
  created_at: string | Date | null;
  onboarding_status: string | null;
  onboarding_completed_at: string | Date | null;
  has_ready_media: boolean;
};

type DiscoveryFeedImageRow = {
  profile_id: number;
  profile_image_id: number;
  sort_order: number;
  media_asset_id: number;
};

type DiscoveryFeedLanguageRow = {
  profile_id: number;
  language_code: string;
  position: number;
};

type DiscoveryFeedInterestRow = {
  profile_id: number;
  interest_code: string;
  position: number;
};

type DiscoveryFeedInsightRow = {
  profile_id: number;
  locale: "es" | "en";
  value: string;
  sort_order: number;
};

type DiscoveryFeedGoalFeedbackRow = {
  profile_id: number;
  goal_key: string;
  reason_es: string;
  reason_en: string;
};

type DiscoveryFeedOptions = {
  cursor?: string | null;
  limit?: number;
  requestId?: string | null;
};

type DiscoveryWindowOptions = {
  size?: number | null;
  cursor?: string | null;
  requestId?: string | null;
};

type DiscoveryDecisionPayload = {
  targetProfilePublicId?: string;
  targetProfileId?: number;
  categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
  requestId?: string | null;
  cursor?: string | null;
  visibleProfilePublicIds?: string[];
  visibleProfileIds?: number[];
  queueVersion?: number | null;
  presentedPosition?: number | null;
};

type ActorStateRow = {
  queue_version: number | null;
  stream_version: number | null;
  filters_hash: string | null;
  last_served_sort_key: number | null;
  last_served_profile_id: number | null;
  active_queue_head_position: number | null;
  updated_at: string | Date | null;
};

type ActorQueueRow = {
  actor_profile_id: number;
  queue_version: number;
  position: number;
  target_profile_id: number;
  status: "reserved" | "consumed" | "invalidated";
  generated_at: string | Date;
  source_bucket: string | null;
  rank_score: number | null;
};

type OrderedCandidate = {
  profile: DiscoveryFeedProfileRow;
  rank: number;
  bucket: DiscoveryCandidateBucket;
};

type DiscoveryPolicyDiagnostics = {
  eligibleRealCount: number;
  eligibleDummyCount: number;
  returnedRealCount: number;
  returnedDummyCount: number;
  dominantExclusionReason: DiscoveryExclusionReason | null;
  exhaustedReason: DiscoveryExhaustedReason | null;
  exclusionCounts: Partial<Record<DiscoveryExclusionReason, number>>;
};

type DiscoveryDebugPhoto = {
  profileImageId: number | null;
  mediaAssetId: number | null;
  sortOrder: number;
  remoteUrl: string;
  source: "db_confirmed" | "dummy_fallback";
};

type DiscoveryWindowResult = {
  queueVersion: number;
  policyVersion: string;
  generatedAt: string;
  windowSize: number;
  reserveCount: number;
  profiles: ReturnType<DiscoveryService["hydrateDiscoveryProfiles"]> extends Promise<infer T>
    ? T
    : never;
  nextCursor: string | null;
  hasMore: boolean;
  queueInvalidated?: boolean;
  queueInvalidationReason?: DiscoveryQueueInvalidationReason | null;
  supply: {
    eligibleCount: number;
    unseenCount: number;
    decidedCount: number;
    exhausted: boolean;
    fetchedAt: string;
    policyVersion: string;
    eligibleRealCount: number;
    eligibleDummyCount: number;
    returnedRealCount: number;
    returnedDummyCount: number;
    dominantExclusionReason: DiscoveryExclusionReason | null;
    exhaustedReason: DiscoveryExhaustedReason | null;
    refillThreshold: number;
  };
};

const FEMALE_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
] as const;

const MALE_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
  "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=600&q=80",
  "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=600&q=80",
] as const;

const NON_BINARY_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=600&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
] as const;

const DEFAULT_DISCOVERY_WINDOW_SIZE = 4;
const DISCOVERY_DECISION_WRITE_FAILED = "DISCOVERY_DECISION_WRITE_FAILED";
const DISCOVERY_CURSOR_STALE = "DISCOVERY_CURSOR_STALE";

class DiscoveryCursorError extends Error {
  queueInvalidationReason: DiscoveryQueueInvalidationReason;

  constructor(reason: DiscoveryQueueInvalidationReason) {
    super(DISCOVERY_CURSOR_STALE);
    this.queueInvalidationReason = reason;
  }
}

@Injectable()
export class DiscoveryService {
  private buildPublicMediaUrl(mediaAssetId: number) {
    return `${runtimeConfig.baseUrl}/api/media/public/${mediaAssetId}`;
  }

  private readonly logger = new Logger(DiscoveryService.name);

  constructor(@Inject(GoalsService) private readonly goalsService: GoalsService) {}

  private logDecisionEvent(event: string, payload: Record<string, unknown>) {
    this.logger.log(`[discovery-decision] ${event} ${JSON.stringify(payload)}`);
  }

  private warnDecisionEvent(event: string, payload: Record<string, unknown>) {
    this.logger.warn(`[discovery-decision] ${event} ${JSON.stringify(payload)}`);
  }

  private logQueueEvent(event: string, payload: Record<string, unknown>) {
    this.logger.log(`[discovery-queue] ${event} ${JSON.stringify(payload)}`);
  }

  private async buildDiscoveryState(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    userId: number,
    actorProfileId: number,
    options?: {
      preferences?: Awaited<ReturnType<typeof getDiscoveryPreferencesForActor>>;
      filters?: DiscoveryFilters;
      unlockState?: Awaited<ReturnType<GoalsService["getGoalsUnlockState"]>>;
      justUnlocked?: boolean;
    }
  ) {
    const preferences =
      options?.preferences || (await getDiscoveryPreferencesForActor(client, actorProfileId));
    const filters =
      options?.filters || (await this.getStoredFiltersForActor(client, actorProfileId));
    const unlockState =
      options?.unlockState ||
      (await this.goalsService.getGoalsUnlockState(userId, client, {
        justUnlocked: options?.justUnlocked,
      }));

    return {
      ...preferences,
      goalsUnlock: options?.justUnlocked
        ? {
            ...unlockState,
            justUnlocked: true,
          }
        : unlockState,
      filters,
    };
  }

  private defaultFilters(): DiscoveryFilters {
    return {
      selectedGenders: [] as BaseGender[],
      therianMode: "exclude" as const,
      ageMin: 18,
      ageMax: 40,
    };
  }

  private async findActorProfileId(userId: number) {
    const result = await pool.query<{ id: number }>(
      `SELECT id
       FROM core.profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    const actorProfileId = result.rows[0]?.id;
    if (!actorProfileId) {
      throw new Error("PROFILE_NOT_FOUND");
    }
    return actorProfileId;
  }

  private async findTargetProfileById(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    profileId: number
  ) {
    const result = await client.query<{ id: number; public_id: string }>(
      `SELECT id, public_id
       FROM core.profiles
       WHERE id = $1
       LIMIT 1`,
      [profileId]
    );
    return result.rows[0] || null;
  }

  private async resolveTargetProfile(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    payload: Pick<DiscoveryDecisionPayload, "targetProfilePublicId" | "targetProfileId">,
    requestId?: string | null
  ) {
    const normalizedPublicId = String(payload.targetProfilePublicId || "").trim() || null;
    const normalizedNumericId = this.normalizeProfileId(payload.targetProfileId);

    this.logger.log(
      `[discovery-identity] ${JSON.stringify({
        event: "resolution_attempt",
        requestId: requestId || null,
        hasPublicId: Boolean(normalizedPublicId),
        hasNumericId: normalizedNumericId !== null,
        preferredMethod: normalizedPublicId ? "public_id" : "numeric_id",
      })}`
    );

    if (normalizedPublicId) {
      const result = await client.query<{ id: number; public_id: string }>(
        `SELECT id, public_id
         FROM core.profiles
         WHERE public_id = $1
         LIMIT 1`,
        [normalizedPublicId]
      );

      const resolved = result.rows[0] || null;
      if (!resolved) {
        this.logger.warn(
          `[discovery-identity] ${JSON.stringify({
            event: "public_id_not_found",
            requestId: requestId || null,
            targetProfilePublicId: normalizedPublicId,
          })}`
        );
        return null;
      }

      if (normalizedNumericId !== null && resolved.id !== normalizedNumericId) {
        this.logger.error(
          `[identity-drift] ${JSON.stringify({
            requestId: requestId || null,
            providedNumericId: normalizedNumericId,
            resolvedNumericId: resolved.id,
            targetProfilePublicId: resolved.public_id,
          })}`
        );
      }

      this.logger.log(
        `[discovery-identity] ${JSON.stringify({
          event: "resolved_by_public_id",
          requestId: requestId || null,
          targetProfileId: resolved.id,
          targetProfilePublicId: resolved.public_id,
        })}`
      );

      return resolved;
    }

    if (normalizedNumericId !== null) {
      const resolved = await this.findTargetProfileById(client, normalizedNumericId);
      if (!resolved) {
        this.logger.warn(
          `[discovery-identity] ${JSON.stringify({
            event: "numeric_id_not_found",
            requestId: requestId || null,
            targetProfileId: normalizedNumericId,
          })}`
        );
        return null;
      }

      this.logger.log(
        `[discovery-identity] ${JSON.stringify({
          event: "resolved_by_numeric_id",
          requestId: requestId || null,
          targetProfileId: resolved.id,
          targetProfilePublicId: resolved.public_id,
          deprecated: true,
        })}`
      );

      return resolved;
    }

    this.logger.error(
      `[discovery-identity] ${JSON.stringify({
        event: "missing_target_identity",
        requestId: requestId || null,
      })}`
    );

    return null;
  }

  private async resolveVisibleProfileIds(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    payload: Pick<DiscoveryDecisionPayload, "visibleProfileIds" | "visibleProfilePublicIds">
  ) {
    const normalizedPublicIds = Array.from(
      new Set(
        (Array.isArray(payload.visibleProfilePublicIds) ? payload.visibleProfilePublicIds : [])
          .map((value) => String(value || "").trim())
          .filter((value) => value.length > 0)
          .slice(0, DISCOVERY_POLICY_V1.visibleDeckSize)
      )
    );

    if (!normalizedPublicIds.length) {
      return this.normalizeVisibleProfileIds(payload.visibleProfileIds);
    }

    const result = await client.query<{ id: number; public_id: string }>(
      `SELECT id, public_id
       FROM core.profiles
       WHERE public_id = ANY($1::text[])`,
      [normalizedPublicIds]
    );

    const idByPublicId = new Map(
      result.rows.map((row) => [String(row.public_id).trim(), Number(row.id)] as const)
    );

    return normalizedPublicIds
      .map((publicId) => idByPublicId.get(publicId) ?? null)
      .filter(
        (value): value is number => value !== null && Number.isInteger(value) && value > 0
      );
  }

  private computeAge(dateOfBirth: string | null) {
    if (!dateOfBirth) {
      return null;
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
    if (
      monthDelta < 0 ||
      (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  private getFallbackImages(profile: Pick<DiscoveryFeedProfileRow, "gender_identity" | "id">) {
    const gender = String(profile.gender_identity || "").toLowerCase();
    const source = gender.includes("female")
      ? FEMALE_DISCOVERY_IMAGES
      : gender.includes("male")
        ? MALE_DISCOVERY_IMAGES
        : NON_BINARY_DISCOVERY_IMAGES;
    const start = profile.id % source.length;
    return Array.from({ length: 4 }, (_, index) => source[(start + index) % source.length]!);
  }

  private humanizeCode(value: string | null | undefined) {
    const source = String(value || "").trim();
    if (!source) {
      return "";
    }

    return source
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private async getStoredFiltersForActor(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number
  ): Promise<DiscoveryFilters> {
    const filtersResult = await client.query<{
      selected_genders: string[] | null;
      therian_mode: TherianMode | null;
      age_min: number | null;
      age_max: number | null;
    }>(
      `SELECT selected_genders, therian_mode, age_min, age_max
       FROM discovery.filter_preferences
       WHERE actor_profile_id = $1
       LIMIT 1`,
      [actorProfileId]
    );

    const filters = filtersResult.rows[0];
    if (!filters) {
      return this.defaultFilters();
    }

    return {
      selectedGenders: Array.isArray(filters.selected_genders)
        ? (filters.selected_genders.filter(Boolean) as BaseGender[])
        : [],
      therianMode: filters.therian_mode || "exclude",
      ageMin: Number(filters.age_min) || 18,
      ageMax: Number(filters.age_max) || 40,
    };
  }

  private normalizeWindowSize(size?: number | null) {
    const normalized = Number(size);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return DEFAULT_DISCOVERY_WINDOW_SIZE;
    }
    return Math.min(DISCOVERY_POLICY_V1.windowMaxSize, Math.max(1, Math.floor(normalized)));
  }

  private buildFiltersHash(filters: DiscoveryFilters) {
    return JSON.stringify({
      selectedGenders: [...filters.selectedGenders].sort(),
      therianMode: filters.therianMode,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
    });
  }

  private normalizeProfileId(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = typeof value === "number" ? value : Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }

  private normalizeVisibleProfileIds(profileIds: number[] | null | undefined) {
    return Array.from(
      new Set(
        (Array.isArray(profileIds) ? profileIds : [])
          .map((value) => this.normalizeProfileId(value))
          .filter((value): value is number => value !== null)
          .slice(0, DISCOVERY_POLICY_V1.visibleDeckSize)
      )
    );
  }

  private getCursorInvalidationReason(input: {
    cursor: string | null | undefined;
    decodedCursor: DiscoveryWindowCursorPayload | null;
    actorProfileId: number;
    filtersHash: string;
  }): DiscoveryQueueInvalidationReason | null {
    const rawCursor = String(input.cursor || "").trim();
    if (!rawCursor) {
      return null;
    }
    if (!input.decodedCursor) {
      return "cursor_stale";
    }
    if (input.decodedCursor.actorProfileId !== input.actorProfileId) {
      return "actor_changed";
    }
    if (input.decodedCursor.policyVersion !== DISCOVERY_POLICY_V1.policyVersion) {
      return "policy_version_changed";
    }
    if (input.decodedCursor.filtersHash !== input.filtersHash) {
      return "filters_changed";
    }
    return null;
  }

  private getOrderedCandidateStartIndex(
    orderedCandidates: OrderedCandidate[],
    cursor: DiscoveryWindowCursorPayload | null
  ) {
    if (!cursor || cursor.afterRank === null || cursor.afterProfileId === null) {
      return 0;
    }

    const nextIndex = orderedCandidates.findIndex(
      (entry) =>
        entry.rank > cursor.afterRank! ||
        (entry.rank === cursor.afterRank! && entry.profile.id > cursor.afterProfileId!)
    );

    return nextIndex >= 0 ? nextIndex : orderedCandidates.length;
  }

  private buildNextWindowCursor(
    actorProfileId: number,
    filtersHash: string,
    lastCandidate: OrderedCandidate | null
  ) {
    if (!lastCandidate) {
      return null;
    }

    return encodeDiscoveryWindowCursor({
      policyVersion: DISCOVERY_POLICY_V1.policyVersion,
      actorProfileId,
      filtersHash,
      afterRank: lastCandidate.rank,
      afterProfileId: lastCandidate.profile.id,
    });
  }

  private async getActorState(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number
  ) {
    const result = await client.query<ActorStateRow>(
      `SELECT
         queue_version,
         stream_version,
         filters_hash,
         last_served_sort_key,
         last_served_profile_id,
         active_queue_head_position,
         updated_at
       FROM discovery.actor_state
       WHERE actor_profile_id = $1
       LIMIT 1`,
      [actorProfileId]
    );

    return result.rows[0] || null;
  }

  private async upsertActorState(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    input: {
      queueVersion: number;
      streamVersion?: number;
      filtersHash: string;
      lastServedSortKey?: number | null;
      lastServedProfileId?: number | null;
      activeQueueHeadPosition?: number;
    }
  ) {
    await client.query(
      `INSERT INTO discovery.actor_state
        (
          actor_profile_id,
          queue_version,
          stream_version,
          filters_hash,
          last_served_sort_key,
          last_served_profile_id,
          active_queue_head_position,
          updated_at
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (actor_profile_id)
       DO UPDATE SET
         queue_version = EXCLUDED.queue_version,
         stream_version = EXCLUDED.stream_version,
         filters_hash = EXCLUDED.filters_hash,
         last_served_sort_key = EXCLUDED.last_served_sort_key,
         last_served_profile_id = EXCLUDED.last_served_profile_id,
         active_queue_head_position = EXCLUDED.active_queue_head_position,
         updated_at = NOW()`,
      [
        actorProfileId,
        input.queueVersion,
        input.streamVersion ?? 1,
        input.filtersHash,
        input.lastServedSortKey ?? null,
        input.lastServedProfileId ?? null,
        input.activeQueueHeadPosition ?? 1,
      ]
    );
  }

  private async getReservedQueueRows(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    queueVersion: number
  ) {
    const result = await client.query<ActorQueueRow>(
      `SELECT
         actor_profile_id,
         queue_version,
         position,
         target_profile_id,
         status,
         generated_at,
         source_bucket,
         rank_score
       FROM discovery.actor_queue
       WHERE actor_profile_id = $1
         AND queue_version = $2
         AND status = 'reserved'
       ORDER BY position ASC`,
      [actorProfileId, queueVersion]
    );

    return result.rows;
  }

  private computePolicyQueueVersion(actorProfileId: number, filtersHash: string) {
    const raw = `${DISCOVERY_POLICY_V1.policyVersion}:${actorProfileId}:${filtersHash}`;
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = (hash * 33 + raw.charCodeAt(index)) >>> 0;
    }
    // `discovery.actor_queue.queue_version` is stored as a signed Postgres integer,
    // so keep the runtime queue lineage inside the positive int32 range.
    return Math.max(1, hash & 0x7fffffff);
  }

  private evaluatePolicyFailureReason(
    actorProfileId: number,
    profile: DiscoveryFeedProfileRow,
    filters: DiscoveryFilters,
    decidedPublicIds: Set<string>
  ): DiscoveryExclusionReason | null {
    if (profile.id === actorProfileId) {
      return "self_excluded";
    }
    if (!profile.is_discoverable) {
      return "not_discoverable";
    }
    if (profile.kind === "user" && profile.onboarding_status !== "completed") {
      return "not_activated";
    }
    if (profile.kind === "user" && !profile.has_ready_media) {
      return "missing_ready_media";
    }
    if (profile.kind === "dummy" && !profile.synthetic_group) {
      return "not_discoverable";
    }

    const age = this.computeAge(profile.date_of_birth);
    if (age === null || age < filters.ageMin || age > filters.ageMax) {
      return "age_filtered";
    }

    const genderReason = evaluateGenderTherianReason(profile.gender_identity, filters);
    if (genderReason) {
      return genderReason;
    }

    if (decidedPublicIds.has(profile.public_id)) {
      return "already_decided";
    }

    return null;
  }

  private async repairLegacyActivatedUsers(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> }
  ) {
    const repaired = await client.query<{ user_id: number }>(
      `WITH eligible_repairs AS (
         SELECT DISTINCT p.user_id
         FROM core.profiles p
         WHERE p.kind = 'user'
           AND p.user_id IS NOT NULL
           AND COALESCE(TRIM(p.gender_identity), '') <> ''
           AND COALESCE(TRIM(p.pronouns), '') <> ''
           AND COALESCE(TRIM(p.personality), '') <> ''
           AND COALESCE(TRIM(p.relationship_goals), '') <> ''
           AND COALESCE(TRIM(p.children_preference), '') <> ''
           AND COALESCE(TRIM(p.education), '') <> ''
           AND COALESCE(TRIM(p.physical_activity), '') <> ''
           AND COALESCE(TRIM(p.body_type), '') <> ''
           AND EXISTS (
             SELECT 1
             FROM core.profile_languages pl
             WHERE pl.profile_id = p.id
           )
           AND EXISTS (
             SELECT 1
             FROM media.profile_images pi
             JOIN media.media_assets ma ON ma.id = pi.media_asset_id
             WHERE pi.profile_id = p.id
               AND ma.status = 'ready'
           )
           AND NOT EXISTS (
             SELECT 1
             FROM core.user_onboarding o
             WHERE o.user_id = p.user_id
               AND o.status = 'completed'::onboarding_status
           )
       )
       INSERT INTO core.user_onboarding
         (user_id, status, required_version, started_at, completed_at, exempted_at, completion_origin, created_at, updated_at)
       SELECT
         er.user_id,
         'completed'::onboarding_status,
         1,
         NOW(),
         NOW(),
         NULL,
         'legacy_backfill',
         NOW(),
         NOW()
       FROM eligible_repairs er
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'completed'::onboarding_status,
         completed_at = COALESCE(core.user_onboarding.completed_at, EXCLUDED.completed_at),
         completion_origin = CASE
           WHEN core.user_onboarding.status = 'completed'::onboarding_status
             THEN core.user_onboarding.completion_origin
           ELSE 'legacy_backfill'
         END,
         updated_at = NOW()
       WHERE core.user_onboarding.status <> 'completed'::onboarding_status
       RETURNING user_id`,
      []
    );

    if (repaired.rows.length) {
      this.logger.log(
        `[discovery-activation-backfill] ${JSON.stringify({
          repairedUserIds: repaired.rows.map((row) => row.user_id),
          repairedCount: repaired.rows.length,
        })}`
      );
    }
  }

  private async buildOrderedCandidateRows(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    filters: DiscoveryFilters
  ) {
    await this.repairLegacyActivatedUsers(client);
    const profilesResult = await client.query<DiscoveryFeedProfileRow>(
      `SELECT
         p.id,
         p.kind,
         p.public_id,
         p.display_name,
         p.profession,
         p.bio,
         p.content_locale,
         p.date_of_birth,
         p.location,
         p.is_discoverable,
         p.gender_identity,
         p.pronouns,
         p.personality,
         p.relationship_goals,
         p.education,
         p.children_preference,
         p.physical_activity,
         p.alcohol_use,
         p.tobacco_use,
         p.political_interest,
         p.religion_importance,
         p.religion,
         p.body_type,
         p.height,
         p.hair_color,
         p.ethnicity,
         pdm.synthetic_group,
         p.created_at,
         o.status AS onboarding_status,
         o.completed_at AS onboarding_completed_at,
         EXISTS (
           SELECT 1
           FROM media.profile_images pi
           JOIN media.media_assets ma ON ma.id = pi.media_asset_id
           WHERE pi.profile_id = p.id
             AND ma.status = 'ready'
         ) AS has_ready_media
       FROM core.profiles p
       LEFT JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
       LEFT JOIN core.user_onboarding o ON o.user_id = p.user_id
       ORDER BY p.id ASC`,
      []
    );
    const decisionsResult = await client.query<{ target_profile_public_id: string }>(
      `SELECT target_profile_public_id
       FROM discovery.profile_decisions
       WHERE actor_profile_id = $1`,
      [actorProfileId]
    );
    const decidedPublicIds = new Set(
      decisionsResult.rows
        .map((row) => String(row.target_profile_public_id).trim())
        .filter((value) => value.length > 0)
    );

    const exclusionCounts: Partial<Record<DiscoveryExclusionReason, number>> = {};
    const orderedReal: OrderedCandidate[] = [];
    const orderedDummy: OrderedCandidate[] = [];
    let filteredRealBeforeDecisions = 0;
    let filteredDummyBeforeDecisions = 0;

    for (const profile of profilesResult.rows) {
      const failureReason = this.evaluatePolicyFailureReason(
        actorProfileId,
        profile,
        filters,
        decidedPublicIds
      );
      if (failureReason) {
        exclusionCounts[failureReason] = Number(exclusionCounts[failureReason] || 0) + 1;
        if (failureReason === "already_decided") {
          if (profile.kind === "user") {
            filteredRealBeforeDecisions += 1;
          } else if (profile.kind === "dummy") {
            filteredDummyBeforeDecisions += 1;
          }
        }
        continue;
      }

      const bucket: DiscoveryCandidateBucket = profile.kind === "user" ? "real" : "dummy";
      if (bucket === "real") {
        filteredRealBeforeDecisions += 1;
      } else {
        filteredDummyBeforeDecisions += 1;
      }

      const candidate: OrderedCandidate = {
        profile,
        bucket,
        rank: computeStableDiscoveryRank(
          actorProfileId,
          profile.id,
          DISCOVERY_POLICY_V1.policyVersion
        ),
      };
      if (bucket === "real") {
        orderedReal.push(candidate);
      } else {
        orderedDummy.push(candidate);
      }
    }

    const sortCandidates = (left: OrderedCandidate, right: OrderedCandidate) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.profile.id - right.profile.id;
    };

    orderedReal.sort(sortCandidates);
    orderedDummy.sort(sortCandidates);

    const orderedCandidates = [...orderedReal, ...orderedDummy];
    const dominantExclusionReason = getDominantExclusionReason(exclusionCounts);
    let exhaustedReason: DiscoveryExhaustedReason | null = null;
    if (orderedCandidates.length === 0) {
      if (
        Number(exclusionCounts.already_decided || 0) > 0 &&
        filteredRealBeforeDecisions + filteredDummyBeforeDecisions ===
          Number(exclusionCounts.already_decided || 0)
      ) {
        exhaustedReason = "all_candidates_already_decided";
      } else if (filteredRealBeforeDecisions === 0 && filteredDummyBeforeDecisions === 0) {
        exhaustedReason = "filters_too_narrow";
      } else if (filteredRealBeforeDecisions === 0 && filteredDummyBeforeDecisions > 0) {
        exhaustedReason = "pool_exhausted_real_only_dummy_available";
      } else {
        exhaustedReason = "pool_exhausted_real_and_dummy";
      }
    }

    return {
      orderedCandidates,
      diagnostics: {
        eligibleRealCount: orderedReal.length,
        eligibleDummyCount: orderedDummy.length,
        returnedRealCount: 0,
        returnedDummyCount: 0,
        dominantExclusionReason,
        exhaustedReason,
        exclusionCounts,
      } satisfies DiscoveryPolicyDiagnostics,
    };
  }

  private async hydrateDiscoveryProfiles(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    visibleProfiles: DiscoveryFeedProfileRow[]
  ) {
    const visibleProfileIds = visibleProfiles.map((profile) => profile.id);

    let languagesResult = { rows: [] as DiscoveryFeedLanguageRow[] };
    let interestsResult = { rows: [] as DiscoveryFeedInterestRow[] };
    let imagesResult = { rows: [] as DiscoveryFeedImageRow[] };
    let insightsResult = { rows: [] as DiscoveryFeedInsightRow[] };
    let goalFeedbackResult = { rows: [] as DiscoveryFeedGoalFeedbackRow[] };

    if (visibleProfileIds.length > 0) {
      languagesResult = await client.query<DiscoveryFeedLanguageRow>(
        `SELECT profile_id, language_code, position
         FROM core.profile_languages
         WHERE profile_id = ANY($1::bigint[])
         ORDER BY profile_id ASC, position ASC, language_code ASC`,
        [visibleProfileIds]
      );
      interestsResult = await client.query<DiscoveryFeedInterestRow>(
        `SELECT profile_id, interest_code, position
         FROM core.profile_interests
         WHERE profile_id = ANY($1::bigint[])
         ORDER BY profile_id ASC, position ASC, interest_code ASC`,
        [visibleProfileIds]
      );
      imagesResult = await client.query<DiscoveryFeedImageRow>(
        `SELECT
           pi.profile_id,
           pi.id AS profile_image_id,
           pi.sort_order,
           ma.id AS media_asset_id
         FROM media.profile_images pi
         JOIN media.media_assets ma ON ma.id = pi.media_asset_id
         WHERE pi.profile_id = ANY($1::bigint[])
           AND ma.status = 'ready'
         ORDER BY pi.profile_id ASC, pi.sort_order ASC`,
        [visibleProfileIds]
      );
      insightsResult = await client.query<DiscoveryFeedInsightRow>(
        `SELECT profile_id, locale, value, sort_order
         FROM discovery.profile_insight_tags
         WHERE profile_id = ANY($1::bigint[])
         ORDER BY profile_id ASC, locale ASC, sort_order ASC`,
        [visibleProfileIds]
      );
      goalFeedbackResult = await client.query<DiscoveryFeedGoalFeedbackRow>(
        `SELECT profile_id, goal_key, reason_es, reason_en
         FROM discovery.profile_goal_feedback
         WHERE profile_id = ANY($1::bigint[])
         ORDER BY profile_id ASC, goal_key ASC`,
        [visibleProfileIds]
      );
    }

    const languagesByProfile = new Map<number, string[]>();
    for (const row of languagesResult.rows) {
      const current = languagesByProfile.get(row.profile_id) || [];
      current.push(row.language_code);
      languagesByProfile.set(row.profile_id, current);
    }

    const interestsByProfile = new Map<number, string[]>();
    for (const row of interestsResult.rows) {
      const current = interestsByProfile.get(row.profile_id) || [];
      current.push(row.interest_code);
      interestsByProfile.set(row.profile_id, current);
    }

    const imagesByProfile = new Map<number, string[]>();
    const debugPhotosByProfile = new Map<number, DiscoveryDebugPhoto[]>();
    for (const row of imagesResult.rows) {
      const resolvedUrl = this.buildPublicMediaUrl(Number(row.media_asset_id));
      if (!resolvedUrl) {
        continue;
      }
      const current = imagesByProfile.get(row.profile_id) || [];
      current.push(resolvedUrl);
      imagesByProfile.set(row.profile_id, current);
      const debugPhotos = debugPhotosByProfile.get(row.profile_id) || [];
      debugPhotos.push({
        profileImageId: Number(row.profile_image_id),
        mediaAssetId: Number(row.media_asset_id),
        sortOrder: Number(row.sort_order),
        remoteUrl: resolvedUrl,
        source: "db_confirmed",
      });
      debugPhotosByProfile.set(row.profile_id, debugPhotos);
    }

    const insightsByProfile = new Map<number, { es: string; en: string }[]>();
    for (const row of insightsResult.rows) {
      const current = insightsByProfile.get(row.profile_id) || [];
      const index = current[row.sort_order] ? row.sort_order : current.length;
      current[index] = {
        es:
          row.locale === "es"
            ? row.value
            : current[index]?.es || this.humanizeCode(row.value),
        en:
          row.locale === "en"
            ? row.value
            : current[index]?.en || this.humanizeCode(row.value),
      };
      insightsByProfile.set(row.profile_id, current.filter(Boolean));
    }

    const goalFeedbackByProfile = new Map<
      number,
      Array<{ goalId: string; reason: { es: string; en: string } }>
    >();
    for (const row of goalFeedbackResult.rows) {
      const current = goalFeedbackByProfile.get(row.profile_id) || [];
      current.push({
        goalId: row.goal_key,
        reason: {
          es: row.reason_es,
          en: row.reason_en,
        },
      });
      goalFeedbackByProfile.set(row.profile_id, current);
    }

    const hydrated = visibleProfiles.map((profile) => {
      const age = this.computeAge(profile.date_of_birth) || 0;
      const languages = languagesByProfile.get(profile.id) || [];
      const interests = interestsByProfile.get(profile.id) || [];
      const images = imagesByProfile.get(profile.id);
      const isDummyProfile = Boolean(profile.synthetic_group);
      const candidateBucket: DiscoveryCandidateBucket =
        profile.kind === "user" ? "real" : "dummy";
      const resolvedImages =
        images && images.length > 0
          ? images
          : isDummyProfile
            ? this.getFallbackImages(profile)
            : [];
      const mediaSource =
        images && images.length > 0
          ? "real_media"
          : isDummyProfile
            ? "dummy_fallback"
            : "missing_real_media";
      const debugPhotos =
        images && images.length > 0
          ? debugPhotosByProfile.get(profile.id) || []
          : isDummyProfile
            ? resolvedImages.map((url, index) => ({
                profileImageId: null,
                mediaAssetId: null,
                sortOrder: index,
                remoteUrl: url,
                source: "dummy_fallback" as const,
              }))
            : [];
      const insightTags =
        insightsByProfile.get(profile.id) ||
        [
          {
            es: this.humanizeCode(profile.personality),
            en: this.humanizeCode(profile.personality),
          },
        ].filter((entry) => entry.es || entry.en);

      return {
        id: profile.id,
        publicId: profile.public_id,
        name: profile.display_name,
        age,
        dateOfBirth: profile.date_of_birth || "",
        pronouns: profile.pronouns,
        genderIdentity: profile.gender_identity,
        location: profile.location,
        occupation: {
          es: profile.profession,
          en: profile.profession,
        },
        attributes: {
          bodyType: profile.body_type,
          height: profile.height,
          interests,
        },
        about: {
          bio: {
            es: profile.bio,
            en: profile.bio,
          },
          relationshipGoals: profile.relationship_goals,
          education: profile.education,
          childrenPreference: profile.children_preference,
          languagesSpoken: languages,
        },
        lifestyle: {
          physicalActivity: profile.physical_activity,
          alcoholUse: profile.alcohol_use,
          tobaccoUse: profile.tobacco_use,
          politicalInterest: profile.political_interest,
          religionImportance: profile.religion_importance,
          religion: profile.religion,
        },
        physical: {
          bodyType: profile.body_type,
          height: profile.height,
          hairColor: profile.hair_color,
          ethnicity: profile.ethnicity,
        },
        images: resolvedImages,
        insightTags,
        goalFeedback: goalFeedbackByProfile.get(profile.id) || [],
        categoryValues: normalizePopularAttributeInput({
          physical: profile.body_type || null,
          personality: profile.personality || null,
          family: profile.children_preference || null,
          expectations: profile.relationship_goals || null,
          language: languages[0] || null,
          studies: profile.education || null,
        }),
        debugMedia: {
          candidateBucket,
          profileKind: profile.kind,
          hasDummyMetadata: isDummyProfile,
          hasReadyMedia: Boolean(images && images.length > 0),
          mediaSource,
          imageCount: resolvedImages.length,
          photos: debugPhotos,
        },
      };
    });

    this.logger.log(
      `[discovery-image-hydration] ${JSON.stringify(
        hydrated.map((profile) => ({
          profileId: profile.id,
          candidateBucket: profile.debugMedia.candidateBucket,
          profileKind: profile.debugMedia.profileKind,
          hasDummyMetadata: profile.debugMedia.hasDummyMetadata,
          hasReadyMedia: profile.debugMedia.hasReadyMedia,
          mediaSource: profile.debugMedia.mediaSource,
          imageCount: profile.debugMedia.imageCount,
        }))
      )}`
    );

    hydrated.forEach((profile) => {
      if (
        profile.debugMedia.candidateBucket === "dummy" &&
        profile.debugMedia.mediaSource === "real_media"
      ) {
        this.logger.warn(
          `[queue_bucket_hydration_mismatch] ${JSON.stringify({
            profileId: profile.id,
            candidateBucket: profile.debugMedia.candidateBucket,
            profileKind: profile.debugMedia.profileKind,
            hasDummyMetadata: profile.debugMedia.hasDummyMetadata,
            hasReadyMedia: profile.debugMedia.hasReadyMedia,
            hydrationMediaSource: profile.debugMedia.mediaSource,
          })}`
        );
      }
    });

    return hydrated;
  }

  private buildWindowSupply(
    orderedCandidates: OrderedCandidate[],
    policyResult: { diagnostics: DiscoveryPolicyDiagnostics },
    returnedCandidates: OrderedCandidate[]
  ) {
    const returnedRealCount = returnedCandidates.filter((entry) => entry.bucket === "real").length;
    const returnedDummyCount = returnedCandidates.filter((entry) => entry.bucket === "dummy").length;
    const decidedCount = Number(policyResult.diagnostics.exclusionCounts.already_decided || 0);

    return {
      eligibleCount: orderedCandidates.length,
      unseenCount: Math.max(0, orderedCandidates.length - returnedCandidates.length),
      decidedCount,
      exhausted: returnedCandidates.length === 0,
      fetchedAt: new Date().toISOString(),
      policyVersion: DISCOVERY_POLICY_V1.policyVersion,
      eligibleRealCount: policyResult.diagnostics.eligibleRealCount,
      eligibleDummyCount: policyResult.diagnostics.eligibleDummyCount,
      returnedRealCount,
      returnedDummyCount,
      dominantExclusionReason: policyResult.diagnostics.dominantExclusionReason,
      exhaustedReason: policyResult.diagnostics.exhaustedReason,
      refillThreshold: DISCOVERY_POLICY_V1.refillThreshold,
    };
  }

  private async buildDiscoveryReplacementForActor(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    filters: DiscoveryFilters,
    cursor: string | null | undefined,
    visibleProfileIds: number[],
    targetProfileId?: number | null
  ) {
    const filtersHash = this.buildFiltersHash(filters);
    const decodedCursor = decodeDiscoveryWindowCursor(cursor);
    const invalidationReason = this.getCursorInvalidationReason({
      cursor,
      decodedCursor,
      actorProfileId,
      filtersHash,
    });

    if (invalidationReason) {
      throw new DiscoveryCursorError(invalidationReason);
    }

    const policyResult = await this.buildOrderedCandidateRows(
      client,
      actorProfileId,
      filters
    );
    const orderedCandidates = policyResult.orderedCandidates;
    const startIndex = this.getOrderedCandidateStartIndex(orderedCandidates, decodedCursor);
    const excludedIds = new Set(this.normalizeVisibleProfileIds(visibleProfileIds));
    
    // CRITICAL: Always exclude the target profile that was just acted upon
    if (targetProfileId != null && Number.isFinite(targetProfileId) && targetProfileId > 0) {
      excludedIds.add(targetProfileId);
    }
    
    let replacementCandidate: OrderedCandidate | null = null;
    let replacementIndex = -1;

    for (let index = startIndex; index < orderedCandidates.length; index += 1) {
      const candidate = orderedCandidates[index]!;
      const normalizedCandidateId = this.normalizeProfileId(candidate.profile.id);
      if (normalizedCandidateId !== null && excludedIds.has(normalizedCandidateId)) {
        continue;
      }
      replacementCandidate = candidate;
      replacementIndex = index;
      break;
    }
    
    // INVARIANT: Replacement must never be the same as the target
    if (
      replacementCandidate &&
      targetProfileId != null &&
      replacementCandidate.profile.id === targetProfileId
    ) {
      this.warnDecisionEvent("replacement_invariant_violation", {
        actorProfileId,
        targetProfileId,
        replacementProfileId: replacementCandidate.profile.id,
        message: "Replacement candidate equals target profile - forcing null",
      });
      replacementCandidate = null;
      replacementIndex = -1;
    }

    const replacementProfiles = replacementCandidate
      ? await this.hydrateDiscoveryProfiles(client, [replacementCandidate.profile])
      : [];
    const nextCursor = replacementCandidate
      ? this.buildNextWindowCursor(actorProfileId, filtersHash, replacementCandidate)
      : null;
    const hasMore =
      replacementIndex >= 0
        ? orderedCandidates.some(
            (entry, index) =>
              index > replacementIndex && !excludedIds.has(entry.profile.id)
          )
        : false;

    return {
      replacementProfile: replacementProfiles[0] || null,
      nextCursor,
      hasMore,
      supply: {
        ...this.buildWindowSupply(
          orderedCandidates,
          policyResult,
          replacementCandidate ? [replacementCandidate] : []
        ),
        unseenCount:
          replacementIndex >= 0
            ? Math.max(0, orderedCandidates.length - (replacementIndex + 1))
            : 0,
        exhausted: replacementCandidate == null,
      },
    };
  }

  private async buildDiscoveryWindowForActor(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    options?: DiscoveryWindowOptions
  ): Promise<DiscoveryWindowResult> {
    const size = this.normalizeWindowSize(options?.size);
    const filters = await this.getStoredFiltersForActor(client, actorProfileId);
    const filtersHash = this.buildFiltersHash(filters);
    const queueVersion = this.computePolicyQueueVersion(actorProfileId, filtersHash);
    const policyResult = await this.buildOrderedCandidateRows(
      client,
      actorProfileId,
      filters
    );
    const orderedCandidates = policyResult.orderedCandidates;
    const decodedCursor = decodeDiscoveryWindowCursor(options?.cursor);
    const queueInvalidationReason = this.getCursorInvalidationReason({
      cursor: options?.cursor,
      decodedCursor,
      actorProfileId,
      filtersHash,
    });
    const startIndex = queueInvalidationReason
      ? 0
      : this.getOrderedCandidateStartIndex(orderedCandidates, decodedCursor);
    const visibleCandidates = orderedCandidates.slice(startIndex, startIndex + size);
    const visibleProfiles = visibleCandidates.map((entry) => entry.profile);
    const hydratedProfiles = await this.hydrateDiscoveryProfiles(client, visibleProfiles);
    const generatedAt = new Date().toISOString();
    const hasMore = startIndex + visibleCandidates.length < orderedCandidates.length;
    const lastVisibleCandidate =
      visibleCandidates.length > 0 ? visibleCandidates[visibleCandidates.length - 1]! : null;
    const nextCursor = hasMore
      ? this.buildNextWindowCursor(actorProfileId, filtersHash, lastVisibleCandidate)
      : null;
    const supply = {
      ...this.buildWindowSupply(orderedCandidates, policyResult, visibleCandidates),
      unseenCount: Math.max(0, orderedCandidates.length - (startIndex + visibleCandidates.length)),
      exhausted: hydratedProfiles.length === 0,
    };

    this.logger.log(
      `[discovery-policy-window] ${JSON.stringify({
        actorProfileId,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        queueVersion,
        requestedSize: size,
        cursorStart: startIndex,
        queueInvalidationReason,
        returnedIds: hydratedProfiles.map((profile) => profile.id),
        eligibleRealCount: policyResult.diagnostics.eligibleRealCount,
        eligibleDummyCount: policyResult.diagnostics.eligibleDummyCount,
        returnedRealCount: supply.returnedRealCount,
        returnedDummyCount: supply.returnedDummyCount,
        dominantExclusionReason: policyResult.diagnostics.dominantExclusionReason,
        exhaustedReason: policyResult.diagnostics.exhaustedReason,
        exhausted: hydratedProfiles.length === 0,
      })}`
    );
    this.logQueueEvent("window_response", {
      actorId: actorProfileId,
      requestId: options?.requestId ?? null,
      queueVersion,
      policyVersion: DISCOVERY_POLICY_V1.policyVersion,
      visibleQueue: hydratedProfiles.map((profile) => profile.id),
      activeProfileId: hydratedProfiles[0]?.id ?? null,
      action: null,
      replacementProfileId: null,
      resultQueue: hydratedProfiles.map((profile) => profile.id),
      queueInvalidationReason,
      nextCursor,
      hasMore,
      eligibleRealCount: policyResult.diagnostics.eligibleRealCount,
      eligibleDummyCount: policyResult.diagnostics.eligibleDummyCount,
      returnedRealCount: supply.returnedRealCount,
      returnedDummyCount: supply.returnedDummyCount,
      dominantExclusionReason: policyResult.diagnostics.dominantExclusionReason,
      exhaustedReason: policyResult.diagnostics.exhaustedReason,
    });

    return {
      queueVersion,
      policyVersion: DISCOVERY_POLICY_V1.policyVersion,
      generatedAt,
      windowSize: size,
      reserveCount: Math.min(
        DISCOVERY_POLICY_V1.queueTargetSize,
        Math.max(orderedCandidates.length - startIndex, 0)
      ),
      profiles: hydratedProfiles,
      nextCursor,
      hasMore,
      ...(queueInvalidationReason
        ? {
            queueInvalidated: true,
            queueInvalidationReason,
          }
        : {}),
      supply,
    };
  }

  async getPreferences(userId: number) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();
    try {
      return this.buildDiscoveryState(client, userId, actorProfileId);
    } finally {
      client.release();
    }
  }

  async updatePreferences(
    userId: number,
    filters: DiscoveryFilters
  ) {
    const actorProfileId = await this.findActorProfileId(userId);
    const previousState = await this.getActorState(pool, actorProfileId);
    await pool.query(
      `INSERT INTO discovery.filter_preferences
        (actor_profile_id, selected_genders, therian_mode, age_min, age_max)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       ON CONFLICT (actor_profile_id)
       DO UPDATE SET
         selected_genders = EXCLUDED.selected_genders,
         therian_mode = EXCLUDED.therian_mode,
         age_min = EXCLUDED.age_min,
         age_max = EXCLUDED.age_max,
         updated_at = NOW()`,
      [
        actorProfileId,
        JSON.stringify(filters.selectedGenders),
        filters.therianMode,
        filters.ageMin,
        filters.ageMax,
      ]
    );

    this.logger.log(
      `[discovery-filters-updated] ${JSON.stringify({
        userId,
        actorProfileId,
        previousQueueVersion: previousState?.queue_version ?? null,
        filters,
      })}`
    );

    return this.getPreferences(userId);
  }

  async getFeed(userId: number, options?: DiscoveryFeedOptions) {
    return this.getWindow(userId, {
      size: options?.limit,
      cursor: options?.cursor || null,
      requestId: options?.requestId || null,
    });
  }

  async getWindow(userId: number, options?: DiscoveryWindowOptions) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const window = await this.buildDiscoveryWindowForActor(client, actorProfileId, options);
      await client.query("COMMIT");
      return window;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getBootstrapState(userId: number) {
    const [preferences, feed] = await Promise.all([
      this.getPreferences(userId),
      this.getWindow(userId),
    ]);

    return {
      ...preferences,
      feed,
    };
  }

  async resetDecisions(userId: number) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO discovery.profile_reset_state
          (actor_profile_id, last_reset_at, updated_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (actor_profile_id) DO UPDATE SET
           last_reset_at = NOW(),
           updated_at = NOW()`,
        [actorProfileId]
      );

      const rebuilt = await rebuildDiscoveryProjectionsForActor(client, actorProfileId);
      const goalsUnlock = await this.goalsService.getGoalsUnlockState(userId, client);
      await this.goalsService.rebuildUserGoalTargets(userId, client, {
        refreshPreferences: false,
      });

      const preferences = {
        ...(await this.buildDiscoveryState(client, userId, actorProfileId, {
          preferences: rebuilt,
          unlockState: goalsUnlock,
        })),
      };
      await client.query("COMMIT");
      return preferences;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async likeProfile(
    userId: number,
    payload: DiscoveryDecisionPayload
  ) {
    return this.recordProfileDecision(userId, "like", payload);
  }

  async passProfile(
    userId: number,
    payload: DiscoveryDecisionPayload
  ) {
    return this.recordProfileDecision(userId, "pass", payload);
  }

  async decideProfile(
    userId: number,
    payload: DiscoveryDecisionPayload & {
      action: "like" | "pass";
    }
  ) {
    return this.recordProfileDecision(userId, payload.action, payload);
  }

  private async recordProfileDecision(
    userId: number,
    interactionType: "like" | "pass",
    payload: DiscoveryDecisionPayload
  ) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();
    const startedAt = Date.now();

    try {
      await client.query("BEGIN");

      const previous = await getDiscoveryPreferencesForActor(client, actorProfileId);
      const previousThresholdReached = Boolean(previous.threshold?.thresholdReached);
      const normalizedCategoryValues = normalizePopularAttributeInput(payload.categoryValues);
      const normalizedRequestId = String(payload.requestId || "").trim() || null;
      const normalizedCursor = String(payload.cursor || "").trim() || null;
      const normalizedVisibleProfileIds = await this.resolveVisibleProfileIds(client, payload);
      const providedTargetProfileId = this.normalizeProfileId(payload.targetProfileId);
      const providedTargetProfilePublicId =
        String(payload.targetProfilePublicId || "").trim() || null;
      const requestedQueueVersion =
        Number.isFinite(Number(payload.queueVersion)) && Number(payload.queueVersion) > 0
          ? Number(payload.queueVersion)
          : null;
      const targetProfile = await this.resolveTargetProfile(client, payload, normalizedRequestId);
      const currentFilters = await this.getStoredFiltersForActor(client, actorProfileId);
      const previousTotals = {
        totalLikes: previous.threshold?.totalLikes ?? previous.totalLikesCount ?? 0,
        totalPasses: previous.threshold?.totalPasses ?? previous.lifetimeCounts?.passes ?? 0,
        thresholdReached: previous.threshold?.thresholdReached ?? false,
      };

      this.logDecisionEvent("received", {
        requestId: normalizedRequestId,
        userId,
        actorProfileId,
        targetProfileId: providedTargetProfileId,
        targetProfilePublicId: providedTargetProfilePublicId,
        interactionType,
        queueVersion: requestedQueueVersion,
        previousTotals,
      });
      this.logQueueEvent("decision_received", {
        actorId: actorProfileId,
        requestId: normalizedRequestId,
        queueVersion: requestedQueueVersion,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        visibleQueue: normalizedVisibleProfileIds,
        activeProfileId: normalizedVisibleProfileIds[0] ?? null,
        action: interactionType,
        targetProfileId: providedTargetProfileId,
      });

      if (!targetProfile) {
        this.warnDecisionEvent("invalid_target_not_found", {
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: providedTargetProfileId,
          targetProfilePublicId: providedTargetProfilePublicId,
          interactionType,
          durationMs: Date.now() - startedAt,
        });
        throw new Error("DISCOVERY_TARGET_NOT_FOUND");
      }

      if (targetProfile.id === actorProfileId) {
        this.warnDecisionEvent("invalid_target_is_self", {
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: targetProfile.id,
          targetProfilePublicId: targetProfile.public_id,
          interactionType,
          durationMs: Date.now() - startedAt,
        });
        throw new Error("DISCOVERY_CANNOT_DECIDE_ON_SELF");
      }

      const cursorInvalidationReason = this.getCursorInvalidationReason({
        cursor: normalizedCursor,
        decodedCursor: decodeDiscoveryWindowCursor(normalizedCursor),
        actorProfileId,
        filtersHash: this.buildFiltersHash(currentFilters),
      });
      if (cursorInvalidationReason) {
        this.warnDecisionEvent("cursor_stale", {
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: targetProfile.id,
          interactionType,
          queueInvalidationReason: cursorInvalidationReason,
          durationMs: Date.now() - startedAt,
        });
        this.logQueueEvent("cursor_stale", {
          actorId: actorProfileId,
          requestId: normalizedRequestId,
          queueVersion: requestedQueueVersion,
          policyVersion: DISCOVERY_POLICY_V1.policyVersion,
          visibleQueue: normalizedVisibleProfileIds,
          activeProfileId: normalizedVisibleProfileIds[0] ?? null,
          action: interactionType,
          targetProfileId: targetProfile.id,
          queueInvalidationReason: cursorInvalidationReason,
        });
        throw new DiscoveryCursorError(cursorInvalidationReason);
      }
      this.logQueueEvent("decision_validation", {
        actorId: actorProfileId,
        requestId: normalizedRequestId,
        queueVersion: requestedQueueVersion,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        visibleQueue: normalizedVisibleProfileIds,
        activeProfileId: normalizedVisibleProfileIds[0] ?? null,
        action: interactionType,
        targetProfileId: targetProfile.id,
        queueInvalidationReason: null,
      });

      if (normalizedRequestId) {
        const existingRequest = await client.query<{ id: number }>(
          `SELECT id
           FROM discovery.profile_interactions
           WHERE actor_profile_id = $1
             AND request_id = $2
           LIMIT 1`,
          [actorProfileId, normalizedRequestId]
        );

        if (existingRequest.rows[0]?.id) {
          const rebuilt = await this.buildDiscoveryState(client, userId, actorProfileId);
          const replacement = await this.buildDiscoveryReplacementForActor(
            client,
            actorProfileId,
            currentFilters,
            normalizedCursor,
            normalizedVisibleProfileIds,
            targetProfile.id
          );
          const queueVersion = this.computePolicyQueueVersion(
            actorProfileId,
            this.buildFiltersHash(currentFilters)
          );
          this.logDecisionEvent("duplicate_request_id", {
            decisionApplied: false,
            decisionRejectedReason: "duplicate_request_id",
            requestId: normalizedRequestId,
            userId,
            actorProfileId,
            targetProfileId: targetProfile.id,
            interactionType,
            queueVersion,
            durationMs: Date.now() - startedAt,
            nextTotals: {
              totalLikes: rebuilt.threshold.totalLikes,
              totalPasses: rebuilt.threshold.totalPasses,
              thresholdReached: rebuilt.threshold.thresholdReached,
            },
            replacementProfileId: replacement.replacementProfile?.id ?? null,
          });
          this.logQueueEvent("replacement_selected", {
            actorId: actorProfileId,
            requestId: normalizedRequestId,
            queueVersion,
            policyVersion: DISCOVERY_POLICY_V1.policyVersion,
            visibleQueue: normalizedVisibleProfileIds,
            activeProfileId: normalizedVisibleProfileIds[0] ?? null,
            action: interactionType,
            targetProfileId: targetProfile.id,
            replacementProfileId: replacement.replacementProfile?.id ?? null,
          });
          await client.query("COMMIT");
          this.logQueueEvent("decision_response", {
            actorId: actorProfileId,
            requestId: normalizedRequestId,
            queueVersion,
            policyVersion: DISCOVERY_POLICY_V1.policyVersion,
            visibleQueue: normalizedVisibleProfileIds,
            activeProfileId: normalizedVisibleProfileIds[0] ?? null,
            action: interactionType,
            targetProfileId: targetProfile.id,
            replacementProfileId: replacement.replacementProfile?.id ?? null,
            decisionApplied: false,
            decisionRejectedReason: "duplicate_request_id",
            nextCursor: replacement.nextCursor,
            hasMore: replacement.hasMore,
            eligibleRealCount: replacement.supply.eligibleRealCount ?? null,
            eligibleDummyCount: replacement.supply.eligibleDummyCount ?? null,
            returnedRealCount: replacement.supply.returnedRealCount ?? null,
            returnedDummyCount: replacement.supply.returnedDummyCount ?? null,
            dominantExclusionReason: replacement.supply.dominantExclusionReason ?? null,
            exhaustedReason: replacement.supply.exhaustedReason ?? null,
          });
          return {
            requestId: normalizedRequestId,
            decisionApplied: false,
            decisionState: interactionType,
            targetProfileId: targetProfile.id,
            targetProfilePublicId: targetProfile.public_id,
            decisionRejectedReason: "duplicate_request_id",
            changedCategories: [],
            shouldShowDiscoveryUpdate: false,
            ...rebuilt,
            filters: currentFilters,
            queueVersion,
            policyVersion: DISCOVERY_POLICY_V1.policyVersion,
            replacementProfile: replacement.replacementProfile,
            nextCursor: replacement.nextCursor,
            hasMore: replacement.hasMore,
            supply: replacement.supply,
          };
        }
      }

      const existingDecision = await client.query<{ current_state: "like" | "pass" }>(
        `SELECT current_state
         FROM discovery.profile_decisions
         WHERE actor_profile_id = $1
           AND target_profile_public_id = $2
         LIMIT 1`,
        [actorProfileId, targetProfile.public_id]
      );

      if (existingDecision.rows[0]?.current_state === interactionType) {
        const currentUnlockState = await this.goalsService.getGoalsUnlockState(userId, client);
        const replacement = await this.buildDiscoveryReplacementForActor(
          client,
          actorProfileId,
          currentFilters,
          normalizedCursor,
          normalizedVisibleProfileIds,
          targetProfile.id
        );
        const queueVersion = this.computePolicyQueueVersion(
          actorProfileId,
          this.buildFiltersHash(currentFilters)
        );
        this.logDecisionEvent("same_state_existing_decision", {
          decisionApplied: false,
          decisionRejectedReason: "same_state_existing_decision",
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: targetProfile.id,
          interactionType,
          queueVersion,
          durationMs: Date.now() - startedAt,
          nextTotals: previousTotals,
          unlockAvailable: currentUnlockState.available,
          unlockPending: currentUnlockState.unlockMessagePending,
          replacementProfileId: replacement.replacementProfile?.id ?? null,
        });
        this.logQueueEvent("replacement_selected", {
          actorId: actorProfileId,
          requestId: normalizedRequestId,
          queueVersion,
          policyVersion: DISCOVERY_POLICY_V1.policyVersion,
          visibleQueue: normalizedVisibleProfileIds,
          activeProfileId: normalizedVisibleProfileIds[0] ?? null,
          action: interactionType,
          targetProfileId: targetProfile.id,
          replacementProfileId: replacement.replacementProfile?.id ?? null,
        });
        await client.query("COMMIT");
        this.logQueueEvent("decision_response", {
          actorId: actorProfileId,
          requestId: normalizedRequestId,
          queueVersion,
          policyVersion: DISCOVERY_POLICY_V1.policyVersion,
          visibleQueue: normalizedVisibleProfileIds,
          activeProfileId: normalizedVisibleProfileIds[0] ?? null,
          action: interactionType,
          targetProfileId: targetProfile.id,
          replacementProfileId: replacement.replacementProfile?.id ?? null,
          decisionApplied: false,
          decisionRejectedReason: "same_state_existing_decision",
          nextCursor: replacement.nextCursor,
          hasMore: replacement.hasMore,
          eligibleRealCount: replacement.supply.eligibleRealCount ?? null,
          eligibleDummyCount: replacement.supply.eligibleDummyCount ?? null,
          returnedRealCount: replacement.supply.returnedRealCount ?? null,
          returnedDummyCount: replacement.supply.returnedDummyCount ?? null,
          dominantExclusionReason: replacement.supply.dominantExclusionReason ?? null,
          exhaustedReason: replacement.supply.exhaustedReason ?? null,
        });
        return {
          requestId: normalizedRequestId,
          decisionApplied: false,
          decisionState: interactionType,
          targetProfileId: targetProfile.id,
          targetProfilePublicId: targetProfile.public_id,
          decisionRejectedReason: "same_state_existing_decision",
          changedCategories: [],
          shouldShowDiscoveryUpdate: false,
          ...previous,
          goalsUnlock: currentUnlockState,
          filters: currentFilters,
          queueVersion,
          policyVersion: DISCOVERY_POLICY_V1.policyVersion,
          replacementProfile: replacement.replacementProfile,
          nextCursor: replacement.nextCursor,
          hasMore: replacement.hasMore,
          supply: replacement.supply,
        };
      }

      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO discovery.profile_interactions
          (actor_profile_id, target_profile_id, target_profile_public_id, interaction_type, decision_source, request_id, category_values_json, metadata_json)
         VALUES ($1, $2, $3, $4, 'api', $5, $6::jsonb, $7::jsonb)
         RETURNING id`,
        [
          actorProfileId,
          targetProfile.id,
          targetProfile.public_id,
          interactionType,
          normalizedRequestId,
          JSON.stringify(normalizedCategoryValues),
          JSON.stringify({
            actorProfileId,
            targetProfileId: targetProfile.id,
            targetProfilePublicId: targetProfile.public_id,
            interactionType,
          }),
        ]
      );

      if (!insertResult.rows[0]?.id) {
        this.warnDecisionEvent("decision_insert_failed", {
          decisionApplied: false,
          errorCode: DISCOVERY_DECISION_WRITE_FAILED,
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: targetProfile.id,
          interactionType,
          durationMs: Date.now() - startedAt,
        });
        throw new Error(DISCOVERY_DECISION_WRITE_FAILED);
      }

      const rebuildStartedAt = Date.now();
      const rebuilt = await rebuildDiscoveryProjectionsForActor(client, actorProfileId);
      const projectionRebuildMs = Date.now() - rebuildStartedAt;
      if (requestedQueueVersion) {
        await client.query(
          `UPDATE discovery.actor_queue
           SET status = 'consumed', updated_at = NOW()
           WHERE actor_profile_id = $1
             AND queue_version = $2
             AND target_profile_public_id = $3
             AND status = 'reserved'`,
          [actorProfileId, requestedQueueVersion, targetProfile.public_id]
        );
      } else {
        await client.query(
          `UPDATE discovery.actor_queue
           SET status = 'consumed', updated_at = NOW()
           WHERE actor_profile_id = $1
             AND target_profile_public_id = $2
             AND status = 'reserved'`,
          [actorProfileId, targetProfile.public_id]
        );
      }
      const goalsUnlock = await this.goalsService.syncGoalsUnlockState(
        userId,
        {
          actorProfileId,
          previousThresholdReached,
          thresholdReached: rebuilt.threshold.thresholdReached,
          thresholdReachedAt: rebuilt.threshold.thresholdReachedAt,
          thresholdReachedEventId: rebuilt.threshold.lastDecisionInteractionId,
        },
        client
      );
      await this.goalsService.rebuildUserGoalTargets(userId, client, {
        refreshPreferences: false,
      });
      const replacement = await this.buildDiscoveryReplacementForActor(
        client,
        actorProfileId,
        currentFilters,
        normalizedCursor,
        normalizedVisibleProfileIds,
        targetProfile.id
      );
      const queueVersion = this.computePolicyQueueVersion(
        actorProfileId,
        this.buildFiltersHash(currentFilters)
      );
      const changedCategories =
        interactionType === "like"
          ? diffPopularAttributeSnapshots(
              previous.popularAttributesByCategory,
              rebuilt.popularAttributesByCategory
            )
          : [];
      const shouldShowDiscoveryUpdate =
        interactionType === "like" &&
        rebuilt.threshold.totalLikes >= 30 &&
        changedCategories.length > 0;

      this.logDecisionEvent("decision_inserted", {
        decisionApplied: true,
        decisionRejectedReason: null,
        requestId: normalizedRequestId,
        userId,
        actorProfileId,
        targetProfileId: targetProfile.id,
        interactionType,
        queueVersion,
        interactionId: insertResult.rows[0].id,
        projectionRebuildMs,
        durationMs: Date.now() - startedAt,
        previousTotals,
        nextTotals: {
          totalLikes: rebuilt.threshold.totalLikes,
          totalPasses: rebuilt.threshold.totalPasses,
          thresholdReached: rebuilt.threshold.thresholdReached,
          thresholdReachedAt: rebuilt.threshold.thresholdReachedAt,
          lastDecisionEventAt: rebuilt.threshold.lastDecisionEventAt,
          lastDecisionInteractionId: rebuilt.threshold.lastDecisionInteractionId,
        },
        unlockState: {
          available: goalsUnlock.available,
          justUnlocked: goalsUnlock.justUnlocked,
          unlockMessagePending: goalsUnlock.unlockMessagePending,
        },
        replacementProfileId: replacement.replacementProfile?.id ?? null,
        hasMore: replacement.hasMore,
        changedCategories: changedCategories.map((item) => item.category),
        shouldShowDiscoveryUpdate,
      });
      this.logQueueEvent("replacement_selected", {
        actorId: actorProfileId,
        requestId: normalizedRequestId,
        queueVersion,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        visibleQueue: normalizedVisibleProfileIds,
        activeProfileId: normalizedVisibleProfileIds[0] ?? null,
        action: interactionType,
        targetProfileId: targetProfile.id,
        replacementProfileId: replacement.replacementProfile?.id ?? null,
      });

      await client.query("COMMIT");
      this.logQueueEvent("decision_response", {
        actorId: actorProfileId,
        requestId: normalizedRequestId,
        queueVersion,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        visibleQueue: normalizedVisibleProfileIds,
        activeProfileId: normalizedVisibleProfileIds[0] ?? null,
        action: interactionType,
        targetProfileId: targetProfile.id,
        replacementProfileId: replacement.replacementProfile?.id ?? null,
        decisionApplied: true,
        decisionRejectedReason: null,
        nextCursor: replacement.nextCursor,
        hasMore: replacement.hasMore,
        eligibleRealCount: replacement.supply.eligibleRealCount ?? null,
        eligibleDummyCount: replacement.supply.eligibleDummyCount ?? null,
        returnedRealCount: replacement.supply.returnedRealCount ?? null,
        returnedDummyCount: replacement.supply.returnedDummyCount ?? null,
        dominantExclusionReason: replacement.supply.dominantExclusionReason ?? null,
        exhaustedReason: replacement.supply.exhaustedReason ?? null,
      });

      return {
        requestId: normalizedRequestId,
        decisionApplied: true,
        decisionState: interactionType,
        targetProfileId: targetProfile.id,
        targetProfilePublicId: targetProfile.public_id,
        decisionRejectedReason: null,
        changedCategories,
        shouldShowDiscoveryUpdate,
        ...rebuilt,
        goalsUnlock,
        filters: currentFilters,
        queueVersion,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        replacementProfile: replacement.replacementProfile,
        nextCursor: replacement.nextCursor,
        hasMore: replacement.hasMore,
        supply: replacement.supply,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      this.warnDecisionEvent("decision_failed", {
        decisionApplied: false,
        errorCode: message,
        requestId: String(payload.requestId || "").trim() || null,
        userId,
        actorProfileId,
        targetProfileId: this.normalizeProfileId(payload.targetProfileId),
        targetProfilePublicId: String(payload.targetProfilePublicId || "").trim() || null,
        interactionType,
        durationMs: Date.now() - startedAt,
        error: message,
        queueInvalidationReason:
          error instanceof DiscoveryCursorError ? error.queueInvalidationReason : null,
      });
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  getEmptyPreferences() {
    return {
      likedProfileIds: [],
      passedProfileIds: [],
      currentDecisionCounts: {
        likes: 0,
        passes: 0,
      },
      likedProfiles: [],
      popularAttributesByCategory: createEmptyPopularAttributesByCategory(),
      totalLikesCount: 0,
      lifetimeCounts: {
        likes: 0,
        passes: 0,
      },
      threshold: {
        likeThreshold: 30,
        totalLikes: 0,
        totalPasses: 0,
        likesUntilUnlock: 30,
        thresholdReached: false,
        thresholdReachedAt: null,
        lastDecisionEventAt: null,
        lastDecisionInteractionId: null,
      },
      goalsUnlock: {
        available: false,
        justUnlocked: false,
        unlockMessagePending: false,
        goalsUnlockEventEmittedAt: null,
        goalsUnlockMessageSeenAt: null,
      },
      lastNotifiedPopularModeChangeAtLikeCount: 0,
      filters: this.defaultFilters(),
    };
  }
}
