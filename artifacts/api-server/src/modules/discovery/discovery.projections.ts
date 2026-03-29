import {
  POPULAR_ATTRIBUTE_CATEGORIES,
  createEmptyPopularAttributesByCategory,
  normalizePopularAttributeInput,
  sanitizePopularAttributesByCategory,
  type PopularAttributeCategory,
  type PopularAttributeChange,
  type PopularAttributesByCategory,
} from "../../utils/popular-attributes";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type InteractionRow = {
  id: number;
  target_profile_id: number | null;
  target_profile_public_id: string;
  interaction_type: "like" | "pass";
  category_values_json: Record<string, string | null> | null;
  created_at: string | Date;
};

type ModeRow = {
  category_code: string;
  current_value_key: string | null;
  current_count: number | null;
  total_likes_considered: number | null;
  last_changed_at_like_count: number | null;
};

type CategoryValueRow = {
  profile_id: number;
  category_code: PopularAttributeCategory;
  value_key: string;
};

type DecisionRecord = {
  targetProfileId: number | null;
  targetProfilePublicId: string;
  currentState: "like" | "pass";
  firstEventId: number;
  latestEventId: number;
  latestCreatedAt: string | Date;
  categoryValues: Record<PopularAttributeCategory, string | null>;
};

type ThresholdRow = {
  total_likes: number | null;
  total_passes: number | null;
  likes_until_unlock: number | null;
  threshold_reached: boolean | null;
  threshold_reached_at: string | Date | null;
  last_decision_event_at: string | Date | null;
  last_decision_interaction_id: number | null;
};

export async function getDiscoveryPreferencesForActor(
  client: DbClient,
  actorProfileId: number
) {
  const decisionsResult = await client.query<{
    target_profile_id: number | null;
    current_state: "like" | "pass";
  }>(
    `SELECT target_profile_id, current_state
     FROM discovery.profile_decisions
     WHERE actor_profile_id = $1
     ORDER BY decided_at ASC, latest_event_id ASC`,
    [actorProfileId]
  );
  const modesResult = await client.query<ModeRow>(
    `SELECT category_code, current_value_key, current_count, total_likes_considered, last_changed_at_like_count
     FROM discovery.popular_attribute_modes
     WHERE actor_profile_id = $1`,
    [actorProfileId]
  );
  const lastNotifiedResult = await client.query<{ like_count_at_event: number | null }>(
    `SELECT MAX(like_count_at_event) AS like_count_at_event
     FROM discovery.discovery_change_messages
     WHERE actor_profile_id = $1`,
    [actorProfileId]
  );
  const thresholdResult = await client.query<ThresholdRow>(
    `SELECT
       total_likes,
       total_passes,
       likes_until_unlock,
       threshold_reached,
       threshold_reached_at,
       last_decision_event_at,
       last_decision_interaction_id
     FROM discovery.profile_preference_thresholds
     WHERE actor_profile_id = $1
     LIMIT 1`,
    [actorProfileId]
  );

  const likedProfileIds = decisionsResult.rows
    .filter((row) => row.current_state === "like" && Number(row.target_profile_id) > 0)
    .map((row) => Number(row.target_profile_id));
  const passedProfileIds = decisionsResult.rows
    .filter((row) => row.current_state === "pass" && Number(row.target_profile_id) > 0)
    .map((row) => Number(row.target_profile_id));

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

  const threshold = thresholdResult.rows[0];

  return {
    likedProfileIds,
    passedProfileIds,
    currentDecisionCounts: {
      likes: likedProfileIds.length,
      passes: passedProfileIds.length,
    },
    popularAttributesByCategory: sanitizePopularAttributesByCategory(snapshots),
    totalLikesCount: Number(threshold?.total_likes) || 0,
    lifetimeCounts: {
      likes: Number(threshold?.total_likes) || 0,
      passes: Number(threshold?.total_passes) || 0,
    },
    threshold: {
      likeThreshold: 30,
      totalLikes: Number(threshold?.total_likes) || 0,
      totalPasses: Number(threshold?.total_passes) || 0,
      likesUntilUnlock:
        threshold?.likes_until_unlock == null ? 30 : Number(threshold.likes_until_unlock),
      thresholdReached: Boolean(threshold?.threshold_reached),
      thresholdReachedAt: threshold?.threshold_reached_at
        ? toIsoDate(threshold.threshold_reached_at)
        : null,
      lastDecisionEventAt: threshold?.last_decision_event_at
        ? toIsoDate(threshold.last_decision_event_at)
        : null,
      lastDecisionInteractionId: Number(threshold?.last_decision_interaction_id) || null,
    },
    lastNotifiedPopularModeChangeAtLikeCount:
      Number(lastNotifiedResult.rows[0]?.like_count_at_event) || 0,
  };
}

