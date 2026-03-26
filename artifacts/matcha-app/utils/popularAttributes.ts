import {
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getRelationshipGoalLabel,
  getSpokenLanguageLabel,
} from "@/constants/profile-options";
import type { GoalCategory } from "@/context/AppContext";

export type PopularAttributeCategory = GoalCategory;

export type PopularAttributeInputByCategory = Record<
  PopularAttributeCategory,
  string | null
>;

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
  categoryValues: PopularAttributeInputByCategory;
};

const POPULAR_ATTRIBUTE_CATEGORIES: PopularAttributeCategory[] = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

function normalizeValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
  input: Partial<PopularAttributeInputByCategory> | null | undefined
): PopularAttributeInputByCategory {
  return {
    physical: normalizeValue(input?.physical),
    personality: normalizeValue(input?.personality),
    family: normalizeValue(input?.family),
    expectations: normalizeValue(input?.expectations),
    language: normalizeValue(input?.language),
    studies: normalizeValue(input?.studies),
  };
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
): PopularAttributeChange[] {
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
      },
    ];
  });
}

export function formatPopularAttributeValue(
  category: PopularAttributeCategory,
  valueKey: string | null | undefined,
  options: {
    t: (es: string, en: string) => string;
    language: "es" | "en";
    insightLookup?: Map<string, { es: string; en: string }>;
    emptyLabel: string;
  }
) {
  if (!valueKey) {
    return options.emptyLabel;
  }

  switch (category) {
    case "physical":
      return getBodyTypeLabel(valueKey, options.t) || options.emptyLabel;
    case "family":
      return getChildrenPreferenceLabel(valueKey, options.t) || options.emptyLabel;
    case "expectations":
      return getRelationshipGoalLabel(valueKey, options.t) || options.emptyLabel;
    case "language":
      return getSpokenLanguageLabel(valueKey, options.language) || options.emptyLabel;
    case "studies":
      return getEducationLabel(valueKey, options.t) || options.emptyLabel;
    case "personality": {
      const localized = options.insightLookup?.get(valueKey);
      return localized ? options.t(localized.es, localized.en) : valueKey;
    }
    default:
      return valueKey;
  }
}

export function getPopularAttributeCategories() {
  return [...POPULAR_ATTRIBUTE_CATEGORIES];
}
