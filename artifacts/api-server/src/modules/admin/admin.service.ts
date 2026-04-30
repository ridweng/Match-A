import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { pool } from "@workspace/db";
import { runtimeConfig } from "../../config/runtime";
import { CacheService } from "../cache/cache.service";
import { CACHE_TTL_SECONDS } from "../cache/cache.constants";
import { cacheKeys } from "../cache/cache.keys";

type TableRole = "source" | "projection" | "ops";
type EdgeType = "fk" | "flow";

type UserListRow = {
  profile_id: number;
  user_id: number | null;
  public_id: string;
  display_name: string;
  kind: "user" | "dummy";
  gender_identity: string;
  country: string;
  synthetic_group: string | null;
  dummy_batch_key: string | null;
  generation_version: number | null;
  total_likes: number | null;
  total_passes: number | null;
  is_activated: boolean;
  threshold_plus_30: boolean;
  last_decision_at: string | Date | null;
  last_recomputed_at: string | Date | null;
};

type RecentDecisionRow = {
  id: number;
  interaction_type: "like" | "pass";
  target_profile_public_id: string;
  created_at: string | Date;
};

type UserListFilters = {
  q?: string;
  kind?: "all" | "user" | "dummy";
  activation?: "all" | "activated" | "not_activated";
  genderIdentity?: string;
  syntheticGroup?: string;
  dummyBatchKey?: string;
  generationVersion?: number | null;
};

type UserFilterOptions = {
  genderIdentities: string[];
  syntheticGroups: string[];
  dummyBatchKeys: string[];
  generationVersions: number[];
};

type GeneratedBatchRow = {
  batch_key: string;
  generation_version: number;
  profile_count: string;
  female_count: string;
  male_count: string;
  other_count: string;
  ready_media_count: string;
  latest_created_at: string | Date | null;
  latest_updated_at: string | Date | null;
};

type GeneratedBatchDeletePreview = {
  batchKey: string;
  generationVersion: number;
  profileCount: number;
  femaleCount: number;
  maleCount: number;
  otherCount: number;
  readyMediaCount: number;
  deletedProfiles: number;
  deletedDummyMetadata: number;
  deletedMediaAssets: number;
  deletedProfileImages: number;
  deletedCategoryValues: number;
  deletedLanguages: number;
  deletedInterests: number;
  deletedLocationHistory: number;
  deletedDecisions: number;
  deletedInteractions: number;
  deletedQueueRows: number;
  deletedActorStateRows: number;
  deletedProjectionRows: number;
  deletedUsers: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
};

type GeneratedBatchDeleteSummary = GeneratedBatchDeletePreview & {
  deletedBatchKey: string;
};

type OverviewRealGenderRow = {
  gender_identity: string;
  profile_count: string;
};

type OverviewRealCountryRow = {
  country: string;
  profile_count: string;
};

type OverviewTimeframe = "now" | "1w" | "1m" | "3m" | "6m" | "1y" | "3y" | "all";

type OverviewFilters = {
  timeframe?: string;
  country?: string;
};

type OverviewInteractedUserRow = {
  profile_id: number;
  display_name: string;
  country: string;
  likes_count: string;
  passes_count: string;
  total_decisions: string;
  last_interaction_at: string | Date | null;
};

type OverviewCounts = {
  real_users: string;
  dummy_profiles: string;
  total_decisions: string;
  total_likes: string;
  total_passes: string;
  users_not_activated: string;
  users_activated: string;
  active_interacting_users: string;
  latest_decision_event_at: string | Date | null;
  latest_projection_rebuild_at: string | Date | null;
};

type OverviewView = {
  selectedTimeframe: OverviewTimeframe;
  selectedCountry: string;
  availableCountries: OverviewRealCountryRow[];
  counts: OverviewCounts;
  funnel: {
    signedUp: {
      count: string;
      pctFromPrevious: string;
      pctFromSignedUp: string;
    };
    onboarded: {
      count: string;
      pctFromPrevious: string;
      pctFromSignedUp: string;
    };
    activated: {
      count: string;
      pctFromPrevious: string;
      pctFromSignedUp: string;
    };
    reachedThreshold: {
      count: string;
      pctFromPrevious: string;
      pctFromSignedUp: string;
    };
    activationTimestampSource: "canonical" | "onboarding_completed_at_fallback";
  };
  thresholds: { bucket: string; count: string }[];
  batches: { dummy_batch_key: string; generation_version: number; profile_count: string }[];
  activeBatch: { dummy_batch_key: string; generation_version: number } | null;
  genderDistribution: {
    gender_identity: string;
    dummy_batch_key: string;
    generation_version: number;
    profile_count: string;
  }[];
  realUserGenderDistribution: OverviewRealGenderRow[];
  realUserCountryDistribution: OverviewRealCountryRow[];
  interactedUsers: OverviewInteractedUserRow[];
  diagnostics: {
    repairedBackfillCount: number;
  };
  architectureSections: {
    title: string;
    body: string;
  }[];
  architectureFlow: string[];
};

type OverviewFunnelCountsRow = {
  signed_up: string;
  onboarded: string;
  activated: string;
  reached_threshold: string;
};

type DatabaseTableKey =
  | "auth.users"
  | "core.profiles"
  | "core.profile_location_history"
  | "core.profile_category_values"
  | "core.profile_dummy_metadata"
  | "core.profile_languages"
  | "core.profile_interests"
  | "media.media_assets"
  | "media.profile_images"
  | "catalog.goal_categories"
  | "catalog.preference_values"
  | "catalog.category_goal_rules"
  | "catalog.goal_task_templates"
  | "discovery.profile_interactions"
  | "discovery.profile_decisions"
  | "discovery.popular_attribute_modes"
  | "discovery.profile_preference_thresholds"
  | "goals.user_unlock_state"
  | "goals.user_category_targets"
  | "goals.user_category_target_progress"
  | "goals.user_goal_tasks"
  | "goals.user_category_progress"
  | "goals.user_global_progress"
  | "goals.user_goal_projection_meta";

type DatabaseGraphNode = {
  key: DatabaseTableKey;
  schema: string;
  table: string;
  label: string;
  role: TableRole;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rowCount: number | null;
  freshness: string | Date | null;
  present: boolean;
};

type DatabaseTableColumnDetail = {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  foreignKeyTarget: string | null;
};

type DatabaseTableDetail = {
  key: DatabaseTableKey;
  schema: string;
  table: string;
  role: TableRole;
  description: string;
  present: boolean;
  columns: DatabaseTableColumnDetail[];
};

type DatabaseGraphEdge = {
  from: DatabaseTableKey;
  to: DatabaseTableKey;
  edgeType: EdgeType;
  label: string;
};

type DatabaseMetric = {
  label: string;
  value: string;
  detail?: string | null;
};

type DatabaseMetricGroup = {
  title: string;
  metrics: DatabaseMetric[];
};

type DatabaseTableStat = {
  key: DatabaseTableKey;
  schema: string;
  table: string;
  role: TableRole;
  present: boolean;
  rowCount: number | null;
  freshness: string | Date | null;
};

type DatabaseSchemaStatus = {
  missingRequiredRelations: string[];
  missingRequiredColumns: string[];
  warnings: string[];
};

type DatabaseView = {
  schemaStatus: DatabaseSchemaStatus;
  graph: {
    schemas: string[];
    nodes: DatabaseGraphNode[];
    edges: DatabaseGraphEdge[];
  };
  tableDetails: DatabaseTableDetail[];
  metricGroups: DatabaseMetricGroup[];
  tableStats: DatabaseTableStat[];
};

type TableSpec = {
  key: DatabaseTableKey;
  schema: string;
  table: string;
  role: TableRole;
  description: string;
  freshnessColumn?: string | null;
  required?: boolean;
  x: number;
  y: number;
};

type ColumnRequirement = {
  relation: DatabaseTableKey;
  column: string;
};

type RecentTimestampRow = {
  value: string | Date | null;
};

type TableColumnRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
};

type ConstraintColumnRow = {
  constraint_type: "PRIMARY KEY" | "FOREIGN KEY";
  column_name: string;
  target_schema: string | null;
  target_table: string | null;
  target_column: string | null;
};

const GRAPH_NODE_WIDTH = 220;
const GRAPH_NODE_HEIGHT = 92;
const GRAPH_SCHEMA_COLUMNS = ["auth", "core", "catalog", "discovery", "goals", "media"] as const;

