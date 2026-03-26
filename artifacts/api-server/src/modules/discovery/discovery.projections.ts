import {
  POPULAR_ATTRIBUTE_CATEGORIES,
  createEmptyPopularAttributesByCategory,
  normalizePopularAttributeInput,
  sanitizePopularAttributesByCategory,
  type PopularAttributeCategory,
  type PopularAttributeChange,
  type PopularAttributesByCategory,
} from "../../utils/popular-attributes";

import { pool } from "@workspace/db";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type InteractionRow = {
  id: number;
  target_profile_public_id: string;
  category_values_json: Record<string, string | null> | null;
};

type ModeRow = {
  category_code: string;
  current_value_key: string | null;
  current_count: number | null;
  total_likes_considered: number | null;
  last_changed_at_like_count: number | null;
};

export async function getDiscoveryPreferencesForActor(
  client: DbClient,
  actorProfileId: number
) {
  const [likedProfilesResult, modesResult, lastNotifiedResult] = await Promise.all([
    client.query<{ target_profile_public_id: string }>(
      `SELECT target_profile_public_id
       FROM discovery.profile_interactions
       WHERE actor_profile_id = $1 AND interaction_type = 'like'
       ORDER BY created_at ASC, id ASC`,
      [actorProfileId]
    ),
    client.query<ModeRow>(
      `SELECT category_code, current_value_key, current_count, total_likes_considered, last_changed_at_like_count
       FROM discovery.popular_attribute_modes
       WHERE actor_profile_id = $1`,
      [actorProfileId]
    ),
    client.query<{ like_count_at_event: number | null }>(
      `SELECT MAX(like_count_at_event) AS like_count_at_event
       FROM discovery.discovery_change_messages
       WHERE actor_profile_id = $1`,
      [actorProfileId]
    ),
  ]);

  const snapshots = createEmptyPopularAttributesByCategory();
  for (const row of modesResult.rows as ModeRow[]) {
    const category = row.category_code as PopularAttributeCategory;
    if (!POPULAR_ATTRIBUTE_CATEGORIES.includes(category)) {
      continue;
    }
    snapshots[category] = {
      category,
      valueKey: row.current_value_key,
      count: Number(row.current_count) || 0,
      totalLikesConsidered: Number(row.total_likes_considered) || 0,
      lastChangedAtLikeCount: Number(row.last_changed_at_like_count) || 0,
    };
  }

  return {
    likedProfileIds: likedProfilesResult.rows.map((row) => row.target_profile_public_id),
    popularAttributesByCategory: sanitizePopularAttributesByCategory(snapshots),
    totalLikesCount: likedProfilesResult.rows.length,
    lastNotifiedPopularModeChangeAtLikeCount:
      Number(lastNotifiedResult.rows[0]?.like_count_at_event) || 0,
  };
}

