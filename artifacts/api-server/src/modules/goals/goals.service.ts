import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
import { DEFAULT_GOAL_TEMPLATES, GOAL_CATEGORIES, type GoalCategoryCode } from "./default-goals";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
  release?: () => void;
};

type GoalTaskRow = {
  id: number;
  category_code: GoalCategoryCode;
  sort_order: number;
  status: "active" | "completed";
};

type GoalTaskViewRow = {
  goal_key: string;
  category_code: GoalCategoryCode;
  sort_order: number;
  status: "active" | "completed";
  title_es: string;
  title_en: string;
  next_action_es: string;
  next_action_en: string;
  impact_es: string;
  impact_en: string;
};

@Injectable()
export class GoalsService {
  private mapGoalRows(rows: GoalTaskViewRow[]) {
    const ordered = rows
      .slice()
      .sort((a, b) => {
        if (a.category_code !== b.category_code) {
          return String(a.category_code).localeCompare(String(b.category_code));
        }
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return String(a.goal_key).localeCompare(String(b.goal_key));
      });

    const progressByCategory = new Map<GoalCategoryCode, number>();
    for (const category of GOAL_CATEGORIES.map((item) => item.code)) {
      const categoryRows = ordered.filter((row) => row.category_code === category);
      const completedCount = categoryRows.filter((row) => row.status === "completed").length;
      const progress = categoryRows.length
        ? Math.round((completedCount / categoryRows.length) * 100)
        : 0;
      progressByCategory.set(category, progress);
    }

    return ordered.map((row) => ({
      id: row.goal_key,
      titleEs: row.title_es,
      titleEn: row.title_en,
      category: row.category_code,
      order: row.sort_order,
      completed: row.status === "completed",
      progress: progressByCategory.get(row.category_code) || 0,
      nextActionEs: row.next_action_es,
      nextActionEn: row.next_action_en,
      impactEs: row.impact_es,
      impactEn: row.impact_en,
    }));
  }