const APPROVED_TABLE_SPECS: TableSpec[] = [
  {
    key: "auth.users",
    schema: "auth",
    table: "users",
    role: "source",
    description: "Accounts and auth identity root",
    freshnessColumn: "updated_at",
    required: true,
    x: 40,
    y: 70,
  },
  {
    key: "core.profiles",
    schema: "core",
    table: "profiles",
    role: "source",
    description: "Primary person/profile record",
    freshnessColumn: "updated_at",
    required: true,
    x: 320,
    y: 70,
  },
  {
    key: "core.profile_location_history",
    schema: "core",
    table: "profile_location_history",
    role: "source",
    description: "Historical user/profile location snapshots",
    freshnessColumn: "created_at",
    required: true,
    x: 320,
    y: 190,
  },
  {
    key: "core.profile_category_values",
    schema: "core",
    table: "profile_category_values",
    role: "source",
    description: "Profile source values by goal category",
    freshnessColumn: null,
    x: 320,
    y: 310,
  },
  {
    key: "core.profile_dummy_metadata",
    schema: "core",
    table: "profile_dummy_metadata",
    role: "ops",
    description: "Dummy batch and synthetic metadata",
    freshnessColumn: "created_at",
    x: 320,
    y: 430,
  },
  {
    key: "core.profile_languages",
    schema: "core",
    table: "profile_languages",
    role: "source",
    description: "Profile spoken languages",
    freshnessColumn: null,
    x: 320,
    y: 550,
  },
  {
    key: "core.profile_interests",
    schema: "core",
    table: "profile_interests",
    role: "source",
    description: "Profile interests",
    freshnessColumn: null,
    x: 320,
    y: 670,
  },
  {
    key: "catalog.goal_categories",
    schema: "catalog",
    table: "goal_categories",
    role: "source",
    description: "Goal category catalog",
    freshnessColumn: "updated_at",
    required: true,
    x: 600,
    y: 70,
  },
  {
    key: "catalog.preference_values",
    schema: "catalog",
    table: "preference_values",
    role: "source",
    description: "Allowed values per category",
    freshnessColumn: "updated_at",
    x: 600,
    y: 190,
  },
  {
    key: "catalog.category_goal_rules",
    schema: "catalog",
    table: "category_goal_rules",
    role: "source",
    description: "Rule mapping from values to targets",
    freshnessColumn: "updated_at",
    x: 600,
    y: 310,
  },
  {
    key: "catalog.goal_task_templates",
    schema: "catalog",
    table: "goal_task_templates",
    role: "source",
    description: "Task templates derived into user tasks",
    freshnessColumn: "updated_at",
    x: 600,
    y: 430,
  },
  {
    key: "discovery.profile_interactions",
    schema: "discovery",
    table: "profile_interactions",
    role: "source",
    description: "Immutable like/pass interaction events",
    freshnessColumn: "created_at",
    required: true,
    x: 880,
    y: 70,
  },
  {
    key: "discovery.profile_decisions",
    schema: "discovery",
    table: "profile_decisions",
    role: "projection",
    description: "Current final decision per target",
    freshnessColumn: "updated_at",
    required: true,
    x: 880,
    y: 190,
  },
  {
    key: "discovery.popular_attribute_modes",
    schema: "discovery",
    table: "popular_attribute_modes",
    role: "projection",
    description: "Derived preference modes from likes",
    freshnessColumn: "updated_at",
    x: 880,
    y: 310,
  },
  {
    key: "discovery.profile_preference_thresholds",
    schema: "discovery",
    table: "profile_preference_thresholds",
    role: "projection",
    description: "Lifetime totals and threshold state",
    freshnessColumn: "computed_at",
    required: true,
    x: 880,
    y: 430,
  },
  {
    key: "goals.user_unlock_state",
    schema: "goals",
    table: "user_unlock_state",
    role: "projection",
    description: "Goals unlock projection",
    freshnessColumn: "updated_at",
    x: 1160,
    y: 70,
  },
  {
    key: "goals.user_category_targets",
    schema: "goals",
    table: "user_category_targets",
    role: "projection",
    description: "Derived category targets",
    freshnessColumn: "computed_at",
    x: 1160,
    y: 190,
  },
  {
    key: "goals.user_category_target_progress",
    schema: "goals",
    table: "user_category_target_progress",
    role: "projection",
    description: "Progress toward derived targets",
    freshnessColumn: "computed_at",
    x: 1160,
    y: 310,
  },
  {
    key: "goals.user_goal_tasks",
    schema: "goals",
    table: "user_goal_tasks",
    role: "projection",
    description: "Projected user task assignments",
    freshnessColumn: "updated_at",
    x: 1160,
    y: 430,
  },
  {
    key: "goals.user_category_progress",
    schema: "goals",
    table: "user_category_progress",
    role: "projection",
    description: "Category-level task completion summary",
    freshnessColumn: "updated_at",
    x: 1160,
    y: 550,
  },
  {
    key: "goals.user_global_progress",
    schema: "goals",
    table: "user_global_progress",
    role: "projection",
    description: "Global progress summary",
    freshnessColumn: "updated_at",
    x: 1160,
    y: 670,
  },
  {
    key: "goals.user_goal_projection_meta",
    schema: "goals",
    table: "user_goal_projection_meta",
    role: "ops",
    description: "Goals rebuild watermark and status",
    freshnessColumn: "last_recomputed_at",
    x: 1160,
    y: 790,
  },
  {
    key: "media.media_assets",
    schema: "media",
    table: "media_assets",
    role: "source",
    description: "Uploaded media asset metadata",
    freshnessColumn: "updated_at",
    x: 1440,
    y: 70,
  },
  {
    key: "media.profile_images",
    schema: "media",
    table: "profile_images",
    role: "source",
    description: "Profile-to-media image mapping",
    freshnessColumn: "updated_at",
    x: 1440,
    y: 190,
  },
];

const REQUIRED_COLUMN_REQUIREMENTS: ColumnRequirement[] = [
  {
    relation: "discovery.profile_preference_thresholds",
    column: "threshold_reached_at",
  },
  {
    relation: "discovery.profile_preference_thresholds",
    column: "last_decision_event_at",
  },
  {
    relation: "goals.user_goal_projection_meta",
    column: "last_recomputed_at",
  },
  {
    relation: "goals.user_goal_projection_meta",
    column: "rebuild_status",
  },
];