export async function rebuildDiscoveryProjectionsForActor(
  client: DbClient,
  actorProfileId: number
) {
  const interactionsResult = await client.query<InteractionRow>(
    `SELECT id, target_profile_public_id, category_values_json
     FROM discovery.profile_interactions
     WHERE actor_profile_id = $1 AND interaction_type = 'like'
     ORDER BY created_at ASC, id ASC`,
    [actorProfileId]
  );

  const likes = interactionsResult.rows.map((row: InteractionRow) => ({
    interactionId: row.id,
    likedProfileId: row.target_profile_public_id,
    categoryValues: normalizePopularAttributeInput(row.category_values_json || {}),
  }));

  const countsByCategory = new Map<
    PopularAttributeCategory,
    Map<string, number>
  >();
  const snapshots = createEmptyPopularAttributesByCategory();
  const messages: Array<{
    interactionId: number;
    likeCountAtEvent: number;
    payload: { changedCategories: PopularAttributeChange[] };
  }> = [];

  for (const category of POPULAR_ATTRIBUTE_CATEGORIES) {
    countsByCategory.set(category, new Map<string, number>());
  }

  likes.forEach((like: (typeof likes)[number], index: number) => {
    const likeNumber = index + 1;
    const changedCategories: PopularAttributeChange[] = [];

    for (const category of POPULAR_ATTRIBUTE_CATEGORIES) {
      const valueKey = like.categoryValues[category];
      if (!valueKey) {
        continue;
      }

      const counts = countsByCategory.get(category)!;
      const nextCount = (counts.get(valueKey) || 0) + 1;
      counts.set(valueKey, nextCount);

      const current = snapshots[category];
      const totalLikesConsidered = current.totalLikesConsidered + 1;

      if (!current.valueKey) {
        snapshots[category] = {
          category,
          valueKey,
          count: nextCount,
          totalLikesConsidered,
          lastChangedAtLikeCount: likeNumber,
        };
        changedCategories.push({
          category,
          previousValueKey: null,
          nextValueKey: valueKey,
        });
        continue;
      }

      if (current.valueKey === valueKey) {
        snapshots[category] = {
          ...current,
          count: nextCount,
          totalLikesConsidered,
        };
        continue;
      }

      if (nextCount > current.count) {
        snapshots[category] = {
          category,
          valueKey,
          count: nextCount,
          totalLikesConsidered,
          lastChangedAtLikeCount: likeNumber,
        };
        changedCategories.push({
          category,
          previousValueKey: current.valueKey,
          nextValueKey: valueKey,
        });
        continue;
      }

      snapshots[category] = {
        ...current,
        totalLikesConsidered,
      };
    }

    if (likeNumber >= 30 && changedCategories.length > 0) {
      messages.push({
        interactionId: like.interactionId,
        likeCountAtEvent: likeNumber,
        payload: { changedCategories },
      });
    }
  });

  await client.query(
    `DELETE FROM discovery.discovery_change_messages WHERE actor_profile_id = $1`,
    [actorProfileId]
  );
  await client.query(
    `DELETE FROM discovery.popular_attribute_counts WHERE actor_profile_id = $1`,
    [actorProfileId]
  );
  await client.query(
    `DELETE FROM discovery.popular_attribute_modes WHERE actor_profile_id = $1`,
    [actorProfileId]
  );

  for (const category of POPULAR_ATTRIBUTE_CATEGORIES) {
    const counts = countsByCategory.get(category)!;
    for (const [valueKey, likeCount] of counts.entries()) {
      await client.query(
        `INSERT INTO discovery.popular_attribute_counts
          (actor_profile_id, category_code, value_key, like_count, computed_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [actorProfileId, category, valueKey, likeCount]
      );
    }

    const snapshot = snapshots[category];
    const interactionId =
      likes[snapshot.lastChangedAtLikeCount - 1]?.interactionId ?? null;
    await client.query(
      `INSERT INTO discovery.popular_attribute_modes
        (actor_profile_id, category_code, current_value_key, current_count, total_likes_considered, last_changed_at_interaction_id, last_changed_at_like_count, computed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        actorProfileId,
        category,
        snapshot.valueKey,
        snapshot.count,
        snapshot.totalLikesConsidered,
        interactionId,
        snapshot.lastChangedAtLikeCount,
      ]
    );
  }

  for (const message of messages) {
    await client.query(
      `INSERT INTO discovery.discovery_change_messages
        (actor_profile_id, interaction_id, message_type, like_count_at_event, payload, computed_at, created_at)
       VALUES ($1, $2, 'popular_mode_changed', $3, $4::jsonb, NOW(), NOW())`,
      [
        actorProfileId,
        message.interactionId,
        message.likeCountAtEvent,
        JSON.stringify(message.payload),
      ]
    );
  }

  return {
    likedProfileIds: likes.map((like: (typeof likes)[number]) => like.likedProfileId),
    popularAttributesByCategory: snapshots as PopularAttributesByCategory,
    totalLikesCount: likes.length,
    lastNotifiedPopularModeChangeAtLikeCount:
      messages[messages.length - 1]?.likeCountAtEvent || 0,
  };
}