  private async withClient<T>(
    maybeClient: DbClient | undefined,
    callback: (client: DbClient) => Promise<T>
  ) {
    if (maybeClient) {
      return callback(maybeClient);
    }

    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  async seedCatalog(client?: DbClient) {
    await this.withClient(client, async (dbClient) => {
      for (const category of GOAL_CATEGORIES) {
        await dbClient.query(
          `INSERT INTO catalog.goal_categories
            (code, label_es, label_en, sort_order, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (code) DO UPDATE SET
             label_es = EXCLUDED.label_es,
             label_en = EXCLUDED.label_en,
             sort_order = EXCLUDED.sort_order,
             is_active = true,
             updated_at = NOW()`,
          [category.code, category.labelEs, category.labelEn, category.sortOrder]
        );
      }

      for (const template of DEFAULT_GOAL_TEMPLATES) {
        await dbClient.query(
          `INSERT INTO catalog.goal_task_templates
            (goal_key, category_code, title_es, title_en, next_action_es, next_action_en, impact_es, impact_en, default_sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
           ON CONFLICT (goal_key) DO UPDATE SET
             category_code = EXCLUDED.category_code,
             title_es = EXCLUDED.title_es,
             title_en = EXCLUDED.title_en,
             next_action_es = EXCLUDED.next_action_es,
             next_action_en = EXCLUDED.next_action_en,
             impact_es = EXCLUDED.impact_es,
             impact_en = EXCLUDED.impact_en,
             default_sort_order = EXCLUDED.default_sort_order,
             is_active = true,
             updated_at = NOW()`,
          [
            template.goalKey,
            template.categoryCode,
            template.titleEs,
            template.titleEn,
            template.nextActionEs,
            template.nextActionEn,
            template.impactEs,
            template.impactEn,
            template.defaultSortOrder,
          ]
        );
      }
    });
  }

  async seedUserGoalTasks(userId: number, client?: DbClient) {
    await this.withClient(client, async (dbClient) => {
      const result = await dbClient.query<{
        id: number;
        category_code: GoalCategoryCode;
        default_sort_order: number;
      }>(
        `SELECT id, category_code, default_sort_order
         FROM catalog.goal_task_templates
         WHERE is_active = true
         ORDER BY category_code, default_sort_order, id`
      );

      if (!result.rows.length) {
        throw new Error("GOAL_TEMPLATES_NOT_SEEDED");
      }

      for (const template of result.rows) {
        await dbClient.query(
          `INSERT INTO goals.user_goal_tasks
            (user_id, template_id, category_code, sort_order, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (user_id, template_id) DO NOTHING`,
          [userId, template.id, template.category_code, template.default_sort_order]
        );
      }

      await this.rebuildUserProgress(userId, dbClient);
    });
  }

  async rebuildUserProgress(userId: number, client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const [categoriesResult, tasksResult] = await Promise.all([
        dbClient.query<{ code: GoalCategoryCode }>(
          `SELECT code
           FROM catalog.goal_categories
           WHERE is_active = true
           ORDER BY sort_order ASC, code ASC`
        ),
        dbClient.query<GoalTaskRow>(
          `SELECT id, category_code, sort_order, status
           FROM goals.user_goal_tasks
           WHERE user_id = $1
           ORDER BY category_code ASC, sort_order ASC, id ASC`,
          [userId]
        ),
      ]);

      const tasksByCategory = new Map<GoalCategoryCode, GoalTaskRow[]>();
      for (const row of tasksResult.rows) {
        const existing = tasksByCategory.get(row.category_code) || [];
        existing.push(row);
        tasksByCategory.set(row.category_code, existing);
      }

      let globalTotal = 0;
      let categoryCount = 0;

      for (const category of categoriesResult.rows) {
        const tasks = tasksByCategory.get(category.code) || [];
        const completedTasks = tasks.filter((task) => task.status === "completed").length;
        const featuredTask = tasks.find((task) => task.status === "active") || null;
        const totalTasks = tasks.length;
        const completionPercent =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        globalTotal += completionPercent;
        categoryCount += 1;

        await dbClient.query(
          `INSERT INTO goals.user_category_progress
            (user_id, category_code, featured_user_task_id, completed_tasks, total_tasks, completion_percent, computed_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (user_id, category_code) DO UPDATE SET
             featured_user_task_id = EXCLUDED.featured_user_task_id,
             completed_tasks = EXCLUDED.completed_tasks,
             total_tasks = EXCLUDED.total_tasks,
             completion_percent = EXCLUDED.completion_percent,
             computed_at = NOW(),
             updated_at = NOW()`,
          [
            userId,
            category.code,
            featuredTask?.id ?? null,
            completedTasks,
            totalTasks,
            completionPercent,
          ]
        );
      }

      const globalPercent =
        categoryCount > 0 ? Math.round(globalTotal / categoryCount) : 0;

      await dbClient.query(
        `INSERT INTO goals.user_global_progress
          (user_id, completion_percent, computed_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           completion_percent = EXCLUDED.completion_percent,
           computed_at = NOW(),
           updated_at = NOW()`,
        [userId, globalPercent]
      );

      return { userId, completionPercent: globalPercent };
    });
  }

  async rebuildAllUserProgress(client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const users = await dbClient.query<{ id: number }>(
        `SELECT id FROM auth.users WHERE status = 'active' ORDER BY id ASC`
      );

      for (const user of users.rows) {
        await this.rebuildUserProgress(user.id, dbClient);
      }

      return { rebuiltUsers: users.rows.length };
    });
  }

  async getUserGoals(userId: number, client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const result = await dbClient.query<GoalTaskViewRow>(
        `SELECT
           gtt.goal_key,
           ugt.category_code,
           ugt.sort_order,
           ugt.status,
           gtt.title_es,
           gtt.title_en,
           gtt.next_action_es,
           gtt.next_action_en,
           gtt.impact_es,
           gtt.impact_en
         FROM goals.user_goal_tasks ugt
         JOIN catalog.goal_task_templates gtt ON gtt.id = ugt.template_id
         WHERE ugt.user_id = $1
         ORDER BY ugt.category_code ASC, ugt.sort_order ASC, gtt.goal_key ASC`,
        [userId]
      );

      return {
        goals: this.mapGoalRows(result.rows),
      };
    });
  }

  async completeGoalTask(userId: number, goalKey: string) {
    const normalizedGoalKey = String(goalKey || "").trim();
    if (!normalizedGoalKey) {
      throw new Error("GOAL_NOT_FOUND");
    }

    return this.withClient(undefined, async (dbClient) => {
      await dbClient.query("BEGIN");

      try {
        const updated = await dbClient.query<{ id: number }>(
          `UPDATE goals.user_goal_tasks AS ugt
           SET status = 'completed',
               completed_at = COALESCE(ugt.completed_at, NOW()),
               updated_at = NOW()
           FROM catalog.goal_task_templates AS gtt
           WHERE ugt.template_id = gtt.id
             AND ugt.user_id = $1
             AND gtt.goal_key = $2
           RETURNING ugt.id`,
          [userId, normalizedGoalKey]
        );

        if (!updated.rows[0]) {
          throw new Error("GOAL_NOT_FOUND");
        }

        await this.rebuildUserProgress(userId, dbClient);
        const nextGoals = await this.getUserGoals(userId, dbClient);
        await dbClient.query("COMMIT");
        return nextGoals;
      } catch (error) {
        await dbClient.query("ROLLBACK");
        throw error;
      }
    });
  }

  async reorderGoalTasks(
    userId: number,
    categoryCode: GoalCategoryCode,
    orderedGoalKeys: string[]
  ) {
    return this.withClient(undefined, async (dbClient) => {
      await dbClient.query("BEGIN");

      try {
        const current = await dbClient.query<{
          goal_key: string;
          status: "active" | "completed";
        }>(
          `SELECT gtt.goal_key, ugt.status
           FROM goals.user_goal_tasks ugt
           JOIN catalog.goal_task_templates gtt ON gtt.id = ugt.template_id
           WHERE ugt.user_id = $1
             AND ugt.category_code = $2
           ORDER BY ugt.sort_order ASC, gtt.goal_key ASC`,
          [userId, categoryCode]
        );

        const activeGoalKeys = current.rows
          .filter((row) => row.status === "active")
          .map((row) => row.goal_key);
        const completedGoalKeys = current.rows
          .filter((row) => row.status === "completed")
          .map((row) => row.goal_key);

        const normalizedGoalKeys = orderedGoalKeys
          .map((value) => String(value || "").trim())
          .filter(Boolean);

        if (
          normalizedGoalKeys.length !== activeGoalKeys.length ||
          normalizedGoalKeys.some((value) => !activeGoalKeys.includes(value))
        ) {
          throw new Error("INVALID_GOAL_ORDER");
        }

        const nextGoalKeys = [...normalizedGoalKeys, ...completedGoalKeys];

        await dbClient.query(
          `UPDATE goals.user_goal_tasks
           SET sort_order = sort_order + 1000,
               updated_at = NOW()
           WHERE user_id = $1
             AND category_code = $2`,
          [userId, categoryCode]
        );

        for (const [index, goalKey] of nextGoalKeys.entries()) {
          await dbClient.query(
            `UPDATE goals.user_goal_tasks AS ugt
             SET sort_order = $3,
                 updated_at = NOW()
             FROM catalog.goal_task_templates AS gtt
             WHERE ugt.template_id = gtt.id
               AND ugt.user_id = $1
               AND ugt.category_code = $2
               AND gtt.goal_key = $4`,
            [userId, categoryCode, index, goalKey]
          );
        }

        await this.rebuildUserProgress(userId, dbClient);
        const nextGoals = await this.getUserGoals(userId, dbClient);
        await dbClient.query("COMMIT");
        return nextGoals;
      } catch (error) {
        await dbClient.query("ROLLBACK");
        throw error;
      }
    });
  }
}
