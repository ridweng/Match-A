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

@Injectable()
export class GoalsService {
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
}
