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
      return await getDiscoveryPreferencesForActor(client, actorProfileId);
    } finally {
      client.release();
    }
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
    };
  }
}