const CURATED_FLOW_EDGES: DatabaseGraphEdge[] = [
  {
    from: "core.profiles",
    to: "core.profile_location_history",
    edgeType: "flow",
    label: "location audit",
  },
  {
    from: "discovery.profile_interactions",
    to: "discovery.profile_decisions",
    edgeType: "flow",
    label: "projection flow",
  },
  {
    from: "discovery.profile_interactions",
    to: "discovery.popular_attribute_modes",
    edgeType: "flow",
    label: "projection flow",
  },
  {
    from: "discovery.profile_interactions",
    to: "discovery.profile_preference_thresholds",
    edgeType: "flow",
    label: "projection flow",
  },
  {
    from: "discovery.profile_preference_thresholds",
    to: "goals.user_unlock_state",
    edgeType: "flow",
    label: "unlock projection",
  },
  {
    from: "catalog.category_goal_rules",
    to: "goals.user_category_targets",
    edgeType: "flow",
    label: "target derivation",
  },
  {
    from: "discovery.profile_interactions",
    to: "goals.user_category_targets",
    edgeType: "flow",
    label: "source event flow",
  },
  {
    from: "goals.user_category_targets",
    to: "goals.user_category_target_progress",
    edgeType: "flow",
    label: "progress derivation",
  },
  {
    from: "catalog.goal_task_templates",
    to: "goals.user_goal_tasks",
    edgeType: "flow",
    label: "task assignment flow",
  },
  {
    from: "goals.user_category_targets",
    to: "goals.user_goal_tasks",
    edgeType: "flow",
    label: "task targeting",
  },
  {
    from: "goals.user_goal_tasks",
    to: "goals.user_category_progress",
    edgeType: "flow",
    label: "progress rollup",
  },
  {
    from: "goals.user_category_progress",
    to: "goals.user_global_progress",
    edgeType: "flow",
    label: "global rollup",
  },
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Optional()
    @Inject(CacheService)
    private readonly cacheService?: CacheService
  ) {}

  private buildPublicMediaUrl(mediaAssetId: number) {
    return `${runtimeConfig.baseUrl.replace(/\/+$/, "")}/api/media/public/${mediaAssetId}`;
  }

  private resolvePublicMediaUrl(mediaAssetId: number, publicUrl: string | null) {
    const fallback = this.buildPublicMediaUrl(mediaAssetId);
    const trimmed = String(publicUrl || "").trim();

    if (!trimmed) {
      return fallback;
    }

    if (
      trimmed.includes("static.matcha.local") ||
      trimmed.includes("/synthetic/") ||
      trimmed.startsWith("synthetic/")
    ) {
      return fallback;
    }

    if (trimmed.startsWith("/api/media/public/")) {
      return fallback;
    }

    try {
      const parsed = new URL(trimmed);

      if (
        parsed.hostname === "static.matcha.local" ||
        parsed.pathname.includes("/synthetic/") ||
        parsed.pathname.startsWith("/api/media/public/")
      ) {
        return fallback;
      }

      return parsed.toString();
    } catch {
      return fallback;
    }
  }

  private async measure<T>(name: string, callback: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await callback();
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 250) {
        this.logger.log(`[admin-metrics] ${JSON.stringify({ name, durationMs })}`);
      }
    }
  }

  private async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>
  ): Promise<T> {
    if (!this.cacheService) {
      this.logger.warn(
        `[admin-cache] unavailable ${JSON.stringify({ key, reason: "provider_missing" })}`
      );
      return loader();
    }

    try {
      return await this.cacheService.getOrSet(key, ttlSeconds, loader);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      this.logger.warn(
        `[admin-cache] fallback ${JSON.stringify({ key, reason: "cache_error", message })}`
      );
      return loader();
    }
  }

  private async invalidateAdminCaches() {
    if (!this.cacheService) {
      return;
    }
    try {
      await this.cacheService.deleteByPrefix(cacheKeys.adminPrefix());
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      this.logger.warn(
        `[admin-cache] invalidate_failed ${JSON.stringify({ message })}`
      );
    }
  }

  private relationNameFromKey(key: DatabaseTableKey) {
    return key;
  }

  private normalizeOverviewTimeframe(input?: string): OverviewTimeframe {
    if (
      input === "all" ||
      input === "now" ||
      input === "1w" ||
      input === "1m" ||
      input === "3m" ||
      input === "6m" ||
      input === "1y" ||
      input === "3y"
    ) {
      return input;
    }
    return "1m";
  }

  private normalizeOverviewCountry(input?: string) {
    const normalized = String(input || "").trim();
    return normalized ? normalized : "all";
  }

  private getOverviewWindowStart(timeframe: OverviewTimeframe) {
    if (timeframe === "all") {
      return null;
    }

    const now = Date.now();
    const days =
      timeframe === "now"
        ? 1
        : timeframe === "1w"
          ? 7
          : timeframe === "1m"
            ? 30
            : timeframe === "3m"
              ? 90
              : timeframe === "6m"
                ? 180
                : timeframe === "1y"
                  ? 365
                  : 1095;

    return new Date(now - days * 24 * 60 * 60 * 1000);
  }

  private formatPercent(numerator: number, denominator: number) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return "0.0%";
    }
    return `${((numerator / denominator) * 100).toFixed(1)}%`;
  }

  private buildOverviewFunnel(row?: OverviewFunnelCountsRow | null) {
    const signedUp = Number(row?.signed_up || 0);
    const onboarded = Number(row?.onboarded || 0);
    const activated = Number(row?.activated || 0);
    const reachedThreshold = Number(row?.reached_threshold || 0);

    return {
      signedUp: {
        count: String(signedUp),
        pctFromPrevious: "100.0%",
        pctFromSignedUp: "100.0%",
      },
      onboarded: {
        count: String(onboarded),
        pctFromPrevious: this.formatPercent(onboarded, signedUp),
        pctFromSignedUp: this.formatPercent(onboarded, signedUp),
      },
      activated: {
        count: String(activated),
        pctFromPrevious: this.formatPercent(activated, onboarded),
        pctFromSignedUp: this.formatPercent(activated, signedUp),
      },
      reachedThreshold: {
        count: String(reachedThreshold),
        pctFromPrevious: this.formatPercent(reachedThreshold, activated),
        pctFromSignedUp: this.formatPercent(reachedThreshold, signedUp),
      },
      activationTimestampSource: "onboarding_completed_at_fallback" as const,
    };
  }

  private buildResolvedCountryExpression(alias: string, hasProfileCountryColumn: boolean) {
    const locationCountry = `NULLIF(TRIM(SPLIT_PART(${alias}.location, ',', array_length(regexp_split_to_array(${alias}.location, ','), 1))), '')`;
    if (hasProfileCountryColumn) {
      return `COALESCE(NULLIF(TRIM(${alias}.country), ''), ${locationCountry}, 'Unknown')`;
    }
    return `COALESCE(${locationCountry}, 'Unknown')`;
  }

  private async repairLegacyActivatedUsers() {
    const repaired = await pool.query<{ user_id: number }>(
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
       RETURNING user_id`
    );

    return repaired.rows.length;
  }

  private async hasColumn(schema: string, table: string, column: string) {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = $1
           AND table_name = $2
           AND column_name = $3
       ) AS exists`,
      [schema, table, column]
    );
    return Boolean(result.rows[0]?.exists);
  }

  private async loadPresentRelations(keys: DatabaseTableKey[]) {
    const relationChecks = await Promise.all(
      keys.map(async (key) => {
        const result = await pool.query<{ relation_name: string | null }>(
          "SELECT to_regclass($1) AS relation_name",
          [this.relationNameFromKey(key)]
        );
        return {
          key,
          present: Boolean(result.rows[0]?.relation_name),
        };
      })
    );

    return new Map(relationChecks.map((item) => [item.key, item.present] as const));
  }

  private async loadRequiredColumnStatus(
    presentRelations: Map<DatabaseTableKey, boolean>
  ) {
    const checks = await Promise.all(
      REQUIRED_COLUMN_REQUIREMENTS.map(async (requirement) => {
        const [schema, table] = requirement.relation.split(".");
        if (!presentRelations.get(requirement.relation)) {
          return {
            relation: requirement.relation,
            column: requirement.column,
            present: false,
          };
        }
        const result = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = $1
               AND table_name = $2
               AND column_name = $3
           ) AS exists`,
          [schema, table, requirement.column]
        );
        return {
          relation: requirement.relation,
          column: requirement.column,
          present: Boolean(result.rows[0]?.exists),
        };
      })
    );

    return checks;
  }

  private async loadFreshnessForTable(
    spec: TableSpec,
    presentRelations: Map<DatabaseTableKey, boolean>
  ) {
    if (!presentRelations.get(spec.key) || !spec.freshnessColumn) {
      return null;
    }

    const columnExists = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = $1
           AND table_name = $2
           AND column_name = $3
       ) AS exists`,
      [spec.schema, spec.table, spec.freshnessColumn]
    );
    if (!columnExists.rows[0]?.exists) {
      return null;
    }

    const result = await pool.query<RecentTimestampRow>(
      `SELECT MAX(${spec.freshnessColumn}) AS value
       FROM ${spec.schema}.${spec.table}`
    );
    return result.rows[0]?.value || null;
  }

  private async loadTableStats(presentRelations: Map<DatabaseTableKey, boolean>) {
    const rows = await Promise.all(
      APPROVED_TABLE_SPECS.map(async (spec) => {
        const present = Boolean(presentRelations.get(spec.key));
        if (!present) {
          return {
            key: spec.key,
            schema: spec.schema,
            table: spec.table,
            role: spec.role,
            present: false,
            rowCount: null,
            freshness: null,
          } satisfies DatabaseTableStat;
        }

        const [countResult, freshness] = await Promise.all([
          pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${spec.schema}.${spec.table}`
          ),
          this.loadFreshnessForTable(spec, presentRelations),
        ]);

        return {
          key: spec.key,
          schema: spec.schema,
          table: spec.table,
          role: spec.role,
          present: true,
          rowCount: Number(countResult.rows[0]?.count || 0),
          freshness,
        } satisfies DatabaseTableStat;
      })
    );

    return rows;
  }

  private async loadFkEdges(presentRelations: Map<DatabaseTableKey, boolean>) {
    const allowed = new Set(
      APPROVED_TABLE_SPECS.filter((spec) => presentRelations.get(spec.key)).map((spec) => spec.key)
    );

    const result = await pool.query<{
      source_schema: string;
      source_table: string;
      target_schema: string;
      target_table: string;
    }>(
      `SELECT DISTINCT
         tc.table_schema AS source_schema,
         tc.table_name AS source_table,
         ccu.table_schema AS target_schema,
         ccu.table_name AS target_table
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'`
    );

    const edges: DatabaseGraphEdge[] = [];
    for (const row of result.rows) {
      const from = `${row.source_schema}.${row.source_table}` as DatabaseTableKey;
      const to = `${row.target_schema}.${row.target_table}` as DatabaseTableKey;
      if (!allowed.has(from) || !allowed.has(to)) {
        continue;
      }
      edges.push({
        from,
        to,
        edgeType: "fk",
        label: "FK",
      });
    }

    return edges;
  }

  private buildGraphNodes(tableStats: DatabaseTableStat[]) {
    const statsByKey = new Map(tableStats.map((item) => [item.key, item] as const));
    return APPROVED_TABLE_SPECS.map((spec) => {
      const stats = statsByKey.get(spec.key);
      return {
        key: spec.key,
        schema: spec.schema,
        table: spec.table,
        label: `${spec.schema}.${spec.table}`,
        role: spec.role,
        description: spec.description,
        x: spec.x,
        y: spec.y,
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
        rowCount: stats?.rowCount ?? null,
        freshness: stats?.freshness ?? null,
        present: Boolean(stats?.present),
      } satisfies DatabaseGraphNode;
    });
  }

  private buildGraphEdges(presentRelations: Map<DatabaseTableKey, boolean>, fkEdges: DatabaseGraphEdge[]) {
    const presentSet = new Set(
      APPROVED_TABLE_SPECS.filter((spec) => presentRelations.get(spec.key)).map((spec) => spec.key)
    );
    const flowEdges = CURATED_FLOW_EDGES.filter(
      (edge) => presentSet.has(edge.from) && presentSet.has(edge.to)
    );
    return [...fkEdges, ...flowEdges];
  }

  private async loadTableDetails(
    presentRelations: Map<DatabaseTableKey, boolean>
  ): Promise<DatabaseTableDetail[]> {
    return Promise.all(
      APPROVED_TABLE_SPECS.map(async (spec) => {
        const present = Boolean(presentRelations.get(spec.key));
        if (!present) {
          return {
            key: spec.key,
            schema: spec.schema,
            table: spec.table,
            role: spec.role,
            description: spec.description,
            present: false,
            columns: [],
          } satisfies DatabaseTableDetail;
        }

        const [columnRows, constraintRows] = await Promise.all([
          pool.query<TableColumnRow>(
            `SELECT column_name, data_type, udt_name, is_nullable
             FROM information_schema.columns
             WHERE table_schema = $1
               AND table_name = $2
             ORDER BY ordinal_position ASC`,
            [spec.schema, spec.table]
          ),
          pool.query<ConstraintColumnRow>(
            `SELECT
               tc.constraint_type,
               kcu.column_name,
               ccu.table_schema AS target_schema,
               ccu.table_name AS target_table,
               ccu.column_name AS target_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
              AND tc.table_name = kcu.table_name
             LEFT JOIN information_schema.constraint_column_usage ccu
               ON tc.constraint_name = ccu.constraint_name
              AND tc.table_schema = ccu.table_schema
             WHERE tc.table_schema = $1
               AND tc.table_name = $2
               AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')`,
            [spec.schema, spec.table]
          ),
        ]);

        const primaryKeys = new Set(
          constraintRows.rows
            .filter((row) => row.constraint_type === "PRIMARY KEY")
            .map((row) => row.column_name)
        );
        const foreignKeys = new Map(
          constraintRows.rows
            .filter(
              (row) =>
                row.constraint_type === "FOREIGN KEY" &&
                row.target_schema &&
                row.target_table &&
                row.target_column
            )
            .map((row) => [
              row.column_name,
              `${row.target_schema}.${row.target_table}.${row.target_column}`,
            ] as const)
        );

        return {
          key: spec.key,
          schema: spec.schema,
          table: spec.table,
          role: spec.role,
          description: spec.description,
          present: true,
          columns: columnRows.rows.map((row) => ({
            name: row.column_name,
            dataType:
              row.data_type === "USER-DEFINED" ? row.udt_name : row.data_type,
            isNullable: row.is_nullable === "YES",
            isPrimaryKey: primaryKeys.has(row.column_name),
            foreignKeyTarget: foreignKeys.get(row.column_name) || null,
          })),
        } satisfies DatabaseTableDetail;
      })
    );
  }

  private async loadDatabaseMetricGroups(
    presentRelations: Map<DatabaseTableKey, boolean>
  ): Promise<DatabaseMetricGroup[]> {
    const canRead = (relation: DatabaseTableKey) => Boolean(presentRelations.get(relation));
    const groups: DatabaseMetricGroup[] = [];

    const tableStats = await this.loadTableStats(presentRelations);
    groups.push({
      title: "Key Tables",
      metrics: tableStats
        .filter((item) =>
          [
            "auth.users",
            "core.profiles",
            "core.profile_location_history",
            "core.profile_dummy_metadata",
            "discovery.profile_interactions",
            "discovery.profile_decisions",
            "discovery.profile_preference_thresholds",
            "goals.user_unlock_state",
            "goals.user_goal_tasks",
            "goals.user_goal_projection_meta",
          ].includes(item.key)
        )
        .map((item) => ({
          label: item.key,
          value: item.present ? String(item.rowCount ?? 0) : "missing",
          detail: item.freshness ? `latest: ${new Date(item.freshness).toISOString()}` : null,
        })),
    });

    const overview = await this.getOverview({ timeframe: "all", country: "all" });
    groups.push({
      title: "Discovery and Unlock",
      metrics: [
        { label: "Real users", value: overview.counts.real_users },
        { label: "Dummy profiles", value: overview.counts.dummy_profiles },
        { label: "Total decisions", value: overview.counts.total_decisions },
        { label: "Total likes", value: overview.counts.total_likes },
        { label: "Total passes", value: overview.counts.total_passes },
        { label: "Users not activated", value: overview.counts.users_not_activated },
        { label: "Users activated", value: overview.counts.users_activated },
        {
          label: "Latest decision event",
          value: overview.counts.latest_decision_event_at
            ? new Date(overview.counts.latest_decision_event_at).toISOString()
            : "—",
        },
        {
          label: "Latest goals rebuild",
          value: overview.counts.latest_projection_rebuild_at
            ? new Date(overview.counts.latest_projection_rebuild_at).toISOString()
            : "—",
        },
      ],
    });

    if (canRead("core.profile_dummy_metadata")) {
      const [batchCounts, dummyBreakdown, launchBatches] = await Promise.all([
        pool.query<{ label: string; value: string }>(
          `SELECT
             CONCAT(dummy_batch_key, ' / gen ', generation_version) AS label,
             COUNT(*)::text AS value
           FROM core.profile_dummy_metadata
           GROUP BY dummy_batch_key, generation_version
           ORDER BY generation_version DESC, dummy_batch_key DESC
           LIMIT 8`
        ),
        pool.query<{ label: string; value: string }>(
          `SELECT
             CASE WHEN p.kind = 'dummy' THEN 'dummy' ELSE 'real' END AS label,
             COUNT(*)::text AS value
           FROM core.profiles p
           GROUP BY 1
           ORDER BY 1 ASC`
        ),
        pool.query<{
          batch_key: string;
          profile_count: string;
          female_count: string;
          male_count: string;
          ready_media_count: string;
          discoverable_count: string;
          failing_count: string;
          generation_version: number | null;
          synthetic_variant: string | null;
        }>(
          `WITH batch AS (
             SELECT
               p.id,
               p.kind,
               p.gender_identity,
               p.is_discoverable,
               pdm.dummy_batch_key,
               pdm.generation_version,
               pdm.synthetic_variant
             FROM core.profiles p
             JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
             WHERE pdm.dummy_batch_key LIKE 'launch_reference_%'
           ),
           quality AS (
             SELECT
               b.id,
               COUNT(*) FILTER (WHERE ma.status = 'ready') AS ready_media_count,
               COUNT(DISTINCT pcv.category_code) AS category_count,
               COUNT(DISTINCT pl.language_code) AS language_count,
               COUNT(DISTINCT fp.actor_profile_id) AS preference_count
             FROM batch b
             LEFT JOIN media.profile_images pi ON pi.profile_id = b.id
             LEFT JOIN media.media_assets ma ON ma.id = pi.media_asset_id
             LEFT JOIN core.profile_category_values pcv ON pcv.profile_id = b.id
             LEFT JOIN core.profile_languages pl ON pl.profile_id = b.id
             LEFT JOIN discovery.filter_preferences fp ON fp.actor_profile_id = b.id
             GROUP BY b.id
           )
           SELECT
             b.dummy_batch_key AS batch_key,
             COUNT(*)::text AS profile_count,
             COUNT(*) FILTER (WHERE b.gender_identity = 'female')::text AS female_count,
             COUNT(*) FILTER (WHERE b.gender_identity = 'male')::text AS male_count,
             COALESCE(SUM(q.ready_media_count), 0)::text AS ready_media_count,
             COUNT(*) FILTER (WHERE b.is_discoverable = true)::text AS discoverable_count,
             COUNT(*) FILTER (
               WHERE b.kind <> 'dummy'
                  OR b.gender_identity NOT IN ('female', 'male')
                  OR b.is_discoverable IS NOT TRUE
                  OR q.ready_media_count < CASE WHEN b.dummy_batch_key = 'launch_reference_v2' THEN 2 ELSE 4 END
                  OR q.category_count < 6
                  OR q.language_count < 1
                  OR q.preference_count < 1
             )::text AS failing_count,
             MAX(b.generation_version) AS generation_version,
             MAX(b.synthetic_variant) AS synthetic_variant
           FROM batch b
           LEFT JOIN quality q ON q.id = b.id
           GROUP BY b.dummy_batch_key, b.generation_version
           ORDER BY b.generation_version ASC, b.dummy_batch_key ASC`
        ),
      ]);

      groups.push({
        title: "Dummy and Batch Distribution",
        metrics: [
          ...dummyBreakdown.rows.map((row) => ({
            label: `${row.label} profiles`,
            value: row.value,
          })),
          ...batchCounts.rows.map((row) => ({
            label: row.label,
            value: row.value,
          })),
        ],
      });

      groups.push({
        title: "Launch Reference Batches",
        metrics: launchBatches.rows.flatMap((batch) => [
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} profile_count`,
            value: batch.profile_count || "0",
            detail: `synthetic_variant: ${batch.synthetic_variant || "unknown"}`,
          },
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} female_count`,
            value: batch.female_count || "0",
          },
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} male_count`,
            value: batch.male_count || "0",
          },
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} ready_media_count`,
            value: batch.ready_media_count || "0",
          },
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} discoverable_count`,
            value: batch.discoverable_count || "0",
          },
          {
            label: `${batch.batch_key} / gen ${batch.generation_version} failing_count`,
            value: batch.failing_count || "0",
          },
        ]),
      });
    }

    if (canRead("goals.user_goal_projection_meta")) {
      const [statusBreakdown, lagStats] = await Promise.all([
        pool.query<{ label: string; value: string }>(
          `SELECT rebuild_status AS label, COUNT(*)::text AS value
           FROM goals.user_goal_projection_meta
           GROUP BY rebuild_status
           ORDER BY rebuild_status ASC`
        ),
        canRead("discovery.profile_interactions")
          ? pool.query<{ stale_count: string; latest_source_event_at: string | Date | null }>(
              `SELECT
                 COUNT(*) FILTER (
                   WHERE pi.created_at IS NOT NULL
                     AND (ugpm.last_recomputed_at IS NULL OR pi.created_at > ugpm.last_recomputed_at)
                 )::text AS stale_count,
                 MAX(pi.created_at) AS latest_source_event_at
               FROM goals.user_goal_projection_meta ugpm
               LEFT JOIN discovery.profile_interactions pi ON pi.id = ugpm.last_source_event_id`
            )
          : Promise.resolve({ rows: [{ stale_count: "0", latest_source_event_at: null }] }),
      ]);

      groups.push({
        title: "Goals Projection Health",
        metrics: [
          ...statusBreakdown.rows.map((row) => ({
            label: `rebuild_status:${row.label}`,
            value: row.value,
          })),
          {
            label: "Stale projection rows",
            value: lagStats.rows[0]?.stale_count || "0",
            detail: lagStats.rows[0]?.latest_source_event_at
              ? `latest source: ${new Date(
                  lagStats.rows[0].latest_source_event_at
                ).toISOString()}`
              : null,
          },
        ],
      });
    }

    return groups;
  }

  private async loadDatabaseWarnings(
    presentRelations: Map<DatabaseTableKey, boolean>,
    missingRequiredColumns: string[]
  ) {
    const warnings: string[] = [];

    if (
      presentRelations.get("goals.user_unlock_state") &&
      presentRelations.get("discovery.profile_preference_thresholds") &&
      presentRelations.get("core.profiles")
    ) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM core.profiles p
         JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = p.id
         LEFT JOIN goals.user_unlock_state uus ON uus.user_id = p.user_id
         WHERE p.kind = 'user'
           AND pth.threshold_reached = true
           AND uus.user_id IS NULL`
      );
      const count = Number(result.rows[0]?.count || 0);
      if (count > 0) {
        warnings.push(`${count} threshold-reached users are missing goals.user_unlock_state`);
      }
    }

    if (presentRelations.get("goals.user_goal_projection_meta")) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM goals.user_goal_projection_meta
         WHERE rebuild_status <> 'ready'`
      );
      const count = Number(result.rows[0]?.count || 0);
      if (count > 0) {
        warnings.push(`${count} goals projection rows are not in ready status`);
      }
    }

    if (missingRequiredColumns.length > 0) {
      warnings.push(
        `Schema mismatch detected in required admin DB columns: ${missingRequiredColumns.join(
          ", "
        )}`
      );
    }

    return warnings;
  }

  async getDatabaseView(options?: { bypassCache?: boolean }): Promise<DatabaseView> {
    if (options?.bypassCache) {
      return this.loadDatabaseView();
    }
    return this.getOrCompute(
      cacheKeys.adminDatabaseView(),
      CACHE_TTL_SECONDS.adminMetrics,
      () => this.loadDatabaseView()
    );
  }

  private async loadDatabaseView(): Promise<DatabaseView> {
    return this.measure("database-view", async () => {
    const keys = APPROVED_TABLE_SPECS.map((spec) => spec.key);
    const presentRelations = await this.loadPresentRelations(keys);
    const missingRequiredRelations = APPROVED_TABLE_SPECS.filter(
      (spec) => spec.required && !presentRelations.get(spec.key)
    ).map((spec) => `${spec.schema}.${spec.table}`);
    const columnChecks = await this.loadRequiredColumnStatus(presentRelations);
    const missingRequiredColumns = columnChecks
      .filter((check) => !check.present)
      .map((check) => `${check.relation}.${check.column}`);
    const tableStats = await this.loadTableStats(presentRelations);
    const tableDetails = await this.loadTableDetails(presentRelations);
    const fkEdges = await this.loadFkEdges(presentRelations);
    const nodes = this.buildGraphNodes(tableStats);
    const edges = this.buildGraphEdges(presentRelations, fkEdges);
    const warnings = await this.loadDatabaseWarnings(
      presentRelations,
      missingRequiredColumns
    );
    const metricGroups = await this.loadDatabaseMetricGroups(presentRelations);

    return {
      schemaStatus: {
        missingRequiredRelations,
        missingRequiredColumns,
        warnings,
      },
      graph: {
        schemas: [...GRAPH_SCHEMA_COLUMNS],
        nodes,
        edges,
      },
      tableDetails,
      metricGroups,
      tableStats,
    };
    });
  }

  async getOverview(
    filters?: OverviewFilters,
    options?: { bypassCache?: boolean }
  ): Promise<OverviewView> {
    const normalizedFilters = {
      timeframe: this.normalizeOverviewTimeframe(filters?.timeframe),
      country: this.normalizeOverviewCountry(filters?.country),
    };
    if (options?.bypassCache) {
      return this.loadOverview(normalizedFilters);
    }
    return this.getOrCompute(
      cacheKeys.adminOverview(normalizedFilters),
      CACHE_TTL_SECONDS.adminMetrics,
      () => this.loadOverview(normalizedFilters)
    );
  }

  private async loadOverview(filters: OverviewFilters): Promise<OverviewView> {
    return this.measure("overview", async () => {
    const repairedBackfillCount = await this.repairLegacyActivatedUsers();
    const normalizedTimeframe = this.normalizeOverviewTimeframe(filters?.timeframe);
    const selectedTimeframe = normalizedTimeframe;
    const selectedCountry = this.normalizeOverviewCountry(filters?.country);
    const hasProfileCountryColumn = await this.hasColumn("core", "profiles", "country");
    const hasProfileLocationHistoryTable = await this.hasColumn(
      "core",
      "profile_location_history",
      "country"
    );
    const resolvedCountryExpression = this.buildResolvedCountryExpression(
      "p",
      hasProfileCountryColumn
    );
    const windowStart = this.getOverviewWindowStart(normalizedTimeframe);
    const overviewCte = `
      WITH
      ${
        hasProfileLocationHistoryTable
          ? `latest_location_history AS (
               SELECT DISTINCT ON (profile_id)
                 profile_id,
                 country,
                 location,
                 created_at
               FROM core.profile_location_history
               ORDER BY profile_id, created_at DESC
             ),`
          : ""
      }
      real_profiles AS (
        SELECT
          p.id,
          p.user_id,
          p.public_id,
          p.display_name,
          p.gender_identity,
          p.created_at,
          p.is_discoverable,
          EXISTS (
            SELECT 1
            FROM media.profile_images pi
            JOIN media.media_assets ma ON ma.id = pi.media_asset_id
            WHERE pi.profile_id = p.id
              AND ma.status = 'ready'
          ) AS has_ready_media,
          o.status AS onboarding_status,
          o.completed_at AS onboarded_at,
          o.completed_at AS activated_at,
          o.completion_origin,
          COALESCE(pth.threshold_reached, false) AS threshold_reached,
          pth.threshold_reached_at,
          CASE
            WHEN o.status = 'completed'::onboarding_status
             AND p.is_discoverable = true
             AND EXISTS (
               SELECT 1
               FROM media.profile_images pi
               JOIN media.media_assets ma ON ma.id = pi.media_asset_id
               WHERE pi.profile_id = p.id
                 AND ma.status = 'ready'
             )
            THEN true
            ELSE false
          END AS is_activated,
          COALESCE(
            ${
              hasProfileLocationHistoryTable
                ? `NULLIF(TRIM(llh.country), ''),
                   NULLIF(TRIM(SPLIT_PART(llh.location, ',', array_length(regexp_split_to_array(llh.location, ','), 1))), ''),`
                : ""
            }
            ${resolvedCountryExpression}
          ) AS resolved_country
        FROM core.profiles p
        ${
          hasProfileLocationHistoryTable
            ? "LEFT JOIN latest_location_history llh ON llh.profile_id = p.id"
            : ""
        }
        LEFT JOIN core.user_onboarding o ON o.user_id = p.user_id
        LEFT JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = p.id
        WHERE p.kind = 'user'
      ),
      filtered_real_profiles AS (
        SELECT *
        FROM real_profiles
        WHERE ($1::text = 'all' OR resolved_country = $1)
          AND ($2::timestamptz IS NULL OR COALESCE(activated_at, created_at) >= $2)
      ),
      dummy_profiles AS (
        SELECT
          p.id,
          p.gender_identity,
          p.created_at,
          pdm.dummy_batch_key,
          pdm.generation_version
        FROM core.profiles p
        JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
        WHERE p.kind = 'dummy'
      ),
      filtered_dummy_profiles AS (
        SELECT *
        FROM dummy_profiles
        WHERE ($2::timestamptz IS NULL OR created_at >= $2)
      )
    `;

    const [counts, funnelCounts, thresholds, batches, activeBatch, genderDistribution, realUserGenderDistribution, realUserCountryDistribution, availableCountries, interactedUsers] = await Promise.all([
      pool.query<OverviewCounts>(
        `${overviewCte}
         SELECT
           COALESCE((SELECT COUNT(*)::text FROM filtered_real_profiles), '0') AS real_users,
           COALESCE((SELECT COUNT(*)::text FROM filtered_dummy_profiles), '0') AS dummy_profiles,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.profile_interactions pi
             JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
             WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
               AND pi.interaction_type IN ('like', 'pass')
           ), '0') AS total_decisions,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.profile_interactions pi
             JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
             WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
               AND pi.interaction_type = 'like'
           ), '0') AS total_likes,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.profile_interactions pi
             JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
             WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
               AND pi.interaction_type = 'pass'
           ), '0') AS total_passes,
           COALESCE((
             SELECT COUNT(*)::text
             FROM filtered_real_profiles frp
             WHERE COALESCE(frp.is_activated, false) = false
           ), '0') AS users_not_activated,
           COALESCE((
             SELECT COUNT(*)::text
             FROM filtered_real_profiles frp
             WHERE COALESCE(frp.is_activated, false) = true
           ), '0') AS users_activated,
           COALESCE((
             SELECT COUNT(DISTINCT pi.actor_profile_id)::text
             FROM discovery.profile_interactions pi
             JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
             WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
               AND pi.interaction_type IN ('like', 'pass')
           ), '0') AS active_interacting_users,
           (
             SELECT MAX(pi.created_at)
             FROM discovery.profile_interactions pi
             JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
             WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
               AND pi.interaction_type IN ('like', 'pass')
           ) AS latest_decision_event_at,
           (
             SELECT MAX(ugpm.last_recomputed_at)
             FROM goals.user_goal_projection_meta ugpm
             JOIN filtered_real_profiles frp ON frp.user_id = ugpm.user_id
           ) AS latest_projection_rebuild_at
      `
      , [selectedCountry, windowStart]),
      pool.query<OverviewFunnelCountsRow>(
        `${overviewCte}
         SELECT
           COUNT(*) FILTER (
             WHERE ($1::text = 'all' OR rp.resolved_country = $1)
               AND ($2::timestamptz IS NULL OR rp.created_at >= $2)
           )::text AS signed_up,
           COUNT(*) FILTER (
             WHERE ($1::text = 'all' OR rp.resolved_country = $1)
               AND rp.onboarding_status = 'completed'::onboarding_status
               AND ($2::timestamptz IS NULL OR rp.onboarded_at >= $2)
           )::text AS onboarded,
           COUNT(*) FILTER (
             WHERE ($1::text = 'all' OR rp.resolved_country = $1)
               AND rp.is_activated = true
               AND ($2::timestamptz IS NULL OR rp.activated_at >= $2)
           )::text AS activated,
           COUNT(*) FILTER (
             WHERE ($1::text = 'all' OR rp.resolved_country = $1)
               AND rp.threshold_reached = true
               AND ($2::timestamptz IS NULL OR rp.threshold_reached_at >= $2)
           )::text AS reached_threshold
         FROM real_profiles rp`
      , [selectedCountry, windowStart]),
      pool.query<{ bucket: string; count: string }>(
        `${overviewCte}
         SELECT bucket, count
         FROM (
           SELECT
             CASE
               WHEN COALESCE(pth.threshold_reached, false) THEN 'reached'
               WHEN COALESCE(pth.total_likes, 0) >= 20 THEN '20-29'
               WHEN COALESCE(pth.total_likes, 0) >= 10 THEN '10-19'
               WHEN COALESCE(pth.total_likes, 0) >= 1 THEN '1-9'
               ELSE '0'
             END AS bucket,
             COUNT(*)::text AS count,
             CASE
               WHEN COALESCE(pth.threshold_reached, false) THEN 5
               WHEN COALESCE(pth.total_likes, 0) >= 20 THEN 4
               WHEN COALESCE(pth.total_likes, 0) >= 10 THEN 3
               WHEN COALESCE(pth.total_likes, 0) >= 1 THEN 2
               ELSE 1
             END AS sort_order
           FROM filtered_real_profiles frp
           LEFT JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = frp.id
           GROUP BY 1, 3
         ) buckets
         ORDER BY sort_order`
      , [selectedCountry, windowStart]),
      pool.query<{ dummy_batch_key: string; generation_version: number; profile_count: string }>(
        `${overviewCte}
         SELECT dummy_batch_key, generation_version, COUNT(*)::text AS profile_count
         FROM filtered_dummy_profiles
         GROUP BY dummy_batch_key, generation_version
         ORDER BY dummy_batch_key ASC, generation_version ASC`
      , [selectedCountry, windowStart]
      ),
      pool.query<{ dummy_batch_key: string; generation_version: number }>(
        `${overviewCte}
         SELECT dummy_batch_key, generation_version
         FROM filtered_dummy_profiles
         GROUP BY dummy_batch_key, generation_version
         ORDER BY generation_version DESC, dummy_batch_key DESC
         LIMIT 1`
      , [selectedCountry, windowStart]
      ),
      pool.query<{
        gender_identity: string;
        dummy_batch_key: string;
        generation_version: number;
        profile_count: string;
      }>(
        `${overviewCte},
         active_batch AS (
           SELECT dummy_batch_key, generation_version
           FROM filtered_dummy_profiles
           GROUP BY dummy_batch_key, generation_version
           ORDER BY generation_version DESC, dummy_batch_key DESC
           LIMIT 1
         )
         SELECT
           fdp.gender_identity,
           fdp.dummy_batch_key,
           fdp.generation_version,
           COUNT(*)::text AS profile_count
         FROM filtered_dummy_profiles fdp
         JOIN active_batch ab
           ON ab.dummy_batch_key = fdp.dummy_batch_key
          AND ab.generation_version = fdp.generation_version
         GROUP BY fdp.gender_identity, fdp.dummy_batch_key, fdp.generation_version
         ORDER BY profile_count DESC, fdp.gender_identity ASC`
      , [selectedCountry, windowStart]
      ),
      pool.query<OverviewRealGenderRow>(
        `${overviewCte}
         SELECT
           CASE
             WHEN COALESCE(TRIM(frp.gender_identity), '') = '' THEN 'Unknown'
             ELSE frp.gender_identity
           END AS gender_identity,
           COUNT(*)::text AS profile_count
         FROM filtered_real_profiles frp
         GROUP BY 1
         ORDER BY COUNT(*) DESC, 1 ASC`
      , [selectedCountry, windowStart]),
      pool.query<OverviewRealCountryRow>(
        `${overviewCte}
         SELECT
           frp.resolved_country AS country,
           COUNT(*)::text AS profile_count
         FROM filtered_real_profiles frp
         GROUP BY 1
         ORDER BY COUNT(*) DESC, 1 ASC`
      , [selectedCountry, windowStart]),
      pool.query<OverviewRealCountryRow>(
        `${overviewCte}
         SELECT
           frp.resolved_country AS country,
           COUNT(*)::text AS profile_count
         FROM filtered_real_profiles frp
         GROUP BY 1
         ORDER BY COUNT(*) DESC, 1 ASC`
      , [selectedCountry, windowStart]),
      pool.query<OverviewInteractedUserRow>(
        `${overviewCte}
         SELECT
           frp.id AS profile_id,
           COALESCE(NULLIF(TRIM(frp.display_name), ''), frp.public_id) AS display_name,
           frp.resolved_country AS country,
           COUNT(*) FILTER (WHERE pi.interaction_type = 'like')::text AS likes_count,
           COUNT(*) FILTER (WHERE pi.interaction_type = 'pass')::text AS passes_count,
           COUNT(*)::text AS total_decisions,
           MAX(pi.created_at) AS last_interaction_at
         FROM discovery.profile_interactions pi
         JOIN filtered_real_profiles frp ON frp.id = pi.actor_profile_id
         WHERE ($2::timestamptz IS NULL OR pi.created_at >= $2)
           AND pi.interaction_type IN ('like', 'pass')
         GROUP BY frp.id, frp.display_name, frp.public_id, frp.resolved_country
         ORDER BY COUNT(*) DESC, MAX(pi.created_at) DESC, frp.id ASC`
      , [selectedCountry, windowStart]),
    ]);

    return {
      selectedTimeframe,
      selectedCountry,
      availableCountries: availableCountries.rows,
      counts: counts.rows[0] || {
        real_users: "0",
        dummy_profiles: "0",
        total_decisions: "0",
        total_likes: "0",
        total_passes: "0",
        users_not_activated: "0",
        users_activated: "0",
        active_interacting_users: "0",
        latest_decision_event_at: null,
        latest_projection_rebuild_at: null,
      },
      funnel: this.buildOverviewFunnel(funnelCounts.rows[0] || null),
      thresholds: thresholds.rows,
      batches: batches.rows,
      activeBatch: activeBatch.rows[0] || null,
      genderDistribution: genderDistribution.rows,
      realUserGenderDistribution: realUserGenderDistribution.rows,
      realUserCountryDistribution: realUserCountryDistribution.rows,
      interactedUsers: interactedUsers.rows,
      diagnostics: {
        repairedBackfillCount,
      },
      architectureSections: [
        {
          title: "auth",
          body:
            "Owns account identity and access state: users, sessions, provider identities, verification tokens, reset tokens, and email action throttling.",
        },
        {
          title: "core",
          body:
            "Owns source-of-truth profile data for real and dummy accounts: profiles, languages, interests, category values, and dummy metadata. This is where location and normalized country live.",
        },
        {
          title: "catalog",
          body:
            "Owns the static rule and template source data used to derive goals: categories, allowed values, category rules, and goal task templates.",
        },
        {
          title: "discovery",
          body:
            "Owns immutable like/pass interaction facts and the discovery projections rebuilt from them: current decisions, popular attribute modes, and preference thresholds.",
        },
        {
          title: "goals",
          body:
            "Owns derived unlock and goal progress state: unlock status, category targets, target progress, projected tasks, category/global summaries, and projection metadata.",
        },
        {
          title: "media",
          body:
            "Owns media asset metadata and profile image mappings used by the app and discovery rendering surfaces.",
        },
      ],
      architectureFlow: [
        "Source facts start in auth.users and core.profiles, then discovery.profile_interactions records immutable like/pass events.",
        "discovery.profile_decisions, popular_attribute_modes, and profile_preference_thresholds are projections derived from those interaction facts.",
        "Threshold projections feed goals.user_unlock_state and the goals projection pipeline.",
        "catalog tables define the rules/templates that goals projections use to derive targets, tasks, and progress summaries.",
        "media tables attach uploaded assets to profiles but do not drive discovery/goals projections directly.",
      ],
    };
    });
  }

  async getUsers(filters?: UserListFilters, options?: { bypassCache?: boolean }) {
    const normalizedFilters = this.normalizeUserFilters(filters);
    if (options?.bypassCache) {
      return this.loadUsers(normalizedFilters);
    }
    return this.getOrCompute(
      cacheKeys.adminUsers(normalizedFilters),
      CACHE_TTL_SECONDS.adminMetrics,
      () => this.loadUsers(normalizedFilters)
    );
  }

  private normalizeUserFilters(filters?: UserListFilters): UserListFilters {
    return {
      q: String(filters?.q || "").trim(),
      kind: filters?.kind === "user" || filters?.kind === "dummy" ? filters.kind : "all",
      activation:
        filters?.activation === "activated" || filters?.activation === "not_activated"
          ? filters.activation
          : "all",
      genderIdentity: String(filters?.genderIdentity || "").trim(),
      syntheticGroup: String(filters?.syntheticGroup || "").trim(),
      dummyBatchKey: String(filters?.dummyBatchKey || "").trim(),
      generationVersion:
        typeof filters?.generationVersion === "number" &&
        Number.isFinite(filters.generationVersion)
          ? filters.generationVersion
          : null,
    };
  }

  private async loadUsers(filters?: UserListFilters) {
    return this.measure("users", async () => {
    await this.repairLegacyActivatedUsers();
    const normalizedSearch = `%${String(filters?.q || "").trim().toLowerCase()}%`;
    const hasSearch = Boolean(String(filters?.q || "").trim());
    const normalizedKind =
      filters?.kind === "user" || filters?.kind === "dummy" ? filters.kind : "all";
    const normalizedActivation =
      filters?.activation === "activated" || filters?.activation === "not_activated"
        ? filters.activation
        : "all";
    const normalizedGenderIdentity = String(filters?.genderIdentity || "").trim();
    const normalizedSyntheticGroup = String(filters?.syntheticGroup || "").trim();
    const normalizedDummyBatchKey = String(filters?.dummyBatchKey || "").trim();
    const normalizedGenerationVersion =
      typeof filters?.generationVersion === "number" &&
      Number.isFinite(filters.generationVersion)
        ? filters.generationVersion
        : null;
    const [hasProfileCountryColumn, hasProfileLocationHistoryTable] = await Promise.all([
      this.hasColumn("core", "profiles", "country"),
      this.hasColumn("core", "profile_location_history", "country"),
    ]);
    const resolvedCountryExpression = this.buildResolvedCountryExpression(
      "p",
      hasProfileCountryColumn
    );

    const result = await pool.query<UserListRow>(
      `WITH
       ${
         hasProfileLocationHistoryTable
           ? `latest_location_history AS (
                SELECT DISTINCT ON (profile_id)
                  profile_id,
                  country,
                  location,
                  created_at
                FROM core.profile_location_history
                ORDER BY profile_id, created_at DESC
              ),`
           : ""
       }
       user_rows AS (
         SELECT
           p.id AS profile_id,
           p.user_id,
           p.public_id,
           p.display_name,
           p.kind,
           p.gender_identity,
           COALESCE(
             ${
               hasProfileLocationHistoryTable
                 ? `NULLIF(TRIM(llh.country), ''),
                    NULLIF(TRIM(SPLIT_PART(llh.location, ',', array_length(regexp_split_to_array(llh.location, ','), 1))), ''),`
                 : ""
             }
             ${resolvedCountryExpression}
           ) AS country,
           pdm.synthetic_group,
           pdm.dummy_batch_key,
           pdm.generation_version,
           pth.total_likes,
           pth.total_passes,
           CASE
             WHEN o.status = 'completed'::onboarding_status
              AND p.is_discoverable = true
              AND EXISTS (
                SELECT 1
                FROM media.profile_images pi
                JOIN media.media_assets ma ON ma.id = pi.media_asset_id
                WHERE pi.profile_id = p.id
                  AND ma.status = 'ready'
              )
             THEN true
             ELSE false
           END AS is_activated,
           CASE
             WHEN COALESCE(pth.total_likes, 0) >= 30 THEN true
             ELSE false
           END AS threshold_plus_30,
           (SELECT MAX(pi.created_at) FROM discovery.profile_interactions pi WHERE pi.actor_profile_id = p.id) AS last_decision_at,
           ugpm.last_recomputed_at
         FROM core.profiles p
         ${
           hasProfileLocationHistoryTable
             ? "LEFT JOIN latest_location_history llh ON llh.profile_id = p.id"
             : ""
         }
         LEFT JOIN core.user_onboarding o ON o.user_id = p.user_id
         LEFT JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
         LEFT JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = p.id
         LEFT JOIN goals.user_goal_projection_meta ugpm ON ugpm.user_id = p.user_id
         WHERE (
           $1::boolean = false
           OR LOWER(p.display_name) LIKE $2
           OR LOWER(p.public_id) LIKE $2
           OR LOWER(COALESCE(pdm.dummy_batch_key, '')) LIKE $2
         )
         AND ($3::text = 'all' OR p.kind = $3::profile_kind)
         AND ($5::text = '' OR LOWER(p.gender_identity) = LOWER($5))
         AND ($6::text = '' OR LOWER(COALESCE(pdm.synthetic_group, '')) = LOWER($6))
         AND ($7::text = '' OR LOWER(COALESCE(pdm.dummy_batch_key, '')) = LOWER($7))
         AND ($8::int IS NULL OR pdm.generation_version = $8)
       )
       SELECT *
       FROM user_rows
       WHERE (
         $4::text = 'all'
         OR ($4::text = 'activated' AND is_activated = true)
         OR ($4::text = 'not_activated' AND is_activated = false)
       )
       ORDER BY kind ASC, profile_id ASC`,
      [
        hasSearch,
        normalizedSearch,
        normalizedKind,
        normalizedActivation,
        normalizedGenderIdentity,
        normalizedSyntheticGroup,
        normalizedDummyBatchKey,
        normalizedGenerationVersion,
      ]
    );

    return result.rows;
    });
  }

  async getUserFilterOptions(options?: { bypassCache?: boolean }): Promise<UserFilterOptions> {
    if (options?.bypassCache) {
      return this.loadUserFilterOptions();
    }
    return this.getOrCompute(
      cacheKeys.adminUserFilterOptions(),
      CACHE_TTL_SECONDS.adminMetrics,
      () => this.loadUserFilterOptions()
    );
  }

  private async loadUserFilterOptions(): Promise<UserFilterOptions> {
    return this.measure("user-filter-options", async () => {
    const [genderResult, syntheticGroupResult, batchResult, generationResult] =
      await Promise.all([
        pool.query<{ value: string }>(
          `SELECT DISTINCT gender_identity AS value
           FROM core.profiles
           WHERE COALESCE(TRIM(gender_identity), '') <> ''
           ORDER BY value ASC`
        ),
        pool.query<{ value: string }>(
          `SELECT DISTINCT synthetic_group AS value
           FROM core.profile_dummy_metadata
           WHERE COALESCE(TRIM(synthetic_group), '') <> ''
           ORDER BY value ASC`
        ),
        pool.query<{ value: string }>(
          `SELECT DISTINCT dummy_batch_key AS value
           FROM core.profile_dummy_metadata
           WHERE COALESCE(TRIM(dummy_batch_key), '') <> ''
           ORDER BY value ASC`
        ),
        pool.query<{ value: number }>(
          `SELECT DISTINCT generation_version AS value
           FROM core.profile_dummy_metadata
           WHERE generation_version IS NOT NULL
           ORDER BY value ASC`
        ),
      ]);

    return {
      genderIdentities: genderResult.rows.map((row) => row.value).filter(Boolean),
      syntheticGroups: syntheticGroupResult.rows.map((row) => row.value).filter(Boolean),
      dummyBatchKeys: batchResult.rows.map((row) => row.value).filter(Boolean),
      generationVersions: generationResult.rows
        .map((row) => Number(row.value))
        .filter((value) => Number.isFinite(value)),
    };
    });
  }

  async getGeneratedBatches(options?: { bypassCache?: boolean }) {
    if (options?.bypassCache) {
      return this.loadGeneratedBatches();
    }
    return this.getOrCompute(
      cacheKeys.adminGeneratedBatches(),
      CACHE_TTL_SECONDS.adminMetrics,
      () => this.loadGeneratedBatches()
    );
  }

  private async loadGeneratedBatches() {
    return this.measure("generated-batches", async () => {
      const result = await pool.query<GeneratedBatchRow>(
        `WITH batch_profiles AS (
           SELECT
             p.id,
             p.gender_identity,
             p.created_at,
             p.updated_at,
             pdm.dummy_batch_key AS batch_key,
             pdm.generation_version
           FROM core.profiles p
           JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
           WHERE p.kind = 'dummy'
         ),
         batch_media AS (
           SELECT
             bp.batch_key,
             bp.generation_version,
             COUNT(*) FILTER (WHERE ma.status = 'ready') AS ready_media_count,
             MAX(ma.updated_at) AS latest_media_updated_at
           FROM batch_profiles bp
           LEFT JOIN media.media_assets ma ON ma.owner_profile_id = bp.id
           GROUP BY bp.batch_key, bp.generation_version
         )
         SELECT
           bp.batch_key,
           bp.generation_version,
           COUNT(*)::text AS profile_count,
           COUNT(*) FILTER (WHERE LOWER(bp.gender_identity) = 'female')::text AS female_count,
           COUNT(*) FILTER (WHERE LOWER(bp.gender_identity) = 'male')::text AS male_count,
           COUNT(*) FILTER (
             WHERE LOWER(bp.gender_identity) NOT IN ('female', 'male')
           )::text AS other_count,
           COALESCE(MAX(bm.ready_media_count), 0)::text AS ready_media_count,
           MAX(bp.created_at) AS latest_created_at,
           CASE
             WHEN MAX(bm.latest_media_updated_at) IS NULL THEN MAX(bp.updated_at)
             ELSE GREATEST(MAX(bp.updated_at), MAX(bm.latest_media_updated_at))
           END AS latest_updated_at
         FROM batch_profiles bp
         LEFT JOIN batch_media bm
           ON bm.batch_key = bp.batch_key
          AND bm.generation_version = bp.generation_version
         GROUP BY bp.batch_key, bp.generation_version
         ORDER BY bp.generation_version DESC, bp.batch_key ASC`
      );
      return result.rows.map((row) => ({
        batchKey: row.batch_key,
        generationVersion: Number(row.generation_version),
        profileCount: Number(row.profile_count || 0),
        femaleCount: Number(row.female_count || 0),
        maleCount: Number(row.male_count || 0),
        otherCount: Number(row.other_count || 0),
        readyMediaCount: Number(row.ready_media_count || 0),
        latestCreatedAt:
          row.latest_created_at instanceof Date
            ? row.latest_created_at.toISOString()
            : row.latest_created_at
              ? new Date(row.latest_created_at).toISOString()
              : null,
        latestUpdatedAt:
          row.latest_updated_at instanceof Date
            ? row.latest_updated_at.toISOString()
            : row.latest_updated_at
              ? new Date(row.latest_updated_at).toISOString()
              : null,
      }));
    });
  }

  async previewGeneratedBatchDelete(batchKey: string, generationVersion: number) {
    return this.measure("generated-batch-delete-preview", async () => {
      const result = await pool.query<{
        profile_count: string;
        female_count: string;
        male_count: string;
        other_count: string;
        ready_media_count: string;
        profile_rows: string;
        dummy_metadata_rows: string;
        media_asset_rows: string;
        profile_image_rows: string;
        category_value_rows: string;
        language_rows: string;
        interest_rows: string;
        location_history_rows: string;
        decision_rows: string;
        interaction_rows: string;
        queue_rows: string;
        actor_state_rows: string;
        projection_rows: string;
        user_rows: string;
        latest_created_at: string | Date | null;
        latest_updated_at: string | Date | null;
      }>(
        `WITH batch AS (
           SELECT p.id, p.user_id, p.public_id, p.gender_identity, p.created_at, p.updated_at
           FROM core.profiles p
           JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
           WHERE p.kind = 'dummy'
             AND pdm.dummy_batch_key = $1
             AND pdm.generation_version = $2
         )
         SELECT
           COUNT(*)::text AS profile_count,
           COUNT(*) FILTER (WHERE LOWER(gender_identity) = 'female')::text AS female_count,
           COUNT(*) FILTER (WHERE LOWER(gender_identity) = 'male')::text AS male_count,
           COUNT(*) FILTER (WHERE LOWER(gender_identity) NOT IN ('female', 'male'))::text AS other_count,
           COALESCE((
             SELECT COUNT(*)::text
             FROM media.media_assets ma
             JOIN batch b ON b.id = ma.owner_profile_id
             WHERE ma.status = 'ready'
           ), '0') AS ready_media_count,
           COUNT(*)::text AS profile_rows,
           COALESCE((SELECT COUNT(*)::text FROM core.profile_dummy_metadata pdm JOIN batch b ON b.id = pdm.profile_id), '0') AS dummy_metadata_rows,
           COALESCE((SELECT COUNT(*)::text FROM media.media_assets ma JOIN batch b ON b.id = ma.owner_profile_id), '0') AS media_asset_rows,
           COALESCE((SELECT COUNT(*)::text FROM media.profile_images pi JOIN batch b ON b.id = pi.profile_id), '0') AS profile_image_rows,
           COALESCE((SELECT COUNT(*)::text FROM core.profile_category_values pcv JOIN batch b ON b.id = pcv.profile_id), '0') AS category_value_rows,
           COALESCE((SELECT COUNT(*)::text FROM core.profile_languages pl JOIN batch b ON b.id = pl.profile_id), '0') AS language_rows,
           COALESCE((SELECT COUNT(*)::text FROM core.profile_interests pi JOIN batch b ON b.id = pi.profile_id), '0') AS interest_rows,
           COALESCE((SELECT COUNT(*)::text FROM core.profile_location_history plh JOIN batch b ON b.id = plh.profile_id), '0') AS location_history_rows,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.profile_decisions d
             WHERE EXISTS (
               SELECT 1
               FROM batch b
               WHERE b.id = d.actor_profile_id
                  OR b.id = d.target_profile_id
                  OR b.public_id = d.target_profile_public_id
             )
           ), '0') AS decision_rows,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.profile_interactions i
             WHERE EXISTS (
               SELECT 1
               FROM batch b
               WHERE b.id = i.actor_profile_id
                  OR b.id = i.target_profile_id
                  OR b.public_id = i.target_profile_public_id
             )
           ), '0') AS interaction_rows,
           COALESCE((
             SELECT COUNT(*)::text
             FROM discovery.actor_queue aq
             WHERE EXISTS (
               SELECT 1
               FROM batch b
               WHERE b.id = aq.actor_profile_id
                  OR b.id = aq.target_profile_id
                  OR b.public_id = aq.target_profile_public_id
             )
           ), '0') AS queue_rows,
           COALESCE((SELECT COUNT(*)::text FROM discovery.actor_state ast JOIN batch b ON b.id = ast.actor_profile_id), '0') AS actor_state_rows,
           COALESCE((
             SELECT (
               (SELECT COUNT(*) FROM discovery.filter_preferences fp JOIN batch b ON b.id = fp.actor_profile_id) +
               (SELECT COUNT(*) FROM discovery.profile_preference_thresholds pth JOIN batch b ON b.id = pth.actor_profile_id) +
               (SELECT COUNT(*) FROM discovery.popular_attribute_counts pac JOIN batch b ON b.id = pac.actor_profile_id) +
               (SELECT COUNT(*) FROM discovery.popular_attribute_modes pam JOIN batch b ON b.id = pam.actor_profile_id) +
               (SELECT COUNT(*) FROM discovery.discovery_change_messages dcm JOIN batch b ON b.id = dcm.actor_profile_id) +
               (SELECT COUNT(*) FROM discovery.profile_reset_state prs JOIN batch b ON b.id = prs.actor_profile_id)
             )::text
           ), '0') AS projection_rows,
           COALESCE((SELECT COUNT(*)::text FROM auth.users u JOIN batch b ON b.user_id = u.id), '0') AS user_rows,
           MAX(created_at) AS latest_created_at,
           MAX(updated_at) AS latest_updated_at
         FROM batch`,
        [batchKey, generationVersion]
      );

      const row = result.rows[0];
      return {
        batchKey,
        generationVersion,
        profileCount: Number(row?.profile_count || 0),
        femaleCount: Number(row?.female_count || 0),
        maleCount: Number(row?.male_count || 0),
        otherCount: Number(row?.other_count || 0),
        readyMediaCount: Number(row?.ready_media_count || 0),
        deletedProfiles: Number(row?.profile_rows || 0),
        deletedDummyMetadata: Number(row?.dummy_metadata_rows || 0),
        deletedMediaAssets: Number(row?.media_asset_rows || 0),
        deletedProfileImages: Number(row?.profile_image_rows || 0),
        deletedCategoryValues: Number(row?.category_value_rows || 0),
        deletedLanguages: Number(row?.language_rows || 0),
        deletedInterests: Number(row?.interest_rows || 0),
        deletedLocationHistory: Number(row?.location_history_rows || 0),
        deletedDecisions: Number(row?.decision_rows || 0),
        deletedInteractions: Number(row?.interaction_rows || 0),
        deletedQueueRows: Number(row?.queue_rows || 0),
        deletedActorStateRows: Number(row?.actor_state_rows || 0),
        deletedProjectionRows: Number(row?.projection_rows || 0),
        deletedUsers: Number(row?.user_rows || 0),
        latestCreatedAt:
          row?.latest_created_at instanceof Date
            ? row.latest_created_at.toISOString()
            : row?.latest_created_at
              ? new Date(row.latest_created_at).toISOString()
              : null,
        latestUpdatedAt:
          row?.latest_updated_at instanceof Date
            ? row.latest_updated_at.toISOString()
            : row?.latest_updated_at
              ? new Date(row.latest_updated_at).toISOString()
              : null,
      } satisfies GeneratedBatchDeletePreview;
    });
  }

  async deleteGeneratedBatch(
    batchKey: string,
    generationVersion: number,
    confirmation: { confirmBatchKey: string; confirmGenerationVersion: number }
  ) {
    const normalizedBatchKey = String(batchKey || "").trim();
    if (!normalizedBatchKey) {
      throw new Error("BATCH_KEY_REQUIRED");
    }
    if (String(confirmation.confirmBatchKey || "").trim() !== normalizedBatchKey) {
      throw new Error("BATCH_KEY_CONFIRMATION_MISMATCH");
    }
    if (Number(confirmation.confirmGenerationVersion) !== Number(generationVersion)) {
      throw new Error("GENERATION_VERSION_CONFIRMATION_MISMATCH");
    }

    const preview = await this.previewGeneratedBatchDelete(batchKey, generationVersion);
    if (preview.profileCount === 0) {
      return {
        ...preview,
        deletedBatchKey: normalizedBatchKey,
      } satisfies GeneratedBatchDeleteSummary;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const batch = await client.query<{ id: number; user_id: number | null; public_id: string }>(
        `SELECT p.id, p.user_id, p.public_id
         FROM core.profiles p
         JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
         WHERE p.kind = 'dummy'
           AND pdm.dummy_batch_key = $1
           AND pdm.generation_version = $2
         ORDER BY p.id ASC`,
        [batchKey, generationVersion]
      );
      const profileIds = batch.rows.map((row) => row.id);
      const publicIds = batch.rows.map((row) => row.public_id);
      const userIds = batch.rows
        .map((row) => Number(row.user_id))
        .filter((value) => Number.isFinite(value) && value > 0);

      if (profileIds.length > 0) {
        await client.query(
          `DELETE FROM discovery.actor_queue
           WHERE actor_profile_id = ANY($1::bigint[])
              OR target_profile_id = ANY($1::bigint[])
              OR target_profile_public_id = ANY($2::varchar[])`,
          [profileIds, publicIds]
        );
        await client.query(
          `DELETE FROM discovery.profile_decisions
           WHERE actor_profile_id = ANY($1::bigint[])
              OR target_profile_id = ANY($1::bigint[])
              OR target_profile_public_id = ANY($2::varchar[])`,
          [profileIds, publicIds]
        );
        await client.query(
          `DELETE FROM discovery.profile_interactions
           WHERE actor_profile_id = ANY($1::bigint[])
              OR target_profile_id = ANY($1::bigint[])
              OR target_profile_public_id = ANY($2::varchar[])`,
          [profileIds, publicIds]
        );
      }

      if (userIds.length > 0) {
        await client.query(`DELETE FROM auth.users WHERE id = ANY($1::bigint[])`, [userIds]);
      }

      await client.query(
        `DELETE FROM core.profiles
         WHERE id = ANY($1::bigint[])`,
        [profileIds]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    await this.invalidateAdminCaches();
    return {
      ...preview,
      deletedBatchKey: normalizedBatchKey,
    } satisfies GeneratedBatchDeleteSummary;
  }

  async getProfileDetail(publicId: string) {
    const normalizedPublicId = String(publicId || "").trim();
    if (!normalizedPublicId) {
      return null;
    }

    const profileResult = await pool.query<{
      profile_id: number;
      user_id: number | null;
      public_id: string;
      display_name: string;
      kind: "user" | "dummy";
      profession: string;
      bio: string;
      content_locale: "es" | "en";
      date_of_birth: string | null;
      location: string;
      country: string;
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
      is_discoverable: boolean;
      created_at: string | Date;
      updated_at: string | Date;
      onboarding_status: string | null;
      onboarding_completed_at: string | Date | null;
      synthetic_group: string | null;
      synthetic_variant: string | null;
      dummy_batch_key: string | null;
      generation_version: number | null;
      total_likes: number | null;
      total_passes: number | null;
      threshold_reached: boolean | null;
      likes_until_unlock: number | null;
      threshold_reached_at: string | Date | null;
      last_decision_event_at: string | Date | null;
      last_recomputed_at: string | Date | null;
      rebuild_status: string | null;
      has_ready_media: boolean;
      is_activated: boolean;
      total_decisions: string;
      last_interaction_at: string | Date | null;
    }>(
      `SELECT
         p.id AS profile_id,
         p.user_id,
         p.public_id,
         p.display_name,
         p.kind,
         p.profession,
         p.bio,
         p.content_locale,
         p.date_of_birth,
         p.location,
         p.country,
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
         p.is_discoverable,
         p.created_at,
         p.updated_at,
         o.status AS onboarding_status,
         o.completed_at AS onboarding_completed_at,
         pdm.synthetic_group,
         pdm.synthetic_variant,
         pdm.dummy_batch_key,
         pdm.generation_version,
         pth.total_likes,
         pth.total_passes,
         pth.threshold_reached,
         pth.likes_until_unlock,
         pth.threshold_reached_at,
         pth.last_decision_event_at,
         ugpm.last_recomputed_at,
         ugpm.rebuild_status,
         EXISTS (
           SELECT 1
           FROM media.profile_images pi
           JOIN media.media_assets ma ON ma.id = pi.media_asset_id
           WHERE pi.profile_id = p.id
             AND ma.status = 'ready'
         ) AS has_ready_media,
         CASE
           WHEN o.status = 'completed'::onboarding_status
            AND p.is_discoverable = true
            AND EXISTS (
              SELECT 1
              FROM media.profile_images pi
              JOIN media.media_assets ma ON ma.id = pi.media_asset_id
              WHERE pi.profile_id = p.id
                AND ma.status = 'ready'
            )
           THEN true
           ELSE false
         END AS is_activated,
         COALESCE((
           SELECT COUNT(*)::text
           FROM discovery.profile_interactions pi
           WHERE pi.actor_profile_id = p.id
         ), '0') AS total_decisions,
         (
           SELECT MAX(pi.created_at)
           FROM discovery.profile_interactions pi
           WHERE pi.actor_profile_id = p.id
         ) AS last_interaction_at
       FROM core.profiles p
       LEFT JOIN core.user_onboarding o ON o.user_id = p.user_id
       LEFT JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
       LEFT JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = p.id
       LEFT JOIN goals.user_goal_projection_meta ugpm ON ugpm.user_id = p.user_id
       WHERE p.public_id = $1
       LIMIT 1`,
      [normalizedPublicId]
    );

    const profile = profileResult.rows[0];
    if (!profile) {
      return null;
    }

    const [images, languages, interests, categoryValues, recentDecisions] = await Promise.all([
      pool.query<{
        profile_image_id: number;
        media_asset_id: number;
        sort_order: number;
        is_primary: boolean;
        status: "pending" | "ready" | "deleted";
        public_url: string | null;
        mime_type: string;
        width: number | null;
        height: number | null;
        updated_at: string | Date | null;
      }>(
        `SELECT
           pi.id AS profile_image_id,
           ma.id AS media_asset_id,
           pi.sort_order,
           pi.is_primary,
           ma.status,
           ma.public_url,
           ma.mime_type,
           ma.width,
           ma.height,
           ma.updated_at
         FROM media.profile_images pi
         JOIN media.media_assets ma ON ma.id = pi.media_asset_id
         WHERE pi.profile_id = $1
         ORDER BY pi.sort_order ASC, pi.id ASC`,
        [profile.profile_id]
      ),
      pool.query<{ language_code: string; position: number; is_primary: boolean }>(
        `SELECT language_code, position, is_primary
         FROM core.profile_languages
         WHERE profile_id = $1
         ORDER BY position ASC, language_code ASC`,
        [profile.profile_id]
      ),
      pool.query<{ interest_code: string; position: number }>(
        `SELECT interest_code, position
         FROM core.profile_interests
         WHERE profile_id = $1
         ORDER BY position ASC, interest_code ASC`,
        [profile.profile_id]
      ),
      pool.query<{ category_code: string; value_key: string; source: string }>(
        `SELECT category_code, value_key, source
         FROM core.profile_category_values
         WHERE profile_id = $1
         ORDER BY category_code ASC`,
        [profile.profile_id]
      ),
      pool.query<RecentDecisionRow>(
        `SELECT id, interaction_type, target_profile_public_id, created_at
         FROM discovery.profile_interactions
         WHERE actor_profile_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 20`,
        [profile.profile_id]
      ),
    ]);

    return {
      profile: {
        ...profile,
        total_decisions: Number(profile.total_decisions || 0),
      },
      images: images.rows.map((row) => ({
        profileImageId: row.profile_image_id,
        mediaAssetId: row.media_asset_id,
        sortOrder: row.sort_order,
        isPrimary: row.is_primary,
        status: row.status,
        publicUrl: this.resolvePublicMediaUrl(row.media_asset_id, row.public_url),
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        updatedAt:
          row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : row.updated_at
              ? new Date(row.updated_at).toISOString()
              : null,
      })),
      languages: languages.rows,
      interests: interests.rows,
      categoryValues: categoryValues.rows,
      recentDecisions: recentDecisions.rows,
    };
  }

  async getUserDetail(identifier: string) {
    const profileIdMatch = /^profile-(\d+)$/i.exec(String(identifier || "").trim());
    const numericUserId = Number(identifier);

    let whereClause = "p.user_id = $1";
    let value: number = numericUserId;

    if (profileIdMatch) {
      whereClause = "p.id = $1";
      value = Number(profileIdMatch[1]);
    }

    const profileResult = await pool.query<{
      profile_id: number;
      user_id: number | null;
      public_id: string;
      display_name: string;
      kind: "user" | "dummy";
      gender_identity: string;
      synthetic_group: string | null;
      synthetic_variant: string | null;
      dummy_batch_key: string | null;
      generation_version: number | null;
      total_likes: number | null;
      total_passes: number | null;
      threshold_reached: boolean | null;
      likes_until_unlock: number | null;
      threshold_reached_at: string | Date | null;
      last_decision_event_at: string | Date | null;
      last_decision_interaction_id: number | null;
      last_recomputed_at: string | Date | null;
      last_source_event_id: number | null;
      rebuild_status: string | null;
      goals_unlock_event_emitted_at: string | Date | null;
      goals_unlock_message_seen_at: string | Date | null;
    }>(
      `SELECT
         p.id AS profile_id,
         p.user_id,
         p.public_id,
         p.display_name,
         p.kind,
         p.gender_identity,
         pdm.synthetic_group,
         pdm.synthetic_variant,
         pdm.dummy_batch_key,
         pdm.generation_version,
         pth.total_likes,
         pth.total_passes,
         pth.threshold_reached,
         pth.likes_until_unlock,
         pth.threshold_reached_at,
         pth.last_decision_event_at,
         pth.last_decision_interaction_id,
         ugpm.last_recomputed_at,
         ugpm.last_source_event_id,
         ugpm.rebuild_status,
         uus.goals_unlock_event_emitted_at,
         uus.goals_unlock_message_seen_at
       FROM core.profiles p
       LEFT JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
       LEFT JOIN discovery.profile_preference_thresholds pth ON pth.actor_profile_id = p.id
       LEFT JOIN goals.user_goal_projection_meta ugpm ON ugpm.user_id = p.user_id
       LEFT JOIN goals.user_unlock_state uus ON uus.user_id = p.user_id
       WHERE ${whereClause}
       LIMIT 1`,
      [value]
    );

    const profile = profileResult.rows[0];
    if (!profile) {
      return null;
    }

    const [modes, targets, progress, tasks, recentDecisions] = await Promise.all([
      pool.query<{
        category_code: string;
        current_value_key: string | null;
        current_count: number;
        total_likes_considered: number;
      }>(
        `SELECT category_code, current_value_key, current_count, total_likes_considered
         FROM discovery.popular_attribute_modes
         WHERE actor_profile_id = $1
         ORDER BY category_code ASC`,
        [profile.profile_id]
      ),
      profile.user_id
        ? pool.query<{
            category_code: string;
            current_value_key: string | null;
            derived_mode_value_key: string | null;
            target_value_key: string | null;
            derivation_status: string;
          }>(
            `SELECT category_code, current_value_key, derived_mode_value_key, target_value_key, derivation_status
             FROM goals.user_category_targets
             WHERE user_id = $1
             ORDER BY category_code ASC`,
            [profile.user_id]
          )
        : Promise.resolve({ rows: [] }),
      profile.user_id
        ? pool.query<{
            category_code: string;
            completion_percent: number;
            progress_state: string;
            distance_raw: number;
          }>(
            `SELECT category_code, completion_percent, progress_state, distance_raw
             FROM goals.user_category_target_progress
             WHERE user_id = $1
             ORDER BY category_code ASC`,
            [profile.user_id]
          )
        : Promise.resolve({ rows: [] }),
      profile.user_id
        ? pool.query<{
            category_code: string;
            active_tasks: string;
            completed_tasks: string;
          }>(
            `SELECT
               category_code,
               COUNT(*) FILTER (WHERE is_active = true)::text AS active_tasks,
               COUNT(*) FILTER (WHERE is_active = true AND status = 'completed')::text AS completed_tasks
             FROM goals.user_goal_tasks
             WHERE user_id = $1
             GROUP BY category_code
             ORDER BY category_code ASC`,
            [profile.user_id]
          )
        : Promise.resolve({ rows: [] }),
      pool.query<RecentDecisionRow>(
        `SELECT id, interaction_type, target_profile_public_id, created_at
         FROM discovery.profile_interactions
         WHERE actor_profile_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 20`,
        [profile.profile_id]
      ),
    ]);

    return {
      profile,
      modes: modes.rows,
      targets: targets.rows,
      progress: progress.rows,
      tasks: tasks.rows,
      recentDecisions: recentDecisions.rows,
    };
  }
}
