import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";

type TableRole = "source" | "projection" | "ops";
type EdgeType = "fk" | "flow";

type UserListRow = {
  profile_id: number;
  user_id: number | null;
  public_id: string;
  display_name: string;
  kind: "user" | "dummy";
  gender_identity: string;
  synthetic_group: string | null;
  dummy_batch_key: string | null;
  generation_version: number | null;
  total_likes: number | null;
  total_passes: number | null;
  threshold_reached: boolean | null;
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
  threshold?: "all" | "reached" | "pending";
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
  selectedTimeframe: Exclude<OverviewTimeframe, "all">;
  selectedCountry: string;
  availableCountries: OverviewRealCountryRow[];
  counts: OverviewCounts;
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
  architectureSections: {
    title: string;
    body: string;
  }[];
  architectureFlow: string[];
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

  private buildResolvedCountryExpression(alias: string, hasProfileCountryColumn: boolean) {
    const locationCountry = `NULLIF(TRIM(SPLIT_PART(${alias}.location, ',', array_length(regexp_split_to_array(${alias}.location, ','), 1))), '')`;
    if (hasProfileCountryColumn) {
      return `COALESCE(NULLIF(TRIM(${alias}.country), ''), ${locationCountry}, 'Unknown')`;
    }
    return `COALESCE(${locationCountry}, 'Unknown')`;
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
      const [batchCounts, dummyBreakdown] = await Promise.all([
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

  async getDatabaseView(): Promise<DatabaseView> {
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
  }

  async getOverview(filters?: OverviewFilters): Promise<OverviewView> {
    const normalizedTimeframe = this.normalizeOverviewTimeframe(filters?.timeframe);
    const selectedTimeframe =
      normalizedTimeframe === "all" ? "1m" : normalizedTimeframe;
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
          o.status AS onboarding_status,
          o.completed_at AS activated_at,
          CASE
            WHEN o.status = 'completed'::onboarding_status
             AND p.is_discoverable = true
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

    const [counts, thresholds, batches, activeBatch, genderDistribution, realUserGenderDistribution, realUserCountryDistribution, availableCountries, interactedUsers] = await Promise.all([
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
           country,
           COUNT(*)::text AS profile_count
         FROM filtered_real_profiles
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
      thresholds: thresholds.rows,
      batches: batches.rows,
      activeBatch: activeBatch.rows[0] || null,
      genderDistribution: genderDistribution.rows,
      realUserGenderDistribution: realUserGenderDistribution.rows,
      realUserCountryDistribution: realUserCountryDistribution.rows,
      interactedUsers: interactedUsers.rows,
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
  }

  async getUsers(filters?: UserListFilters) {
    const normalizedSearch = `%${String(filters?.q || "").trim().toLowerCase()}%`;
    const hasSearch = Boolean(String(filters?.q || "").trim());
    const normalizedKind =
      filters?.kind === "user" || filters?.kind === "dummy" ? filters.kind : "all";
    const normalizedThreshold =
      filters?.threshold === "reached" || filters?.threshold === "pending"
        ? filters.threshold
        : "all";
    const normalizedGenderIdentity = String(filters?.genderIdentity || "").trim();
    const normalizedSyntheticGroup = String(filters?.syntheticGroup || "").trim();
    const normalizedDummyBatchKey = String(filters?.dummyBatchKey || "").trim();
    const normalizedGenerationVersion =
      typeof filters?.generationVersion === "number" &&
      Number.isFinite(filters.generationVersion)
        ? filters.generationVersion
        : null;

    const result = await pool.query<UserListRow>(
      `SELECT
         p.id AS profile_id,
         p.user_id,
         p.public_id,
         p.display_name,
         p.kind,
         p.gender_identity,
         pdm.synthetic_group,
         pdm.dummy_batch_key,
         pdm.generation_version,
         pth.total_likes,
         pth.total_passes,
         pth.threshold_reached,
         (SELECT MAX(pi.created_at) FROM discovery.profile_interactions pi WHERE pi.actor_profile_id = p.id) AS last_decision_at,
         ugpm.last_recomputed_at
       FROM core.profiles p
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
       AND (
         $4::text = 'all'
         OR ($4::text = 'reached' AND COALESCE(pth.threshold_reached, false) = true)
         OR ($4::text = 'pending' AND COALESCE(pth.threshold_reached, false) = false)
       )
       AND ($5::text = '' OR LOWER(p.gender_identity) = LOWER($5))
       AND ($6::text = '' OR LOWER(COALESCE(pdm.synthetic_group, '')) = LOWER($6))
       AND ($7::text = '' OR LOWER(COALESCE(pdm.dummy_batch_key, '')) = LOWER($7))
       AND ($8::int IS NULL OR pdm.generation_version = $8)
       ORDER BY p.kind ASC, p.id ASC`,
      [
        hasSearch,
        normalizedSearch,
        normalizedKind,
        normalizedThreshold,
        normalizedGenderIdentity,
        normalizedSyntheticGroup,
        normalizedDummyBatchKey,
        normalizedGenerationVersion,
      ]
    );

    return result.rows;
  }

  async getUserFilterOptions(): Promise<UserFilterOptions> {
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
