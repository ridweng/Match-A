import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";

export type ReadinessStatus = {
  dbConnected: boolean;
  missingRelations: string[];
  seededCategoryCount: number;
  seededTemplateCount: number;
  ready: boolean;
};

const REQUIRED_RELATIONS = [
  "auth.users",
  "core.profiles",
  "catalog.goal_categories",
  "catalog.goal_task_templates",
] as const;

@Injectable()
export class HealthService {
  async checkLiveness() {
    return { status: "ok" as const };
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

    return {
      dbConnected: true,
      missingRelations: relationChecks
        .filter((item) => !item.exists)
        .map((item) => item.relation),
    };
  }

  async getReadinessStatus(): Promise<ReadinessStatus> {
    const { missingRelations } = await this.checkSchemaStatus();

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
      missingRelations,
      seededCategoryCount,
      seededTemplateCount,
      ready:
        missingRelations.length === 0 &&
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

      if (readiness.missingRelations.length > 0) {
        throw new Error(
          `DATABASE_SCHEMA_NOT_READY: missing ${readiness.missingRelations.join(", ")}. Run pnpm db:setup or pnpm db:migrate.`
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
      if (schemaStatus.missingRelations.length === 0) {
        return schemaStatus;
      }

      throw new Error(
        `DATABASE_SCHEMA_NOT_READY: missing ${schemaStatus.missingRelations.join(", ")}. Run pnpm db:setup or pnpm db:migrate.`
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