function toIsoDate(input: string | Date) {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}

function compareByCreatedAt(a: DecisionRecord, b: DecisionRecord) {
  const dateDelta =
    new Date(toIsoDate(a.latestCreatedAt)).getTime() -
    new Date(toIsoDate(b.latestCreatedAt)).getTime();
  if (dateDelta !== 0) {
    return dateDelta;
  }
  return a.latestEventId - b.latestEventId;
}

export async function rebuildDiscoveryProjectionsForActor(
  client: DbClient,
  actorProfileId: number
) {
  const interactionsResult = await client.query<InteractionRow>(
    `SELECT
       id,
       target_profile_id,
       target_profile_public_id,
       interaction_type,
       category_values_json,
       created_at
     FROM discovery.profile_interactions
     WHERE actor_profile_id = $1
     ORDER BY created_at ASC, id ASC`,
    [actorProfileId]
  );
  const decisionsByTarget = new Map<string, DecisionRecord>();

  for (const row of interactionsResult.rows) {
    const current = decisionsByTarget.get(row.target_profile_public_id);
    const normalizedCategoryValues = normalizePopularAttributeInput(row.category_values_json || {});

    if (!current) {
      decisionsByTarget.set(row.target_profile_public_id, {
        targetProfileId: row.target_profile_id,
        targetProfilePublicId: row.target_profile_public_id,
        currentState: row.interaction_type,
        firstEventId: row.id,
        latestEventId: row.id,
        latestCreatedAt: row.created_at,
        categoryValues: normalizedCategoryValues,
      });
    } else {
      decisionsByTarget.set(row.target_profile_public_id, {
        ...current,
        targetProfileId: row.target_profile_id ?? current.targetProfileId,
        currentState: row.interaction_type,
        latestEventId: row.id,
        latestCreatedAt: row.created_at,
        categoryValues: normalizedCategoryValues,
      });
    }
  }

  const decisions = Array.from(decisionsByTarget.values()).sort(compareByCreatedAt);
  const likedDecisions = decisions.filter((decision) => decision.currentState === "like");
  const passedDecisions = decisions.filter((decision) => decision.currentState === "pass");
  const lifetimeLikeInteractions = interactionsResult.rows.filter(
    (interaction) => interaction.interaction_type === "like"
  );
  const lifetimePassInteractions = interactionsResult.rows.filter(
    (interaction) => interaction.interaction_type === "pass"
  );

  const targetProfileIds = likedDecisions
    .map((decision) => decision.targetProfileId)
    .filter((value): value is number => Number.isFinite(Number(value)) && Number(value) > 0);

  const profileValuesResult =
    targetProfileIds.length > 0
      ? await client.query<CategoryValueRow>(
          `SELECT profile_id, category_code, value_key
           FROM core.profile_category_values
           WHERE profile_id = ANY($1::bigint[])`,
          [targetProfileIds]
        )
      : { rows: [] as CategoryValueRow[] };

  const profileValuesByProfile = new Map<number, Record<PopularAttributeCategory, string | null>>();
  for (const row of profileValuesResult.rows) {
    const existing =
      profileValuesByProfile.get(row.profile_id) || normalizePopularAttributeInput(null);
    existing[row.category_code] = row.value_key;
    profileValuesByProfile.set(row.profile_id, existing);
  }

  const likes = likedDecisions.map((decision) => ({
    interactionId: decision.latestEventId,
    likedProfileId: decision.targetProfileId,
    categoryValues:
      (decision.targetProfileId &&
        profileValuesByProfile.get(decision.targetProfileId)) ||
      decision.categoryValues,
    createdAt: decision.latestCreatedAt,
  }));

  const countsByCategory = new Map<PopularAttributeCategory, Map<string, number>>();
  const snapshots = createEmptyPopularAttributesByCategory();
  const messages: Array<{
    interactionId: number;
    likeCountAtEvent: number;
    payload: { changedCategories: PopularAttributeChange[] };
  }> = [];

  for (const category of POPULAR_ATTRIBUTE_CATEGORIES) {
    countsByCategory.set(category, new Map<string, number>());
  }

  likes.forEach((like, index) => {
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

  await client.query(`DELETE FROM discovery.discovery_change_messages WHERE actor_profile_id = $1`, [
    actorProfileId,
  ]);
  await client.query(`DELETE FROM discovery.popular_attribute_counts WHERE actor_profile_id = $1`, [
    actorProfileId,
  ]);
  await client.query(`DELETE FROM discovery.popular_attribute_modes WHERE actor_profile_id = $1`, [
    actorProfileId,
  ]);
  await client.query(
    `DELETE FROM discovery.profile_preference_thresholds WHERE actor_profile_id = $1`,
    [actorProfileId]
  );
  await client.query(`DELETE FROM discovery.profile_decisions WHERE actor_profile_id = $1`, [
    actorProfileId,
  ]);

  for (const decision of decisions) {
    await client.query(
      `INSERT INTO discovery.profile_decisions
        (actor_profile_id, target_profile_id, target_profile_public_id, current_state, first_event_id, latest_event_id, decided_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        actorProfileId,
        decision.targetProfileId,
        decision.targetProfilePublicId,
        decision.currentState,
        decision.firstEventId,
        decision.latestEventId,
        decision.latestCreatedAt,
      ]
    );
  }

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
    const interactionId = likes[snapshot.lastChangedAtLikeCount - 1]?.interactionId ?? null;
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

  const thresholdReachedAt =
    lifetimeLikeInteractions.length >= 30
      ? lifetimeLikeInteractions[29]?.created_at ?? null
      : null;
  const lastDecision = interactionsResult.rows[interactionsResult.rows.length - 1] || null;

  await client.query(
    `INSERT INTO discovery.profile_preference_thresholds
      (actor_profile_id, total_likes, total_passes, likes_until_unlock, threshold_reached, threshold_reached_at, last_decision_event_at, last_decision_interaction_id, mode_unlocked_at, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      actorProfileId,
      lifetimeLikeInteractions.length,
      lifetimePassInteractions.length,
      Math.max(0, 30 - lifetimeLikeInteractions.length),
      lifetimeLikeInteractions.length >= 30,
      thresholdReachedAt,
      lastDecision?.created_at ?? null,
      lastDecision?.id ?? null,
      thresholdReachedAt,
    ]
  );

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
    likedProfileIds: likedDecisions
      .map((decision) => Number(decision.targetProfileId))
      .filter((value) => Number.isFinite(value) && value > 0),
    passedProfileIds: passedDecisions
      .map((decision) => Number(decision.targetProfileId))
      .filter((value) => Number.isFinite(value) && value > 0),
    currentDecisionCounts: {
      likes: likedDecisions.length,
      passes: passedDecisions.length,
    },
    popularAttributesByCategory: snapshots as PopularAttributesByCategory,
    totalLikesCount: lifetimeLikeInteractions.length,
    totalPassesCount: lifetimePassInteractions.length,
    lifetimeCounts: {
      likes: lifetimeLikeInteractions.length,
      passes: lifetimePassInteractions.length,
    },
    threshold: {
      likeThreshold: 30,
      totalLikes: lifetimeLikeInteractions.length,
      totalPasses: lifetimePassInteractions.length,
      likesUntilUnlock: Math.max(0, 30 - lifetimeLikeInteractions.length),
      thresholdReached: lifetimeLikeInteractions.length >= 30,
      thresholdReachedAt: thresholdReachedAt ? toIsoDate(thresholdReachedAt) : null,
      lastDecisionEventAt: lastDecision?.created_at ? toIsoDate(lastDecision.created_at) : null,
      lastDecisionInteractionId: lastDecision?.id ?? null,
    },
    lastNotifiedPopularModeChangeAtLikeCount:
      messages[messages.length - 1]?.likeCountAtEvent || 0,
  };
}
