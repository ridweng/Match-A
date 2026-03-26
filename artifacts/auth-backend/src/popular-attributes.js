export const POPULAR_ATTRIBUTE_CATEGORIES = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

function normalizeValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function createEmptyPopularAttributesByCategory() {
  return POPULAR_ATTRIBUTE_CATEGORIES.reduce((acc, category) => {
    acc[category] = {
      category,
      valueKey: null,
      count: 0,
      totalLikesConsidered: 0,
      lastChangedAtLikeCount: 0,
    };
    return acc;
  }, {});
}

export function normalizePopularAttributeInput(input) {
  return {
    physical: normalizeValue(input?.physical),
    personality: normalizeValue(input?.personality),
    family: normalizeValue(input?.family),
    expectations: normalizeValue(input?.expectations),
    language: normalizeValue(input?.language),
    studies: normalizeValue(input?.studies),
  };
}

export function calculatePopularAttributesFromLikes(likes) {
  const snapshots = createEmptyPopularAttributesByCategory();
  const countsByCategory = new Map();

  POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
    countsByCategory.set(category, new Map());
  });

  likes.forEach((like, index) => {
    const likeNumber = index + 1;

    POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
      const valueKey = normalizeValue(like?.categoryValues?.[category]);
      if (!valueKey) {
        return;
      }

      const counts = countsByCategory.get(category);
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

export function diffPopularAttributeSnapshots(previous, next) {
  return POPULAR_ATTRIBUTE_CATEGORIES.flatMap((category) => {
    const before = previous?.[category] || createEmptyPopularAttributesByCategory()[category];
    const after = next?.[category] || createEmptyPopularAttributesByCategory()[category];
    if (!after.valueKey || before.valueKey === after.valueKey) {
      return [];
    }

    return [
      {
        category,
        previousValueKey: before.valueKey,
        nextValueKey: after.valueKey,
      },
    ];
  });
}

export function sanitizePopularAttributesByCategory(input) {
  const empty = createEmptyPopularAttributesByCategory();

  POPULAR_ATTRIBUTE_CATEGORIES.forEach((category) => {
    const source = input?.[category];
    empty[category] = {
      category,
      valueKey: normalizeValue(source?.valueKey),
      count: Number(source?.count) > 0 ? Number(source.count) : 0,
      totalLikesConsidered:
        Number(source?.totalLikesConsidered) > 0
          ? Number(source.totalLikesConsidered)
          : 0,
      lastChangedAtLikeCount:
        Number(source?.lastChangedAtLikeCount) > 0
          ? Number(source.lastChangedAtLikeCount)
          : 0,
    };
  });

  return empty;
}
