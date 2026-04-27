import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
import { CacheService } from "../cache/cache.service";
import { CACHE_TTL_SECONDS } from "../cache/cache.constants";
import { cacheKeys } from "../cache/cache.keys";
import { rebuildDiscoveryProjectionsForActor } from "../discovery/discovery.projections";
import {
  DEFAULT_GOAL_TEMPLATES,
  DEFAULT_CATEGORY_GOAL_RULES,
  DEFAULT_PREFERENCE_VALUES,
  GOAL_CATEGORIES,
  type GoalCategoryCode,
  type GoalComparisonModel,
} from "./default-goals";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
  release?: () => void;
};

type GoalTaskRow = {
  id: number;
  template_id: number;
  category_code: GoalCategoryCode;
  sort_order: number;
  status: "active" | "completed";
  is_active: boolean;
  target_value_key: string | null;
  rule_key: string | null;
  task_template_group_key: string;
  projection_version: number;
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

type CategoryConfigRow = {
  code: GoalCategoryCode;
  comparison_model: GoalComparisonModel;
  supports_task_generation: boolean;
  threshold_like_count: number;
  goal_engine_enabled: boolean;
  is_active: boolean;
};

type ProfileCategoryValueRow = {
  category_code: GoalCategoryCode;
  value_key: string;
};

type ModeRow = {
  category_code: GoalCategoryCode;
  current_value_key: string | null;
  current_count: number;
  total_likes_considered: number;
  last_changed_at_interaction_id: number | null;
};

type ThresholdRow = {
  total_likes: number;
  total_passes: number;
  likes_until_unlock: number;
  threshold_reached: boolean;
};

type PreferenceValueRow = {
  category_code: GoalCategoryCode;
  value_key: string;
  ordinal_rank: number | null;
  group_key: string | null;
};

type GoalRuleRow = {
  category_code: GoalCategoryCode;
  rule_key: string;
  gap_min: number;
  gap_max: number;
  task_template_group_key: string;
};

type GoalTargetRow = {
  categoryCode: GoalCategoryCode;
  currentValueKey: string | null;
  derivedModeValueKey: string | null;
  targetValueKey: string | null;
  derivationStatus: "insufficient_likes" | "excluded_category" | "derived" | "no_rule_match";
  thresholdReached: boolean;
  sourceEventId: number | null;
  distanceRaw: number;
  distanceNormalized: number;
  completionPercent: number;
  progressState: "locked" | "excluded" | "unavailable" | "in_progress" | "complete";
  ruleKey: string | null;
  taskTemplateGroupKey: string | null;
};

type GoalsUnlockStateRow = {
  actor_profile_id: number;
  threshold_like_count: number;
  threshold_reached_at: string | Date | null;
  threshold_reached_event_id: number | null;
  goals_unlock_event_emitted_at: string | Date | null;
  goals_unlock_message_seen_at: string | Date | null;
};

type GoalsUnlockState = {
  available: boolean;
  justUnlocked: boolean;
  unlockMessagePending: boolean;
  goalsUnlockEventEmittedAt: string | null;
  goalsUnlockMessageSeenAt: string | null;
};

@Injectable()
export class GoalsService {
  private readonly thresholdDefault = 30;

  constructor(private readonly cacheService: CacheService) {}

  private toIsoTimestamp(input: string | Date | null | undefined) {
    if (!input) {
      return null;
    }
    if (input instanceof Date) {
      return input.toISOString();
    }
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

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

  private humanizeValueKey(valueKey: string) {
    return String(valueKey || "")
      .trim()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async getGoalsUnlockState(
    userId: number,
    client?: DbClient,
    options?: { justUnlocked?: boolean }
  ): Promise<GoalsUnlockState> {
    return this.withClient(client, async (dbClient) => {
      const result = await dbClient.query<GoalsUnlockStateRow>(
        `SELECT
           actor_profile_id,
           threshold_like_count,
           threshold_reached_at,
           threshold_reached_event_id,
           goals_unlock_event_emitted_at,
           goals_unlock_message_seen_at
         FROM goals.user_unlock_state
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      const row = result.rows[0];
      const available = Boolean(
        row?.threshold_reached_at || row?.goals_unlock_event_emitted_at
      );

      return {
        available,
        justUnlocked: Boolean(options?.justUnlocked),
        unlockMessagePending: Boolean(
          row?.goals_unlock_event_emitted_at && !row?.goals_unlock_message_seen_at
        ),
        goalsUnlockEventEmittedAt: this.toIsoTimestamp(row?.goals_unlock_event_emitted_at),
        goalsUnlockMessageSeenAt: this.toIsoTimestamp(row?.goals_unlock_message_seen_at),
      };
    });
  }

  async syncGoalsUnlockState(
    userId: number,
    input: {
      actorProfileId: number;
      previousThresholdReached: boolean;
      thresholdReached: boolean;
      thresholdReachedAt: string | Date | null;
      thresholdReachedEventId: number | null;
    },
    client?: DbClient
  ) {
    return this.withClient(client, async (dbClient) => {
      const justUnlocked = !input.previousThresholdReached && input.thresholdReached;

      if (justUnlocked) {
        await dbClient.query(
          `INSERT INTO goals.user_unlock_state
            (user_id, actor_profile_id, threshold_like_count, threshold_reached_at, threshold_reached_event_id, goals_unlock_event_emitted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             actor_profile_id = EXCLUDED.actor_profile_id,
             threshold_like_count = EXCLUDED.threshold_like_count,
             threshold_reached_at = COALESCE(goals.user_unlock_state.threshold_reached_at, EXCLUDED.threshold_reached_at),
             threshold_reached_event_id = COALESCE(goals.user_unlock_state.threshold_reached_event_id, EXCLUDED.threshold_reached_event_id),
             goals_unlock_event_emitted_at = COALESCE(goals.user_unlock_state.goals_unlock_event_emitted_at, NOW()),
             updated_at = NOW()`,
          [
            userId,
            input.actorProfileId,
            this.thresholdDefault,
            input.thresholdReachedAt,
            input.thresholdReachedEventId,
          ]
        );
      } else if (input.thresholdReached) {
        await dbClient.query(
          `INSERT INTO goals.user_unlock_state
            (user_id, actor_profile_id, threshold_like_count, threshold_reached_at, threshold_reached_event_id, goals_unlock_event_emitted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $4, NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             actor_profile_id = EXCLUDED.actor_profile_id,
             threshold_like_count = EXCLUDED.threshold_like_count,
             threshold_reached_at = COALESCE(goals.user_unlock_state.threshold_reached_at, EXCLUDED.threshold_reached_at),
             threshold_reached_event_id = COALESCE(goals.user_unlock_state.threshold_reached_event_id, EXCLUDED.threshold_reached_event_id),
             goals_unlock_event_emitted_at = COALESCE(goals.user_unlock_state.goals_unlock_event_emitted_at, EXCLUDED.goals_unlock_event_emitted_at),
             updated_at = NOW()`,
          [
            userId,
            input.actorProfileId,
            this.thresholdDefault,
            input.thresholdReachedAt,
            input.thresholdReachedEventId,
          ]
        );
      }

      return this.getGoalsUnlockState(userId, dbClient, { justUnlocked });
    });
  }

  async markGoalsUnlockSeen(userId: number, client?: DbClient) {
    const result = await this.withClient(client, async (dbClient) => {
      await dbClient.query(
        `UPDATE goals.user_unlock_state
         SET goals_unlock_message_seen_at = COALESCE(goals_unlock_message_seen_at, NOW()),
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      return this.getGoalsUnlockState(userId, dbClient, { justUnlocked: false });
    });
    if (!client) {
      await this.invalidateUserGoalCaches(userId);
    }
    return result;
  }

  private async findProfileId(userId: number, client: DbClient) {
    const result = await client.query<{ id: number }>(
      `SELECT id
       FROM core.profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    const profileId = result.rows[0]?.id;
    if (!profileId) {
      throw new Error("PROFILE_NOT_FOUND");
    }
    return profileId;
  }

  private async buildCanonicalCategoryValues(profileId: number, client: DbClient) {
    const profileResult = await client.query<{
      personality: string;
      relationship_goals: string;
      education: string;
      children_preference: string;
      body_type: string;
    }>(
      `SELECT personality, relationship_goals, education, children_preference, body_type
       FROM core.profiles
       WHERE id = $1
       LIMIT 1`,
      [profileId]
    );
    const languagesResult = await client.query<{ language_code: string }>(
      `SELECT language_code
       FROM core.profile_languages
       WHERE profile_id = $1
       ORDER BY position ASC, language_code ASC
       LIMIT 1`,
      [profileId]
    );

    const profile = profileResult.rows[0];
    if (!profile) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    const firstLanguage = languagesResult.rows[0]?.language_code || null;
    const values: Array<{
      categoryCode: GoalCategoryCode;
      valueKey: string | null;
      normalizedNumericValue: number | null;
    }> = [
      {
        categoryCode: "physical",
        valueKey: String(profile.body_type || "").trim() || null,
        normalizedNumericValue: null,
      },
      {
        categoryCode: "personality",
        valueKey: String(profile.personality || "").trim() || null,
        normalizedNumericValue: null,
      },
      {
        categoryCode: "family",
        valueKey: String(profile.children_preference || "").trim() || null,
        normalizedNumericValue: null,
      },
      {
        categoryCode: "expectations",
        valueKey: String(profile.relationship_goals || "").trim() || null,
        normalizedNumericValue: null,
      },
      {
        categoryCode: "language",
        valueKey: firstLanguage ? String(firstLanguage).trim() : null,
        normalizedNumericValue: null,
      },
      {
        categoryCode: "studies",
        valueKey: String(profile.education || "").trim() || null,
        normalizedNumericValue: null,
      },
    ];

    return values;
  }

  private async ensurePreferenceValueExists(
    client: DbClient,
    categoryCode: GoalCategoryCode,
    valueKey: string
  ) {
    await client.query(
      `INSERT INTO catalog.preference_values
        (category_code, value_key, label_es, label_en, sort_order, ordinal_rank, group_key, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $3, 999, NULL, NULL, true, NOW(), NOW())
       ON CONFLICT (category_code, value_key) DO NOTHING`,
      [categoryCode, valueKey, this.humanizeValueKey(valueKey)]
    );
  }

  async syncUserProfileCategoryValues(userId: number, client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const profileId = await this.findProfileId(userId, dbClient);
      const values = await this.buildCanonicalCategoryValues(profileId, dbClient);

      await dbClient.query(
        `DELETE FROM core.profile_category_values
         WHERE profile_id = $1`,
        [profileId]
      );

      for (const item of values) {
        if (!item.valueKey) {
          continue;
        }
        await this.ensurePreferenceValueExists(dbClient, item.categoryCode, item.valueKey);
        await dbClient.query(
          `INSERT INTO core.profile_category_values
            (profile_id, category_code, value_key, normalized_numeric_value, source, updated_at)
           VALUES ($1, $2, $3, $4, 'profile', NOW())`,
          [profileId, item.categoryCode, item.valueKey, item.normalizedNumericValue]
        );
      }

      return { profileId, syncedCategories: values.filter((item) => item.valueKey).length };
    });
  }

  async seedCatalog(client?: DbClient) {
    await this.withClient(client, async (dbClient) => {
      for (const category of GOAL_CATEGORIES) {
        await dbClient.query(
          `INSERT INTO catalog.goal_categories
            (code, label_es, label_en, sort_order, comparison_model, supports_mode_display, supports_goal_derivation, supports_progress_calculation, supports_task_generation, threshold_like_count, goal_engine_enabled, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
           ON CONFLICT (code) DO UPDATE SET
             label_es = EXCLUDED.label_es,
             label_en = EXCLUDED.label_en,
             sort_order = EXCLUDED.sort_order,
             comparison_model = EXCLUDED.comparison_model,
             supports_mode_display = EXCLUDED.supports_mode_display,
             supports_goal_derivation = EXCLUDED.supports_goal_derivation,
             supports_progress_calculation = EXCLUDED.supports_progress_calculation,
             supports_task_generation = EXCLUDED.supports_task_generation,
             threshold_like_count = EXCLUDED.threshold_like_count,
             goal_engine_enabled = EXCLUDED.goal_engine_enabled,
             is_active = true,
             updated_at = NOW()`,
          [
            category.code,
            category.labelEs,
            category.labelEn,
            category.sortOrder,
            category.comparisonModel,
            category.supportsModeDisplay,
            category.supportsGoalDerivation,
            category.supportsProgressCalculation,
            category.supportsTaskGeneration,
            category.thresholdLikeCount,
            category.goalEngineEnabled,
          ]
        );
      }

      for (const value of DEFAULT_PREFERENCE_VALUES) {
        await dbClient.query(
          `INSERT INTO catalog.preference_values
            (category_code, value_key, label_es, label_en, sort_order, ordinal_rank, group_key, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (category_code, value_key) DO UPDATE SET
             label_es = EXCLUDED.label_es,
             label_en = EXCLUDED.label_en,
             sort_order = EXCLUDED.sort_order,
             ordinal_rank = EXCLUDED.ordinal_rank,
             group_key = EXCLUDED.group_key,
             is_active = true,
             updated_at = NOW()`,
          [
            value.categoryCode,
            value.valueKey,
            value.labelEs,
            value.labelEn,
            value.sortOrder,
            value.ordinalRank ?? null,
            null,
          ]
        );
      }

      for (const rule of DEFAULT_CATEGORY_GOAL_RULES) {
        await dbClient.query(
          `INSERT INTO catalog.category_goal_rules
            (category_code, rule_key, gap_min, gap_max, target_selection_strategy, progress_formula_type, task_template_group_key, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (category_code, rule_key) DO UPDATE SET
             gap_min = EXCLUDED.gap_min,
             gap_max = EXCLUDED.gap_max,
             target_selection_strategy = EXCLUDED.target_selection_strategy,
             progress_formula_type = EXCLUDED.progress_formula_type,
             task_template_group_key = EXCLUDED.task_template_group_key,
             is_active = true,
             updated_at = NOW()`,
          [
            rule.categoryCode,
            rule.ruleKey,
            rule.gapMin,
            rule.gapMax,
            rule.targetSelectionStrategy,
            rule.progressFormulaType,
            rule.taskTemplateGroupKey,
          ]
        );
      }

      for (const template of DEFAULT_GOAL_TEMPLATES) {
        await dbClient.query(
          `INSERT INTO catalog.goal_task_templates
            (goal_key, category_code, title_es, title_en, next_action_es, next_action_en, impact_es, impact_en, task_template_group_key, default_sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
           ON CONFLICT (goal_key) DO UPDATE SET
             category_code = EXCLUDED.category_code,
             title_es = EXCLUDED.title_es,
             title_en = EXCLUDED.title_en,
             next_action_es = EXCLUDED.next_action_es,
             next_action_en = EXCLUDED.next_action_en,
             impact_es = EXCLUDED.impact_es,
             impact_en = EXCLUDED.impact_en,
             task_template_group_key = EXCLUDED.task_template_group_key,
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
            template.taskTemplateGroupKey,
            template.defaultSortOrder,
          ]
        );
      }
    });
  }

  private async loadGoalEngineInputs(userId: number, client: DbClient) {
    const profileId = await this.findProfileId(userId, client);
    const categoriesResult = await client.query<CategoryConfigRow>(
      `SELECT
         code,
         comparison_model,
         supports_task_generation,
         threshold_like_count,
         goal_engine_enabled,
         is_active
       FROM catalog.goal_categories
       WHERE is_active = true
       ORDER BY sort_order ASC, code ASC`
    );
    const currentValuesResult = await client.query<ProfileCategoryValueRow>(
      `SELECT category_code, value_key
       FROM core.profile_category_values
       WHERE profile_id = $1`,
      [profileId]
    );
    const modesResult = await client.query<ModeRow>(
      `SELECT
         category_code,
         current_value_key,
         current_count,
         total_likes_considered,
         last_changed_at_interaction_id
       FROM discovery.popular_attribute_modes
       WHERE actor_profile_id = $1`,
      [profileId]
    );
    const thresholdResult = await client.query<ThresholdRow>(
      `SELECT total_likes, total_passes, likes_until_unlock, threshold_reached
       FROM discovery.profile_preference_thresholds
       WHERE actor_profile_id = $1
       LIMIT 1`,
      [profileId]
    );
    const valuesResult = await client.query<PreferenceValueRow>(
      `SELECT category_code, value_key, ordinal_rank, group_key
       FROM catalog.preference_values
       WHERE is_active = true`
    );
    const rulesResult = await client.query<GoalRuleRow>(
      `SELECT category_code, rule_key, gap_min, gap_max, task_template_group_key
       FROM catalog.category_goal_rules
       WHERE is_active = true
       ORDER BY category_code ASC, gap_min ASC, gap_max ASC, rule_key ASC`
    );

    return {
      profileId,
      categories: categoriesResult.rows,
      currentValues: currentValuesResult.rows,
      modes: modesResult.rows,
      threshold: thresholdResult.rows[0] || {
        total_likes: 0,
        total_passes: 0,
        likes_until_unlock: this.thresholdDefault,
        threshold_reached: false,
      },
      preferenceValues: valuesResult.rows,
      rules: rulesResult.rows,
    };
  }

  private buildPreferenceValueMaps(rows: PreferenceValueRow[]) {
    const rankMap = new Map<string, number>();
    const groupMap = new Map<string, string | null>();

    for (const row of rows) {
      const key = `${row.category_code}:${row.value_key}`;
      if (typeof row.ordinal_rank === "number") {
        rankMap.set(key, row.ordinal_rank);
      }
      groupMap.set(key, row.group_key);
    }

    return { rankMap, groupMap };
  }

  private computeGap(
    comparisonModel: GoalComparisonModel,
    categoryCode: GoalCategoryCode,
    currentValueKey: string | null,
    targetValueKey: string | null,
    maps: ReturnType<GoalsService["buildPreferenceValueMaps"]>
  ) {
    if (!currentValueKey || !targetValueKey) {
      return { distanceRaw: 0, distanceNormalized: 0, completionPercent: 0, progressState: "unavailable" as const };
    }

    if (comparisonModel === "exact") {
      const matched = currentValueKey === targetValueKey;
      return {
        distanceRaw: matched ? 0 : 1,
        distanceNormalized: matched ? 0 : 100,
        completionPercent: matched ? 100 : 0,
        progressState: matched ? ("complete" as const) : ("in_progress" as const),
      };
    }

    if (comparisonModel === "equivalence") {
      const currentGroup =
        maps.groupMap.get(`${categoryCode}:${currentValueKey}`) || currentValueKey;
      const targetGroup =
        maps.groupMap.get(`${categoryCode}:${targetValueKey}`) || targetValueKey;
      const matched = currentGroup === targetGroup;
      return {
        distanceRaw: matched ? 0 : 1,
        distanceNormalized: matched ? 0 : 100,
        completionPercent: matched ? 100 : 0,
        progressState: matched ? ("complete" as const) : ("in_progress" as const),
      };
    }

    const currentRank = maps.rankMap.get(`${categoryCode}:${currentValueKey}`);
    const targetRank = maps.rankMap.get(`${categoryCode}:${targetValueKey}`);
    if (!Number.isFinite(currentRank) || !Number.isFinite(targetRank)) {
      const matched = currentValueKey === targetValueKey;
      return {
        distanceRaw: matched ? 0 : 1,
        distanceNormalized: matched ? 0 : 100,
        completionPercent: matched ? 100 : 0,
        progressState: matched ? ("complete" as const) : ("in_progress" as const),
      };
    }

    const distanceRaw = Math.abs(Number(targetRank) - Number(currentRank));
    const maxRank = Math.max(
      ...Array.from(maps.rankMap.entries())
        .filter(([key]) => key.startsWith(`${categoryCode}:`))
        .map(([, rank]) => rank)
    );
    const distanceNormalized =
      maxRank > 0 ? Math.round((distanceRaw / maxRank) * 100) : distanceRaw > 0 ? 100 : 0;
    const completionPercent = Math.max(0, 100 - distanceNormalized);

    return {
      distanceRaw,
      distanceNormalized,
      completionPercent,
      progressState:
        completionPercent >= 100 ? ("complete" as const) : ("in_progress" as const),
    };
  }

  private selectGoalRule(
    categoryCode: GoalCategoryCode,
    distanceRaw: number,
    rules: GoalRuleRow[]
  ) {
    return (
      rules.find(
        (rule) =>
          rule.category_code === categoryCode &&
          distanceRaw >= rule.gap_min &&
          distanceRaw <= rule.gap_max
      ) || null
    );
  }

  private async buildGoalTargets(userId: number, client: DbClient) {
    const inputs = await this.loadGoalEngineInputs(userId, client);
    const maps = this.buildPreferenceValueMaps(inputs.preferenceValues);
    const currentValues = new Map(
      inputs.currentValues.map((row) => [row.category_code, row.value_key])
    );
    const modes = new Map(
      inputs.modes.map((row) => [row.category_code, row])
    );

    const targets: GoalTargetRow[] = [];

    for (const category of inputs.categories) {
      const currentValueKey = currentValues.get(category.code) || null;
      const mode = modes.get(category.code);
      const derivedModeValueKey = mode?.current_value_key || null;
      const thresholdReached = Boolean(inputs.threshold.threshold_reached);

      if (!category.goal_engine_enabled) {
        targets.push({
          categoryCode: category.code,
          currentValueKey,
          derivedModeValueKey,
          targetValueKey: null,
          derivationStatus: "excluded_category",
          thresholdReached,
          sourceEventId: mode?.last_changed_at_interaction_id || null,
          distanceRaw: 0,
          distanceNormalized: 0,
          completionPercent: 0,
          progressState: "excluded",
          ruleKey: null,
          taskTemplateGroupKey: null,
        });
        continue;
      }

      if (!thresholdReached) {
        targets.push({
          categoryCode: category.code,
          currentValueKey,
          derivedModeValueKey,
          targetValueKey: null,
          derivationStatus: "insufficient_likes",
          thresholdReached,
          sourceEventId: mode?.last_changed_at_interaction_id || null,
          distanceRaw: 0,
          distanceNormalized: 0,
          completionPercent: 0,
          progressState: "locked",
          ruleKey: null,
          taskTemplateGroupKey: null,
        });
        continue;
      }

      if (!currentValueKey || !derivedModeValueKey) {
        targets.push({
          categoryCode: category.code,
          currentValueKey,
          derivedModeValueKey,
          targetValueKey: null,
          derivationStatus: "no_rule_match",
          thresholdReached,
          sourceEventId: mode?.last_changed_at_interaction_id || null,
          distanceRaw: 0,
          distanceNormalized: 0,
          completionPercent: 0,
          progressState: "unavailable",
          ruleKey: null,
          taskTemplateGroupKey: null,
        });
        continue;
      }

      const targetValueKey = derivedModeValueKey;
      const progress = this.computeGap(
        category.comparison_model,
        category.code,
        currentValueKey,
        targetValueKey,
        maps
      );
      const rule = this.selectGoalRule(category.code, progress.distanceRaw, inputs.rules);

      targets.push({
        categoryCode: category.code,
        currentValueKey,
        derivedModeValueKey,
        targetValueKey: rule ? targetValueKey : null,
        derivationStatus: rule ? "derived" : "no_rule_match",
        thresholdReached,
        sourceEventId: mode?.last_changed_at_interaction_id || null,
        distanceRaw: rule ? progress.distanceRaw : 0,
        distanceNormalized: rule ? progress.distanceNormalized : 0,
        completionPercent: rule ? progress.completionPercent : 0,
        progressState: rule ? progress.progressState : "unavailable",
        ruleKey: rule?.rule_key || null,
        taskTemplateGroupKey: rule?.task_template_group_key || null,
      });
    }

    return { profileId: inputs.profileId, threshold: inputs.threshold, targets };
  }

  private async persistGoalTargets(userId: number, targets: GoalTargetRow[], client: DbClient) {
    for (const target of targets) {
      await client.query(
        `INSERT INTO goals.user_category_targets
          (user_id, category_code, current_value_key, derived_mode_value_key, target_value_key, derivation_status, threshold_reached, source_event_id, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (user_id, category_code) DO UPDATE SET
           current_value_key = EXCLUDED.current_value_key,
           derived_mode_value_key = EXCLUDED.derived_mode_value_key,
           target_value_key = EXCLUDED.target_value_key,
           derivation_status = EXCLUDED.derivation_status,
           threshold_reached = EXCLUDED.threshold_reached,
           source_event_id = EXCLUDED.source_event_id,
           computed_at = NOW()`,
        [
          userId,
          target.categoryCode,
          target.currentValueKey,
          target.derivedModeValueKey,
          target.targetValueKey,
          target.derivationStatus,
          target.thresholdReached,
          target.sourceEventId,
        ]
      );

      await client.query(
        `INSERT INTO goals.user_category_target_progress
          (user_id, category_code, current_value_key, target_value_key, distance_raw, distance_normalized, completion_percent, progress_state, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (user_id, category_code) DO UPDATE SET
           current_value_key = EXCLUDED.current_value_key,
           target_value_key = EXCLUDED.target_value_key,
           distance_raw = EXCLUDED.distance_raw,
           distance_normalized = EXCLUDED.distance_normalized,
           completion_percent = EXCLUDED.completion_percent,
           progress_state = EXCLUDED.progress_state,
           computed_at = NOW()`,
        [
          userId,
          target.categoryCode,
          target.currentValueKey,
          target.targetValueKey,
          target.distanceRaw,
          target.distanceNormalized,
          target.completionPercent,
          target.progressState,
        ]
      );
    }
  }

  private async syncAssignedTasks(userId: number, targets: GoalTargetRow[], client: DbClient) {
    const desiredAssignments = new Map<
      number,
      {
        categoryCode: GoalCategoryCode;
        sortOrder: number;
        targetValueKey: string | null;
        ruleKey: string | null;
        taskTemplateGroupKey: string;
      }
    >();

    const templatesResult = await client.query<{
      id: number;
      category_code: GoalCategoryCode;
      default_sort_order: number;
      task_template_group_key: string;
    }>(
      `SELECT id, category_code, default_sort_order, task_template_group_key
       FROM catalog.goal_task_templates
       WHERE is_active = true
       ORDER BY category_code ASC, default_sort_order ASC, id ASC`
    );

    const currentAssignments = await client.query<GoalTaskRow>(
      `SELECT
         id,
         template_id,
         category_code,
         sort_order,
         status,
         is_active,
         target_value_key,
         rule_key,
         task_template_group_key,
         projection_version
       FROM goals.user_goal_tasks
       WHERE user_id = $1`,
      [userId]
    );

    const templates = templatesResult.rows;
    const rowsByTemplateId = new Map(
      currentAssignments.rows.map((row) => [row.template_id, row])
    );
    const reusableRowsBySlot = new Map<string, GoalTaskRow>();

    for (const target of targets) {
      if (
        target.derivationStatus !== "derived" ||
        !target.taskTemplateGroupKey ||
        !target.ruleKey
      ) {
        continue;
      }

      const matchingTemplates = templates.filter(
        (template) =>
          template.category_code === target.categoryCode &&
          template.task_template_group_key === target.taskTemplateGroupKey
      );

      for (const template of matchingTemplates) {
        desiredAssignments.set(template.id, {
          categoryCode: target.categoryCode,
          sortOrder: template.default_sort_order,
          targetValueKey: target.targetValueKey,
          ruleKey: target.ruleKey,
          taskTemplateGroupKey: target.taskTemplateGroupKey,
        });
      }
    }

    for (const row of currentAssignments.rows) {
      if (desiredAssignments.has(row.template_id)) {
        continue;
      }
      const slotKey = `${row.category_code}:${row.sort_order}`;
      if (!reusableRowsBySlot.has(slotKey)) {
        reusableRowsBySlot.set(slotKey, row);
      }
    }

    for (const row of currentAssignments.rows) {
      if (!row.is_active) {
        continue;
      }

      const desired = desiredAssignments.get(row.template_id);
      if (desired) {
        continue;
      }

      await client.query(
        `UPDATE goals.user_goal_tasks
         SET is_active = false,
             superseded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
    }

    for (const [templateId, desired] of desiredAssignments.entries()) {
      const existing = rowsByTemplateId.get(templateId);
      const slotKey = `${desired.categoryCode}:${desired.sortOrder}`;

      if (
        existing &&
        existing.is_active &&
        existing.target_value_key === desired.targetValueKey &&
        existing.rule_key === desired.ruleKey &&
        existing.task_template_group_key === desired.taskTemplateGroupKey &&
        existing.sort_order === desired.sortOrder
      ) {
        continue;
      }

      if (existing) {
        const sameAssignment =
          existing.target_value_key === desired.targetValueKey &&
          existing.rule_key === desired.ruleKey &&
          existing.task_template_group_key === desired.taskTemplateGroupKey;

        await client.query(
          `UPDATE goals.user_goal_tasks
           SET category_code = $2,
               sort_order = $3,
               assignment_source = 'derived_target',
               target_value_key = $4,
               rule_key = $5,
               task_template_group_key = $6,
               projection_version = CASE WHEN $7 THEN projection_version ELSE projection_version + 1 END,
               is_active = true,
               superseded_at = NULL,
               status = CASE WHEN $7 THEN status ELSE 'active'::task_status END,
               completed_at = CASE WHEN $7 THEN completed_at ELSE NULL END,
               updated_at = NOW()
           WHERE id = $1`,
          [
            existing.id,
            desired.categoryCode,
            desired.sortOrder,
            desired.targetValueKey,
            desired.ruleKey,
            desired.taskTemplateGroupKey,
            sameAssignment,
          ]
        );
        continue;
      }

      const reusable = reusableRowsBySlot.get(slotKey);
      if (reusable) {
        reusableRowsBySlot.delete(slotKey);
        await client.query(
          `UPDATE goals.user_goal_tasks
           SET template_id = $2,
               category_code = $3,
               sort_order = $4,
               status = 'active'::task_status,
               assignment_source = 'derived_target',
               target_value_key = $5,
               rule_key = $6,
               task_template_group_key = $7,
               projection_version = projection_version + 1,
               is_active = true,
               completed_at = NULL,
               superseded_at = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [
            reusable.id,
            templateId,
            desired.categoryCode,
            desired.sortOrder,
            desired.targetValueKey,
            desired.ruleKey,
            desired.taskTemplateGroupKey,
          ]
        );
        continue;
      }

      await client.query(
        `INSERT INTO goals.user_goal_tasks
          (user_id, template_id, category_code, sort_order, status, assignment_source, target_value_key, rule_key, task_template_group_key, projection_version, is_active, completed_at, superseded_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', 'derived_target', $5, $6, $7, 1, true, NULL, NULL, NOW(), NOW())`,
        [
          userId,
          templateId,
          desired.categoryCode,
          desired.sortOrder,
          desired.targetValueKey,
          desired.ruleKey,
          desired.taskTemplateGroupKey,
        ]
      );
    }
  }

  async rebuildUserGoalTargets(
    userId: number,
    client?: DbClient,
    options?: { refreshPreferences?: boolean }
  ) {
    return this.withClient(client, async (dbClient) => {
      const profileId = await this.findProfileId(userId, dbClient);

      await this.syncUserProfileCategoryValues(userId, dbClient);
      if (options?.refreshPreferences !== false) {
        await rebuildDiscoveryProjectionsForActor(dbClient, profileId);
      }

      const { targets } = await this.buildGoalTargets(userId, dbClient);
      await this.persistGoalTargets(userId, targets, dbClient);
      await this.syncAssignedTasks(userId, targets, dbClient);
      const progress = await this.rebuildUserProgress(userId, dbClient);

      const lastSourceResult = await dbClient.query<{ id: number | null }>(
        `SELECT id
         FROM discovery.profile_interactions
         WHERE actor_profile_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [profileId]
      );

      await dbClient.query(
        `INSERT INTO goals.user_goal_projection_meta
          (user_id, last_source_event_id, last_recomputed_at, last_rule_version, rebuild_status)
         VALUES ($1, $2, NOW(), 1, 'ready')
         ON CONFLICT (user_id) DO UPDATE SET
           last_source_event_id = EXCLUDED.last_source_event_id,
           last_recomputed_at = NOW(),
           last_rule_version = 1,
           rebuild_status = 'ready'`,
        [userId, lastSourceResult.rows[0]?.id ?? null]
      );

      return {
        userId,
        targetsRebuilt: targets.length,
        completionPercent: progress.completionPercent,
      };
    });
  }

  async rebuildAllUserGoalTargets(client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const users = await dbClient.query<{ id: number }>(
        `SELECT id FROM auth.users WHERE status = 'active' ORDER BY id ASC`
      );

      for (const user of users.rows) {
        await this.rebuildUserGoalTargets(user.id, dbClient, {
          refreshPreferences: true,
        });
      }

      return { rebuiltUsers: users.rows.length };
    });
  }

  async seedUserGoalTasks(userId: number, client?: DbClient) {
    await this.withClient(client, async (dbClient) => {
      await this.rebuildUserGoalTargets(userId, dbClient, {
        refreshPreferences: true,
      });
    });
  }

  async rebuildUserProgress(userId: number, client?: DbClient) {
    return this.withClient(client, async (dbClient) => {
      const categoriesResult = await dbClient.query<{ code: GoalCategoryCode }>(
        `SELECT code
         FROM catalog.goal_categories
         WHERE is_active = true
         ORDER BY sort_order ASC, code ASC`
      );
      const tasksResult = await dbClient.query<GoalTaskRow>(
        `SELECT id, template_id, category_code, sort_order, status, is_active, target_value_key, rule_key, task_template_group_key, projection_version
         FROM goals.user_goal_tasks
         WHERE user_id = $1
           AND is_active = true
         ORDER BY category_code ASC, sort_order ASC, id ASC`,
        [userId]
      );

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
    if (!client) {
      return this.cacheService.getOrSet(
        cacheKeys.goals(userId),
        CACHE_TTL_SECONDS.goals,
        () => this.loadUserGoals(userId)
      );
    }
    return this.loadUserGoals(userId, client);
  }

  private async loadUserGoals(userId: number, client?: DbClient) {
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
           AND ugt.is_active = true
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
             AND ugt.is_active = true
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
        await this.invalidateUserGoalCaches(userId);
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
             AND ugt.is_active = true
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
             AND category_code = $2
             AND is_active = true`,
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
               AND ugt.is_active = true
               AND gtt.goal_key = $4`,
            [userId, categoryCode, index, goalKey]
          );
        }

        await this.rebuildUserProgress(userId, dbClient);
        const nextGoals = await this.getUserGoals(userId, dbClient);
        await dbClient.query("COMMIT");
        await this.invalidateUserGoalCaches(userId);
        return nextGoals;
      } catch (error) {
        await dbClient.query("ROLLBACK");
        throw error;
      }
    });
  }

  private async invalidateUserGoalCaches(userId: number) {
    await Promise.all([
      this.cacheService.delete(cacheKeys.goals(userId)),
      this.cacheService.delete(cacheKeys.viewerBootstrap(userId)),
      this.cacheService.delete(cacheKeys.discoveryPreferences(userId)),
      this.cacheService.deleteByPrefix(cacheKeys.adminPrefix()),
    ]);
  }
}
