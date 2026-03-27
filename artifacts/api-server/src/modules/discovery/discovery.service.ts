import { Injectable } from "@nestjs/common";
import { pool } from "@workspace/db";
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

@Injectable()
export class DiscoveryService {
  private defaultFilters() {
    return {
      selectedGenders: [] as Array<"male" | "female" | "non_binary" | "fluid">,
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

  async getPreferences(userId: number) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();
    try {
      const preferences = await getDiscoveryPreferencesForActor(client, actorProfileId);
      const filtersResult = await client.query<{
        selected_genders: string[] | null;
        therian_mode: "exclude" | "include" | "only" | null;
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
      return {
        ...preferences,
        filters: filters
          ? {
              selectedGenders: Array.isArray(filters.selected_genders)
                ? (filters.selected_genders.filter(Boolean) as Array<
                    "male" | "female" | "non_binary" | "fluid"
                  >)
                : [],
              therianMode: filters.therian_mode || "exclude",
              ageMin: Number(filters.age_min) || 18,
              ageMax: Number(filters.age_max) || 40,
            }
          : this.defaultFilters(),
      };
    } finally {
      client.release();
    }
  }

  async updatePreferences(
    userId: number,
    filters: {
      selectedGenders: Array<"male" | "female" | "non_binary" | "fluid">;
      therianMode: "exclude" | "include" | "only";
      ageMin: number;
      ageMax: number;
    }
  ) {
    const actorProfileId = await this.findActorProfileId(userId);
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

    return this.getPreferences(userId);
  }

  async likeProfile(
    userId: number,
    payload: {
      likedProfileId: string;
      categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
    }
  ) {
    const actorProfileId = await this.findActorProfileId(userId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const previous = await getDiscoveryPreferencesForActor(client, actorProfileId);
      const normalizedCategoryValues = normalizePopularAttributeInput(payload.categoryValues);

      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO discovery.profile_interactions
          (actor_profile_id, target_profile_public_id, interaction_type, category_values_json)
         VALUES ($1, $2, 'like', $3::jsonb)
         ON CONFLICT (actor_profile_id, target_profile_public_id, interaction_type)
         DO NOTHING
         RETURNING id`,
        [
          actorProfileId,
          payload.likedProfileId,
          JSON.stringify(normalizedCategoryValues),
        ]
      );

      if (!insertResult.rows[0]?.id) {
        await client.query("COMMIT");
        return {
          likedProfileIds: previous.likedProfileIds,
          popularAttributesByCategory: previous.popularAttributesByCategory,
          totalLikesCount: previous.totalLikesCount,
          lastNotifiedPopularModeChangeAtLikeCount:
            previous.lastNotifiedPopularModeChangeAtLikeCount,
          changedCategories: [],
          shouldShowDiscoveryUpdate: false,
        };
      }

      const rebuilt = await rebuildDiscoveryProjectionsForActor(client, actorProfileId);
      const changedCategories = diffPopularAttributeSnapshots(
        previous.popularAttributesByCategory,
        rebuilt.popularAttributesByCategory
      );
      const shouldShowDiscoveryUpdate =
        rebuilt.totalLikesCount >= 30 && changedCategories.length > 0;

      await client.query("COMMIT");

      return {
        likedProfileIds: rebuilt.likedProfileIds,
        popularAttributesByCategory: rebuilt.popularAttributesByCategory,
        totalLikesCount: rebuilt.totalLikesCount,
        lastNotifiedPopularModeChangeAtLikeCount:
          rebuilt.lastNotifiedPopularModeChangeAtLikeCount,
        changedCategories,
        shouldShowDiscoveryUpdate,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  getEmptyPreferences() {
    return {
      likedProfileIds: [],
      likedProfiles: [],
      popularAttributesByCategory: createEmptyPopularAttributesByCategory(),
      totalLikesCount: 0,
      lastNotifiedPopularModeChangeAtLikeCount: 0,
      filters: this.defaultFilters(),
    };
  }
}
