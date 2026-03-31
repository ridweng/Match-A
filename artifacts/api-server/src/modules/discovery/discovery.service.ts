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
  sort_order: number;
  media_asset_id: number;
  public_url: string | null;
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

type DiscoveryFeedCursor = {
  rank: number;
  id: number;
};

type DiscoveryFeedOptions = {
  cursor?: string | null;
  limit?: number;
};

type DiscoveryWindowOptions = {
  size?: number | null;
  cursor?: string | null;
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

const DEFAULT_DISCOVERY_WINDOW_SIZE = 3;
const DISCOVERY_DECISION_WRITE_FAILED = "DISCOVERY_DECISION_WRITE_FAILED";

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
    return Math.max(1, hash);
  }

  private evaluatePolicyFailureReason(
    actorProfileId: number,
    profile: DiscoveryFeedProfileRow,
    filters: DiscoveryFilters,
    decidedIds: Set<number>
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

    if (decidedIds.has(profile.id)) {
      return "already_decided";
    }

    return null;
  }

  private async buildOrderedCandidateRows(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    filters: DiscoveryFilters
  ) {
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
    const decisionsResult = await client.query<{ target_profile_id: number | null }>(
      `SELECT target_profile_id
       FROM discovery.profile_decisions
       WHERE actor_profile_id = $1`,
      [actorProfileId]
    );
    const decidedIds = new Set(
      decisionsResult.rows
        .map((row) => Number(row.target_profile_id))
        .filter((value) => Number.isFinite(value) && value > 0)
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
        decidedIds
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
        `SELECT pi.profile_id, pi.sort_order, ma.id AS media_asset_id, ma.public_url
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
    for (const row of imagesResult.rows) {
      const resolvedUrl = row.public_url || this.buildPublicMediaUrl(Number(row.media_asset_id));
      if (!resolvedUrl) {
        continue;
      }
      const current = imagesByProfile.get(row.profile_id) || [];
      current.push(resolvedUrl);
      imagesByProfile.set(row.profile_id, current);
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
        images:
          images && images.length > 0
            ? images
            : isDummyProfile
              ? this.getFallbackImages(profile)
              : [],
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
      };
    });

    this.logger.log(
      `[discovery-image-hydration] ${JSON.stringify(
        hydrated.map((profile) => ({
          profileId: profile.id,
          mediaSource:
            imagesByProfile.get(profile.id)?.length && imagesByProfile.get(profile.id)!.length > 0
              ? "real_media"
              : visibleProfiles.find((item) => item.id === profile.id)?.synthetic_group
                ? "dummy_fallback"
                : "missing_real_media",
          imageCount: profile.images.length,
        }))
      )}`
    );

    return hydrated;
  }

  private getNextCursorStartIndex(
    orderedCandidates: OrderedCandidate[],
    state: Pick<ActorStateRow, "last_served_sort_key" | "last_served_profile_id">
  ) {
    if (
      !Number.isFinite(state.last_served_sort_key) ||
      !Number.isFinite(state.last_served_profile_id)
    ) {
      return 0;
    }

    const nextIndex = orderedCandidates.findIndex(
      (entry) =>
        entry.rank > Number(state.last_served_sort_key) ||
        (entry.rank === Number(state.last_served_sort_key) &&
          entry.profile.id > Number(state.last_served_profile_id))
    );

    return nextIndex >= 0 ? nextIndex : 0;
  }

  private async buildDiscoveryWindowForActor(
    client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    actorProfileId: number,
    options?: DiscoveryWindowOptions
  ) {
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
    const startIndex =
      decodedCursor &&
      decodedCursor.policyVersion === DISCOVERY_POLICY_V1.policyVersion &&
      decodedCursor.filtersHash === filtersHash
        ? decodedCursor.offset
        : 0;
    const visibleCandidates = orderedCandidates.slice(startIndex, startIndex + size);
    const visibleProfiles = visibleCandidates.map((entry) => entry.profile);
    const hydratedProfiles = await this.hydrateDiscoveryProfiles(client, visibleProfiles);
    const generatedAt = new Date().toISOString();
    const nextOffset = startIndex + visibleCandidates.length;
    const hasMore = nextOffset < orderedCandidates.length;
    const nextCursor = hasMore
      ? encodeDiscoveryWindowCursor({
          policyVersion: DISCOVERY_POLICY_V1.policyVersion,
          filtersHash,
          offset: nextOffset,
        })
      : null;
    const returnedRealCount = visibleCandidates.filter((entry) => entry.bucket === "real").length;
    const returnedDummyCount = visibleCandidates.filter((entry) => entry.bucket === "dummy").length;
    const decidedCount = Number(policyResult.diagnostics.exclusionCounts.already_decided || 0);

    this.logger.log(
      `[discovery-policy-window] ${JSON.stringify({
        actorProfileId,
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        queueVersion,
        requestedSize: size,
        cursorStart: startIndex,
        returnedIds: hydratedProfiles.map((profile) => profile.id),
        eligibleRealCount: policyResult.diagnostics.eligibleRealCount,
        eligibleDummyCount: policyResult.diagnostics.eligibleDummyCount,
        returnedRealCount,
        returnedDummyCount,
        dominantExclusionReason: policyResult.diagnostics.dominantExclusionReason,
        exhaustedReason: policyResult.diagnostics.exhaustedReason,
        exhausted: hydratedProfiles.length === 0,
      })}`
    );

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
      supply: {
        eligibleCount: orderedCandidates.length,
        unseenCount: Math.max(0, orderedCandidates.length - nextOffset),
        decidedCount,
        exhausted: hydratedProfiles.length === 0,
        fetchedAt: new Date().toISOString(),
        policyVersion: DISCOVERY_POLICY_V1.policyVersion,
        eligibleRealCount: policyResult.diagnostics.eligibleRealCount,
        eligibleDummyCount: policyResult.diagnostics.eligibleDummyCount,
        returnedRealCount,
        returnedDummyCount,
        dominantExclusionReason: policyResult.diagnostics.dominantExclusionReason,
        exhaustedReason: policyResult.diagnostics.exhaustedReason,
        refillThreshold: DISCOVERY_POLICY_V1.refillThreshold,
      },
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
    payload: {
      targetProfileId: number;
      categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
      requestId?: string | null;
      queueVersion?: number | null;
      presentedPosition?: number | null;
    }
  ) {
    return this.recordProfileDecision(userId, "like", payload);
  }

  async passProfile(
    userId: number,
    payload: {
      targetProfileId: number;
      categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
      requestId?: string | null;
      queueVersion?: number | null;
      presentedPosition?: number | null;
    }
  ) {
    return this.recordProfileDecision(userId, "pass", payload);
  }

  async decideProfile(
    userId: number,
    payload: {
      action: "like" | "pass";
      targetProfileId: number;
      categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
      requestId?: string | null;
      queueVersion?: number | null;
      presentedPosition?: number | null;
    }
  ) {
    return this.recordProfileDecision(userId, payload.action, payload);
  }

  private async recordProfileDecision(
    userId: number,
    interactionType: "like" | "pass",
    payload: {
      targetProfileId: number;
      categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
      requestId?: string | null;
      queueVersion?: number | null;
      presentedPosition?: number | null;
    }
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
      const targetProfileId = Number(payload.targetProfileId);
      const requestedQueueVersion =
        Number.isFinite(Number(payload.queueVersion)) && Number(payload.queueVersion) > 0
          ? Number(payload.queueVersion)
          : null;
      const targetProfile = await this.findTargetProfileById(client, targetProfileId);
      const previousTotals = {
        totalLikes: previous.threshold?.totalLikes ?? previous.totalLikesCount ?? 0,
        totalPasses: previous.threshold?.totalPasses ?? previous.lifetimeCounts?.passes ?? 0,
        thresholdReached: previous.threshold?.thresholdReached ?? false,
      };

      this.logDecisionEvent("received", {
        requestId: normalizedRequestId,
        userId,
        actorProfileId,
        targetProfileId,
        interactionType,
        queueVersion: requestedQueueVersion,
        previousTotals,
      });

      if (!targetProfile?.id || targetProfile.id === actorProfileId) {
        this.warnDecisionEvent("invalid_target", {
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId,
          interactionType,
          durationMs: Date.now() - startedAt,
        });
        throw new Error("DISCOVERY_TARGET_NOT_FOUND");
      }

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
          const feed = await this.buildDiscoveryWindowForActor(client, actorProfileId);
          this.logDecisionEvent("duplicate_request_id", {
            decisionApplied: false,
            decisionRejectedReason: "duplicate_request_id",
            requestId: normalizedRequestId,
            userId,
            actorProfileId,
            targetProfileId: targetProfile.id,
            interactionType,
            queueVersion: feed.queueVersion,
            durationMs: Date.now() - startedAt,
            nextTotals: {
              totalLikes: rebuilt.threshold.totalLikes,
              totalPasses: rebuilt.threshold.totalPasses,
              thresholdReached: rebuilt.threshold.thresholdReached,
            },
          });
          await client.query("COMMIT");
          return {
            decisionApplied: false,
            decisionState: interactionType,
            targetProfileId: targetProfile.id,
            decisionRejectedReason: "duplicate_request_id",
            changedCategories: [],
            shouldShowDiscoveryUpdate: false,
            ...rebuilt,
            feed,
          };
        }
      }

      const existingDecision = await client.query<{ current_state: "like" | "pass" }>(
        `SELECT current_state
         FROM discovery.profile_decisions
         WHERE actor_profile_id = $1
           AND target_profile_id = $2
         LIMIT 1`,
        [actorProfileId, targetProfile.id]
      );

      if (existingDecision.rows[0]?.current_state === interactionType) {
        const currentUnlockState = await this.goalsService.getGoalsUnlockState(userId, client);
        const currentFilters = await this.getStoredFiltersForActor(client, actorProfileId);
        const feed = await this.buildDiscoveryWindowForActor(client, actorProfileId);
        this.logDecisionEvent("same_state_existing_decision", {
          decisionApplied: false,
          decisionRejectedReason: "same_state_existing_decision",
          requestId: normalizedRequestId,
          userId,
          actorProfileId,
          targetProfileId: targetProfile.id,
          interactionType,
          queueVersion: feed.queueVersion,
          durationMs: Date.now() - startedAt,
          nextTotals: previousTotals,
          unlockAvailable: currentUnlockState.available,
          unlockPending: currentUnlockState.unlockMessagePending,
        });
        await client.query("COMMIT");
        return {
          decisionApplied: false,
          decisionState: interactionType,
          targetProfileId: targetProfile.id,
          decisionRejectedReason: "same_state_existing_decision",
          changedCategories: [],
          shouldShowDiscoveryUpdate: false,
          ...previous,
          goalsUnlock: currentUnlockState,
          filters: currentFilters,
          feed,
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
             AND target_profile_id = $3
             AND status = 'reserved'`,
          [actorProfileId, requestedQueueVersion, targetProfile.id]
        );
      } else {
        await client.query(
          `UPDATE discovery.actor_queue
           SET status = 'consumed', updated_at = NOW()
           WHERE actor_profile_id = $1
             AND target_profile_id = $2
             AND status = 'reserved'`,
          [actorProfileId, targetProfile.id]
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
      const filters = await this.getStoredFiltersForActor(client, actorProfileId);
      const feed = await this.buildDiscoveryWindowForActor(client, actorProfileId);
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
        queueVersion: feed.queueVersion,
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
        returnedNextIds: feed.profiles.map((profile) => profile.id),
        changedCategories: changedCategories.map((item) => item.category),
        shouldShowDiscoveryUpdate,
      });

      await client.query("COMMIT");

      return {
        decisionApplied: true,
        decisionState: interactionType,
        targetProfileId: targetProfile.id,
        decisionRejectedReason: null,
        changedCategories,
        shouldShowDiscoveryUpdate,
        ...rebuilt,
        goalsUnlock,
        filters,
        feed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      this.warnDecisionEvent("decision_failed", {
        decisionApplied: false,
        errorCode: message,
        requestId: String(payload.requestId || "").trim() || null,
        userId,
        actorProfileId,
        targetProfileId: Number(payload.targetProfileId),
        interactionType,
        durationMs: Date.now() - startedAt,
        error: message,
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
