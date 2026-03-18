import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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
import { useApp, type Goal } from "@/context/AppContext";

type Category = "todas" | "fisica" | "personalidad" | "habitos" | "social";

const categoryConfig: Record<
  Category,
  { labelEs: string; labelEn: string; icon: string; color: string }
> = {
  todas: {
    labelEs: "Todas",
    labelEn: "All",
    icon: "grid",
    color: Colors.primaryLight,
  },
  fisica: {
    labelEs: "Físicas",
    labelEn: "Physical",
    icon: "activity",
    color: "#74C0FC",
  },
  personalidad: {
    labelEs: "Personalidad",
    labelEn: "Personality",
    icon: "heart",
    color: Colors.accent,
  },
  habitos: {
    labelEs: "Hábitos",
    labelEn: "Habits",
    icon: "repeat",
    color: "#63E6BE",
  },
  social: {
    labelEs: "Social",
    labelEn: "Social",
    icon: "users",
    color: "#FF8787",
  },
};

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${progress}%` as any, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { t } = useApp();
  const catCfg = categoryConfig[goal.category] ?? categoryConfig.todas;

  const getProgressColor = (p: number) => {
    if (p >= 70) return Colors.success;
    if (p >= 40) return Colors.accent;
    return "#74C0FC";
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.goalCard,
        { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <View style={styles.goalCardTop}>
        <View style={styles.goalCardLeft}>
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: `${catCfg.color}18` },
            ]}
          >
            <Feather
              name={catCfg.icon as any}
              size={16}
              color={catCfg.color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryLabel}>
              {t(catCfg.labelEs, catCfg.labelEn)}
            </Text>
            <Text style={styles.goalTitle}>
              {t(goal.titleEs, goal.titleEn)}
            </Text>
          </View>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{goal.progress}%</Text>
        </View>
      </View>

      <ProgressBar
        progress={goal.progress}
        color={getProgressColor(goal.progress)}
      />

      <View style={styles.goalCardBottom}>
        <View style={styles.nextAction}>
          <Feather name="chevron-right" size={14} color={Colors.primaryLight} />
          <Text style={styles.nextActionText} numberOfLines={2}>
            {t(goal.nextActionEs, goal.nextActionEn)}
          </Text>
        </View>
        <View style={styles.impactRow}>
          <Feather name="trending-up" size={12} color={Colors.accent} />
          <Text style={styles.impactText}>
            {t(goal.impactEs, goal.impactEn)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { t, goals, language } = useApp();
  const [activeCategory, setActiveCategory] = useState<Category>("todas");

  const filtered =
    activeCategory === "todas"
      ? goals
      : goals.filter((g) => g.category === activeCategory);

  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t("Mis Metas", "My Goals")}</Text>
            <Text style={styles.headerSub}>
              {t("Tu plan de mejora personal", "Your personal improvement plan")}
            </Text>
          </View>
          <Pressable style={styles.addBtn}>
            <Feather name="plus" size={20} color={Colors.primaryLight} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { overflow: "hidden" }]}>
            <LinearGradient
              colors={["rgba(82,183,136,0.15)", "rgba(82,183,136,0.05)"]}
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
                  { width: `${avgProgress}%` as any },
                ]}
              />
            </View>
          </View>

          <View style={[styles.summaryCard, { overflow: "hidden" }]}>
            <LinearGradient
              colors={["rgba(183,152,110,0.15)", "rgba(183,152,110,0.05)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={[styles.summaryValue, { color: Colors.accent }]}>
              {goals.length}
            </Text>
            <Text style={styles.summaryLabel}>
              {t("Metas activas", "Active goals")}
            </Text>
            <View style={styles.goalsGrid}>
              {goals.map((g) => (
                <View
                  key={g.id}
                  style={[
                    styles.goalDot,
                    g.progress >= 70 && styles.goalDotComplete,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(Object.keys(categoryConfig) as Category[]).map((cat) => {
            const cfg = categoryConfig[cat];
            const isActive = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Feather
                  name={cfg.icon as any}
                  size={13}
                  color={isActive ? Colors.textInverted : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {t(cfg.labelEs, cfg.labelEn)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.goalsList}>
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </View>

        <View style={styles.motivational}>
          <Feather name="award" size={18} color={Colors.accent} />
          <Text style={styles.motivationalText}>
            {t(
              "Cada pequeño avance te acerca a la mejor versión de ti mismo.",
              "Every small step brings you closer to the best version of yourself."
            )}
          </Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  summaryProgress: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  summaryProgressFill: {
    height: "100%",
    backgroundColor: Colors.primaryLight,
    borderRadius: 2,
  },
  goalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  goalDotComplete: {
    backgroundColor: Colors.primaryLight,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
  goalsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  goalCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  goalCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  goalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginTop: 2,
  },
  progressBadge: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  goalCardBottom: {
    gap: 6,
  },
  nextAction: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  nextActionText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  impactText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  motivational: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  motivationalText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
