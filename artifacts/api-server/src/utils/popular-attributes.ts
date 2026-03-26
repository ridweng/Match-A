export const POPULAR_ATTRIBUTE_CATEGORIES = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
] as const;

export type PopularAttributeCategory =
  (typeof POPULAR_ATTRIBUTE_CATEGORIES)[number];

export type PopularAttributeSnapshot = {
  category: PopularAttributeCategory;
  valueKey: string | null;
  count: number;
  totalLikesConsidered: number;
  lastChangedAtLikeCount: number;
};

export type PopularAttributesByCategory = Record<
  PopularAttributeCategory,
  PopularAttributeSnapshot
>;

export type PopularAttributeChange = {
  category: PopularAttributeCategory;
  previousValueKey: string | null;
  nextValueKey: string;
};

export type PopularLikeEvent = {
  likedProfileId: string;
  categoryValues: Record<PopularAttributeCategory, string | null>;
};

function normalizeValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function createEmptyPopularAttributesByCategory(): PopularAttributesByCategory {
  return POPULAR_ATTRIBUTE_CATEGORIES.reduce((acc, category) => {
    acc[category] = {
      category,
      valueKey: null,
      count: 0,
      totalLikesConsidered: 0,
      lastChangedAtLikeCount: 0,
    };
    return acc;
  }, {} as PopularAttributesByCategory);
}

export function normalizePopularAttributeInput(
  input: Partial<Record<PopularAttributeCategory, string | null>> | null | undefined
) {
  return {
    physical: normalizeValue(input?.physical),
    personality: normalizeValue(input?.personality),
    family: normalizeValue(input?.family),
    expectations: normalizeValue(input?.expectations),
    language: normalizeValue(input?.language),
    studies: normalizeValue(input?.studies),
  } satisfies Record<PopularAttributeCategory, string | null>;
}

export function sanitizePopularAttributesByCategory(input: unknown) {
  const empty = createEmptyPopularAttributesByCategory();
  const source = (input || {}) as Record<string, Partial<PopularAttributeSnapshot>>;

  POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
    const item = source[category];
    empty[category] = {
      category,
      valueKey: normalizeValue(item?.valueKey),
      count: Number(item?.count) > 0 ? Number(item?.count) : 0,
      totalLikesConsidered:
        Number(item?.totalLikesConsidered) > 0
          ? Number(item?.totalLikesConsidered)
          : 0,
      lastChangedAtLikeCount:
        Number(item?.lastChangedAtLikeCount) > 0
          ? Number(item?.lastChangedAtLikeCount)
          : 0,
    };
  });

  return empty;
}

export function calculatePopularAttributesFromLikes(
  likes: PopularLikeEvent[]
): PopularAttributesByCategory {
  const snapshots = createEmptyPopularAttributesByCategory();
  const countsByCategory = new Map<
    PopularAttributeCategory,
    Map<string, number>
  >();

  POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
    countsByCategory.set(category, new Map<string, number>());
  });

  likes.forEach((like, index) => {
    const likeNumber = index + 1;

    POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
      const valueKey = normalizeValue(like.categoryValues[category]);
      if (!valueKey) {
        return;
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
        return;
      }

      if (current.valueKey === valueKey) {
        snapshots[category] = {
          ...current,
          count: nextCount,
          totalLikesConsidered,
        };
        return;
      }

      if (nextCount > current.count) {
        snapshots[category] = {
          category,
          valueKey,
          count: nextCount,
          totalLikesConsidered,
          lastChangedAtLikeCount: likeNumber,
        };
        return;
      }

      snapshots[category] = {
        ...current,
        totalLikesConsidered,
      };
    });
  });

  return snapshots;
}

export function diffPopularAttributeSnapshots(
  previous: PopularAttributesByCategory,
  next: PopularAttributesByCategory
) {
  return POPULAR_ATTRIBUTE_CATEGORIES.flatMap((category) => {
    const before = previous[category];
    const after = next[category];
    if (!after.valueKey || before.valueKey === after.valueKey) {
      return [];
    }

    return [
      {
        category,
        previousValueKey: before.valueKey,
        nextValueKey: after.valueKey,
      } satisfies PopularAttributeChange,
    ];
  });
}
