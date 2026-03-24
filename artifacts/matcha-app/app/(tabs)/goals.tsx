import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getHairColorLabel,
  getPersonalityLabel,
  getRelationshipGoalLabel,
  getSpokenLanguageLabel,
} from "@/constants/profile-options";
import { useApp } from "@/context/AppContext";
import { discoverProfiles } from "@/data/profiles";

type GoalsFilter = "all" | "physical" | "personality" | "family" | "expectations" | "language" | "studies";
type RealGoalsCategory = Exclude<GoalsFilter, "all">;
type FeatherName = React.ComponentProps<typeof Feather>["name"];

type CategoryDescriptor = {
  key: GoalsFilter;
  labelEs: string;
  labelEn: string;
  icon: FeatherName;
  color: string;
  summaryEs: string;
  summaryEn: string;
};

type CategoryInsight = {
  key: RealGoalsCategory;
  label: string;
  summary: string;
  icon: FeatherName;
  color: string;
  userValue: string;
  popularValue: string;
  hasUserValue: boolean;
};

const CATEGORY_CONFIG: Record<GoalsFilter, CategoryDescriptor> = {
  all: {
    key: "all",
    labelEs: "Todas",
    labelEn: "All",
    icon: "grid",
    color: Colors.primaryLight,
    summaryEs: "Ver todas las categorías",
    summaryEn: "See every category",
  },
  physical: {
    key: "physical",
    labelEs: "Físicas",
    labelEn: "Physical",
    icon: "activity",
    color: "#74C0FC",
    summaryEs: "Cuerpo y presencia",
    summaryEn: "Body and presence",
  },
  personality: {
    key: "personality",
    labelEs: "Personalidad",
    labelEn: "Personality",
    icon: "smile",
    color: Colors.accent,
    summaryEs: "Tu energía personal",
    summaryEn: "Your personal energy",
  },
  family: {
    key: "family",
    labelEs: "Familia",
    labelEn: "Family",
    icon: "users",
    color: "#FFB86B",
    summaryEs: "Planes familiares",
    summaryEn: "Family plans",
  },
  expectations: {
    key: "expectations",
    labelEs: "Expectativas",
    labelEn: "Expectations",
    icon: "target",
    color: "#B794F4",
    summaryEs: "Lo que buscas construir",
    summaryEn: "What you want to build",
  },
  language: {
    key: "language",
    labelEs: "Idioma",
    labelEn: "Language",
    icon: "globe",
    color: "#63E6BE",
    summaryEs: "Cómo te comunicas",
    summaryEn: "How you connect",
  },
  studies: {
    key: "studies",
    labelEs: "Estudios",
    labelEn: "Studies",
    icon: "book-open",
    color: "#FF8787",
    summaryEs: "Tu formación",
    summaryEn: "Your educational background",
  },
};

