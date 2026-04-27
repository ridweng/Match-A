import { Inject, Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
import { CacheService } from "../cache/cache.service";

export type ReadinessStatus = {
  dbConnected: boolean;
  cache: ReturnType<CacheService["getStatus"]>;
  missingRelations: string[];
  missingColumns: string[];
  seededCategoryCount: number;
  seededTemplateCount: number;
  ready: boolean;
};

const REQUIRED_RELATIONS = [
  "auth.users",
  "core.profiles",
  "catalog.goal_categories",
  "catalog.goal_task_templates",
  "discovery.profile_decisions",
  "discovery.profile_preference_thresholds",
  "discovery.filter_preferences",
  "discovery.profile_reset_state",
  "discovery.actor_state",
  "discovery.actor_queue",
  "goals.user_unlock_state",
] as const;

const REQUIRED_COLUMNS = [
  {
    schema: "discovery",
    table: "profile_preference_thresholds",
    column: "threshold_reached_at",
  },
  {
    schema: "discovery",
    table: "profile_preference_thresholds",
    column: "last_decision_event_at",
  },
  {
    schema: "discovery",
    table: "profile_preference_thresholds",
    column: "last_decision_interaction_id",
  },
] as const;

@Injectable()
export class HealthService {
  constructor(
    @Inject(CacheService) private readonly cacheService: CacheService
  ) {}

  async checkLiveness() {
    return { status: "ok" as const };
  }

  getCacheStatus() {
    return this.cacheService.getStatus();
  }

  async checkSchemaStatus() {
    await pool.query("SELECT 1");

    const relationChecks = await Promise.all(
      REQUIRED_RELATIONS.map(async (relation) => {
        const result = await pool.query<{ relation_name: string | null }>(
          "SELECT to_regclass($1) AS relation_name",
          [relation]
        );
        return {
          relation,
          exists: Boolean(result.rows[0]?.relation_name),
        };
      })
    );

    const columnChecks = await Promise.all(
      REQUIRED_COLUMNS.map(async (column) => {
        const result = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = $1
               AND table_name = $2
               AND column_name = $3
           ) AS exists`,
          [column.schema, column.table, column.column]
        );
        return {
          column: `${column.schema}.${column.table}.${column.column}`,
          exists: Boolean(result.rows[0]?.exists),
        };
      })
    );

    return {
      dbConnected: true,
      missingRelations: relationChecks
        .filter((item) => !item.exists)
        .map((item) => item.relation),
      missingColumns: columnChecks
        .filter((item) => !item.exists)
        .map((item) => item.column),
    };
  }

  async getReadinessStatus(): Promise<ReadinessStatus> {
    const { missingRelations, missingColumns } = await this.checkSchemaStatus();

    let seededCategoryCount = 0;
    let seededTemplateCount = 0;

    if (!missingRelations.includes("catalog.goal_categories")) {
      const result = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM catalog.goal_categories WHERE is_active = true"
      );
      seededCategoryCount = Number(result.rows[0]?.count || 0);
    }

    if (!missingRelations.includes("catalog.goal_task_templates")) {
      const result = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM catalog.goal_task_templates WHERE is_active = true"
      );
      seededTemplateCount = Number(result.rows[0]?.count || 0);
    }

    return {
      dbConnected: true,
      cache: this.cacheService.getStatus(),
      missingRelations,
      missingColumns,
      seededCategoryCount,
      seededTemplateCount,
      ready:
        missingRelations.length === 0 &&
        missingColumns.length === 0 &&
        seededCategoryCount >= 6 &&
        seededTemplateCount >= 18,
    };
  }

  async assertReadiness() {
    try {
      const readiness = await this.getReadinessStatus();
      if (readiness.ready) {
        return readiness;
      }

      if (readiness.missingRelations.length > 0 || readiness.missingColumns.length > 0) {
        const missing = [...readiness.missingRelations, ...readiness.missingColumns];
        throw new Error(
          `DATABASE_SCHEMA_NOT_READY: missing ${missing.join(", ")}. Run pnpm db:setup or pnpm db:migrate.`
        );
      }

      throw new Error(
        `DATABASE_SEED_NOT_READY: found ${readiness.seededCategoryCount} categories and ${readiness.seededTemplateCount} templates. Run pnpm db:seed.`
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("DATABASE_")) {
        throw error;
      }
      throw new Error(
        "DATABASE_CONNECTION_FAILED: unable to verify database readiness. Check DATABASE_URL and Postgres availability."
      );
    }
  }

  async assertSchemaReady() {
    try {
      const schemaStatus = await this.checkSchemaStatus();
      if (
        schemaStatus.missingRelations.length === 0 &&
        schemaStatus.missingColumns.length === 0
      ) {
        return schemaStatus;
      }

      const missing = [...schemaStatus.missingRelations, ...schemaStatus.missingColumns];

      throw new Error(
        `DATABASE_SCHEMA_NOT_READY: missing ${missing.join(", ")}. Run pnpm db:setup or pnpm db:migrate.`
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("DATABASE_")) {
        throw error;
      }
      throw new Error(
        "DATABASE_CONNECTION_FAILED: unable to verify database schema readiness. Check DATABASE_URL and Postgres availability."
      );
    }
  }
}