const REAL_CATEGORIES: RealGoalsCategory[] = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${progress}%` as const, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function buildAverageMap(values: string[]) {
  const filtered = values.map((value) => value?.trim()).filter(Boolean) as string[];
  const counts = new Map<string, number>();

  for (const value of filtered) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const total = filtered.length || 1;
  const averages = new Map<string, number>();
  counts.forEach((count, key) => {
    averages.set(key, count / total);
  });

  return averages;
}

function getCombinedTopValues(allValues: string[], likedValues: string[], limit = 1) {
  const allAverage = buildAverageMap(allValues);
  const interactionAverage = likedValues.length
    ? buildAverageMap(likedValues)
    : allAverage;

  const keys = new Set([
    ...Array.from(allAverage.keys()),
    ...Array.from(interactionAverage.keys()),
  ]);

  return Array.from(keys)
    .map((key) => ({
      key,
      score: ((allAverage.get(key) || 0) + (interactionAverage.get(key) || 0)) / 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.key);
}

function formatPreviewList(
  values: string[],
  emptyLabel: string,
  maxVisible = 2
) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) {
    return emptyLabel;
  }
  if (filtered.length <= maxVisible) {
    return filtered.join(", ");
  }
  return `${filtered.slice(0, maxVisible).join(", ")} +${filtered.length - maxVisible}`;
}

function toTitleCase(value: string) {
  if (!value.trim()) return value;
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function CategoryCard({
  item,
  selected,
  onPress,
  t,
  compact,
}: {
  item: CategoryInsight;
  selected: boolean;
  onPress: () => void;
  t: (es: string, en: string) => string;
  compact: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryCard,
        compact ? styles.categoryCardHalf : styles.categoryCardFull,
        selected && styles.categoryCardSelected,
        pressed && { opacity: 0.92, transform: [{ scale: 0.987 }] },
      ]}
    >
      <LinearGradient
        colors={[`${item.color}1f`, "rgba(28,43,31,0.94)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.categoryCardTop}>
        <View
          style={[
            styles.categoryIconWrap,
            { backgroundColor: `${item.color}20` },
          ]}
        >
          <Feather name={item.icon} size={16} color={item.color} />
        </View>
        <View
          style={[
            styles.categoryStatusPill,
            item.hasUserValue
              ? styles.categoryStatusPillReady
              : styles.categoryStatusPillPending,
          ]}
        >
          <Text
            style={[
              styles.categoryStatusText,
              item.hasUserValue
                ? styles.categoryStatusTextReady
                : styles.categoryStatusTextPending,
            ]}
          >
            {item.hasUserValue ? t("Listo", "Ready") : t("Pendiente", "Pending")}
          </Text>
        </View>
      </View>

      <Text style={styles.categoryCardTitle}>{item.label}</Text>
      <Text style={styles.categoryCardSummary}>{item.summary}</Text>

      <View style={styles.categorySignalBlock}>
        <Text style={styles.categorySignalLabel}>{t("Quién soy yo", "Who I Am")}</Text>
        <Text style={styles.categorySignalValue}>{item.userValue}</Text>
      </View>

      <View style={styles.categoryPopularRow}>
        <Feather name="trending-up" size={13} color={item.color} />
        <Text style={styles.categoryPopularText}>{item.popularValue}</Text>
      </View>
    </Pressable>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { t, goals, language, likedProfiles, accountProfile, heightUnit } = useApp();
  const [activeFilter, setActiveFilter] = useState<GoalsFilter>("all");

  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
    : 0;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 96);
  const emptyLabel = t("Sin definir", "Not set");

  const likedDiscoveryProfiles = useMemo(
    () => discoverProfiles.filter((profile) => likedProfiles.includes(profile.id)),
    [likedProfiles]
  );

  const insightLookup = useMemo(() => {
    const map = new Map<string, { es: string; en: string }>();
    discoverProfiles.forEach((profile) => {
      profile.insightTags.forEach((tag) => {
        map.set(tag.en, tag);
      });
    });
    return map;
  }, []);

  const categoryInsights = useMemo<CategoryInsight[]>(() => {
    const profileLabel = {
      physical: () => {
        const parts = [
          getBodyTypeLabel(accountProfile.bodyType, t),
          accountProfile.height
            ? `${accountProfile.height} ${heightUnit === "imperial" ? "in" : "cm"}`
            : "",
        ].filter(Boolean);
        return formatPreviewList(parts, emptyLabel, 2);
      },
      personality: () =>
        getPersonalityLabel(accountProfile.personality, t) || emptyLabel,
      family: () =>
        getChildrenPreferenceLabel(accountProfile.childrenPreference, t) || emptyLabel,
      expectations: () =>
        getRelationshipGoalLabel(accountProfile.relationshipGoals, t) || emptyLabel,
      language: () =>
        formatPreviewList(
          accountProfile.languagesSpoken.map((value) =>
            getSpokenLanguageLabel(value, language)
          ),
          emptyLabel,
          2
        ),
      studies: () => getEducationLabel(accountProfile.education, t) || emptyLabel,
    } as const;

    const popularLabel = {
      physical: () => {
        const topBodyType = getCombinedTopValues(
          discoverProfiles.map((profile) => profile.physical.bodyType),
          likedDiscoveryProfiles.map((profile) => profile.physical.bodyType)
        )[0];
        const topHairColor = getCombinedTopValues(
          discoverProfiles.map((profile) => profile.physical.hairColor),
          likedDiscoveryProfiles.map((profile) => profile.physical.hairColor)
        )[0];
        return formatPreviewList(
          [
            topBodyType ? getBodyTypeLabel(topBodyType, t) : "",
            topHairColor ? getHairColorLabel(topHairColor, t) : "",
          ].filter(Boolean),
          emptyLabel,
          2
        );
      },
      personality: () => {
        const topInsights = getCombinedTopValues(
          discoverProfiles.flatMap((profile) =>
            profile.insightTags.map((tag) => tag.en)
          ),
          likedDiscoveryProfiles.flatMap((profile) =>
            profile.insightTags.map((tag) => tag.en)
          ),
          2
        ).map((value) => {
          const tag = insightLookup.get(value);
          return tag ? t(tag.es, tag.en) : toTitleCase(value);
        });
        return formatPreviewList(topInsights, emptyLabel, 2);
      },
      family: () => {
        const topValue = getCombinedTopValues(
          discoverProfiles.map((profile) => profile.about.childrenPreference),
          likedDiscoveryProfiles.map((profile) => profile.about.childrenPreference)
        )[0];
        return topValue ? getChildrenPreferenceLabel(topValue, t) : emptyLabel;
      },
      expectations: () => {
        const topValue = getCombinedTopValues(
          discoverProfiles.map((profile) => profile.about.relationshipGoals),
          likedDiscoveryProfiles.map((profile) => profile.about.relationshipGoals)
        )[0];
        return topValue ? getRelationshipGoalLabel(topValue, t) : emptyLabel;
      },
      language: () => {
        const topValues = getCombinedTopValues(
          discoverProfiles.flatMap((profile) => profile.about.languagesSpoken),
          likedDiscoveryProfiles.flatMap((profile) => profile.about.languagesSpoken),
          2
        ).map((value) => getSpokenLanguageLabel(value, language));
        return formatPreviewList(topValues, emptyLabel, 2);
      },
      studies: () => {
        const topValue = getCombinedTopValues(
          discoverProfiles.map((profile) => profile.about.education),
          likedDiscoveryProfiles.map((profile) => profile.about.education)
        )[0];
        return topValue ? getEducationLabel(topValue, t) : emptyLabel;
      },
    } as const;

    return REAL_CATEGORIES.map((key) => ({
      key,
      label: t(CATEGORY_CONFIG[key].labelEs, CATEGORY_CONFIG[key].labelEn),
      summary: t(CATEGORY_CONFIG[key].summaryEs, CATEGORY_CONFIG[key].summaryEn),
      icon: CATEGORY_CONFIG[key].icon,
      color: CATEGORY_CONFIG[key].color,
      userValue: profileLabel[key](),
      popularValue: popularLabel[key](),
      hasUserValue: profileLabel[key]() !== emptyLabel,
    }));
  }, [accountProfile, emptyLabel, heightUnit, insightLookup, language, likedDiscoveryProfiles, t]);

  const visibleInsights =
    activeFilter === "all"
      ? categoryInsights
      : categoryInsights.filter((item) => item.key === activeFilter);

  const filters = (Object.keys(CATEGORY_CONFIG) as GoalsFilter[]).map((key) => ({
    key,
    label: t(CATEGORY_CONFIG[key].labelEs, CATEGORY_CONFIG[key].labelEn),
    icon: CATEGORY_CONFIG[key].icon,
  }));

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("Mis Metas", "My Goals")}</Text>
          <Text style={styles.headerSub}>
            {t(
              "Tus señales clave, organizadas con claridad.",
              "Your key signals, organized with clarity."
            )}
          </Text>
        </View>

        <View style={styles.summaryWrap}>
          <View style={[styles.summaryCard, { overflow: "hidden" }]}>
            <LinearGradient
              colors={["rgba(82,183,136,0.16)", "rgba(82,183,136,0.04)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.summaryValue}>{avgProgress}%</Text>
            <Text style={styles.summaryLabel}>
              {t("Progreso global", "Overall progress")}
            </Text>
            <View style={styles.summaryProgress}>
              <View
                style={[
                  styles.summaryProgressFill,
                  { width: `${avgProgress}%` as const },
                ]}
              />
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Feather
                  name={filter.icon}
                  size={13}
                  color={active ? Colors.textInverted : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("Categorías", "Categories")}</Text>
          <Text style={styles.sectionCopy}>
            {t(
              "Tus categorías principales y lo que más destaca en los resultados simulados.",
              "Your main categories and what stands out most in simulated results."
            )}
          </Text>
        </View>

        <View style={styles.categoryGrid}>
          {visibleInsights.map((item) => (
            <CategoryCard
              key={item.key}
              item={item}
              selected={activeFilter === item.key}
              onPress={() =>
                setActiveFilter((current) => (current === item.key ? "all" : item.key))
              }
              t={t}
              compact={visibleInsights.length > 1}
            />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("Comparativa", "Comparison")}</Text>
          <Text style={styles.sectionCopy}>
            {t(
              "“Quién soy yo” usa tu perfil. “Atributos populares” combina perfiles simulados y tus likes.",
              "“Who I Am” uses your profile. “Popular Attributes” blends simulated profiles and your likes."
            )}
          </Text>
        </View>

        <View style={styles.tableCard}>
          <LinearGradient
            colors={["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableHeaderText, styles.tableCategoryColumn]}>
              {t("Categoría", "Category")}
            </Text>
            <Text style={[styles.tableHeaderText, styles.tableWhoColumn]}>
              {t("Quién soy yo", "Who I Am")}
            </Text>
            <Text style={[styles.tableHeaderText, styles.tablePopularColumn]}>
              {t("Atributos populares", "Popular Attributes")}
            </Text>
          </View>

          {visibleInsights.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.tableRow,
                index < visibleInsights.length - 1 && styles.tableRowBorder,
              ]}
            >
              <View style={[styles.tableCategoryColumn, styles.tableCategoryCell]}>
                <View
                  style={[
                    styles.tableCategoryIcon,
                    { backgroundColor: `${item.color}20` },
                  ]}
                >
                  <Feather name={item.icon} size={14} color={item.color} />
                </View>
                <Text style={styles.tableCategoryText}>{item.label}</Text>
              </View>
              <Text style={[styles.tableBodyText, styles.tableWhoColumn]}>
                {item.userValue}
              </Text>
              <Text style={[styles.tableBodyText, styles.tablePopularColumn]}>
                {item.popularValue}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  headerSub: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  summaryWrap: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.primaryLight,
    letterSpacing: -0.6,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryProgress: {
    marginTop: 4,
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  summaryProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  filterChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textInverted,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionCopy: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryCard: {
    minHeight: 174,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    padding: 16,
    overflow: "hidden",
  },
  categoryCardHalf: {
    width: "48%",
  },
  categoryCardFull: {
    width: "100%",
  },
  categoryCardSelected: {
    borderColor: Colors.primaryLight,
    shadowColor: Colors.primaryLight,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },
  categoryCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryStatusPill: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  categoryStatusPillReady: {
    backgroundColor: "rgba(82,183,136,0.14)",
    borderColor: "rgba(82,183,136,0.28)",
  },
  categoryStatusPillPending: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: Colors.border,
  },
  categoryStatusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  categoryStatusTextReady: {
    color: Colors.primaryLight,
  },
  categoryStatusTextPending: {
    color: Colors.textMuted,
  },
  categoryCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  categoryCardSummary: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  categorySignalBlock: {
    marginTop: 14,
    gap: 4,
  },
  categorySignalLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  categorySignalValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  categoryPopularRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  categoryPopularText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  tableCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    overflow: "hidden",
  },
  tableHeaderRow: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  tableBodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  tableCategoryColumn: {
    flex: 0.9,
  },
  tableWhoColumn: {
    flex: 1.2,
  },
  tablePopularColumn: {
    flex: 1.35,
  },
  tableCategoryCell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tableCategoryIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tableCategoryText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
