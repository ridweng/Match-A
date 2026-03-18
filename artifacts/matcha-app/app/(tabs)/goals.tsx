<<<<<<< HEAD
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  Platform,
  Pressable,
  ScrollView,
=======
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
>>>>>>> f81a9b8 (second try)
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

<<<<<<< HEAD
import colors from "@/constants/colors";
import { getTranslations } from "@/constants/i18n";
import { useApp } from "@/context/AppContext";

type GoalCategory = "all" | "physical" | "personality" | "style" | "habits";

type Goal = {
  id: string;
  titleEs: string;
  titleEn: string;
  category: Exclude<GoalCategory, "all">;
  progress: number;
  nextActionEs: string;
  nextActionEn: string;
  impactEs: string;
  impactEn: string;
  icon: string;
};

const GOALS: Goal[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "physical",
    progress: 68,
    nextActionEs: "Corre 20 min hoy sin parar",
    nextActionEn: "Run 20 min today without stopping",
    impactEs: "Más energía y mejor postura",
    impactEn: "More energy and better posture",
    icon: "activity",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "personality",
    progress: 42,
    nextActionEs: "Inicia una conversación con un extraño",
    nextActionEn: "Start a conversation with a stranger",
    impactEs: "Más atractivo en interacciones sociales",
    impactEn: "More attractive in social interactions",
    icon: "users",
  },
  {
    id: "3",
    titleEs: "Higiene y cuidado",
    titleEn: "Hygiene and grooming",
    category: "style",
    progress: 85,
    nextActionEs: "Hidrata tu piel antes de dormir",
    nextActionEn: "Moisturize your skin before sleep",
    impactEs: "Primera impresión significativamente mejor",
    impactEn: "Significantly better first impression",
    icon: "star",
  },
  {
    id: "4",
    titleEs: "Inteligencia emocional",
    titleEn: "Emotional intelligence",
    category: "personality",
    progress: 55,
    nextActionEs: "Escucha activa en tu próxima conversación",
    nextActionEn: "Active listening in your next conversation",
    impactEs: "Conexiones más profundas y auténticas",
    impactEn: "Deeper and more authentic connections",
    icon: "heart",
  },
  {
    id: "5",
    titleEs: "Postura corporal",
    titleEn: "Body posture",
    category: "physical",
    progress: 30,
    nextActionEs: "10 min de ejercicios de postura ahora",
    nextActionEn: "10 min posture exercises right now",
    impactEs: "Proyectas más confianza y presencia",
    impactEn: "Project more confidence and presence",
    icon: "trending-up",
  },
  {
    id: "6",
    titleEs: "Habilidades de charla",
    titleEn: "Conversation skills",
    category: "personality",
    progress: 60,
    nextActionEs: "Aprende 3 preguntas abiertas interesantes",
    nextActionEn: "Learn 3 interesting open-ended questions",
    impactEs: "Conversaciones más atractivas y fluidas",
    impactEn: "More engaging and fluid conversations",
    icon: "message-circle",
  },
];

function GoalCard({ goal, language }: { goal: Goal; language: string }) {
  const progressAnim = useSharedValue(0);
  React.useEffect(() => {
    progressAnim.value = withSpring(goal.progress / 100, {
      damping: 18,
      stiffness: 80,
    });
  }, [goal.progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const title = language === "es" ? goal.titleEs : goal.titleEn;
  const nextAction = language === "es" ? goal.nextActionEs : goal.nextActionEn;
  const impact = language === "es" ? goal.impactEs : goal.impactEn;

  const categoryColor = {
    physical: "#4299E1",
    personality: "#9F7AEA",
    style: colors.gold,
    habits: "#48BB78",
  }[goal.category];

  return (
    <View style={gc.card}>
      <View style={gc.top}>
        <View style={[gc.iconBox, { backgroundColor: `${categoryColor}18` }]}>
          <Feather name={goal.icon as any} size={20} color={categoryColor} />
        </View>
        <View style={gc.topInfo}>
          <Text style={gc.title}>{title}</Text>
          <View
            style={[gc.categoryBadge, { backgroundColor: `${categoryColor}15` }]}
          >
            <Text style={[gc.categoryText, { color: categoryColor }]}>
              {goal.category.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[gc.percent, { color: categoryColor }]}>
          {goal.progress}%
        </Text>
      </View>

      <View style={gc.progressTrack}>
        <Animated.View
          style={[
            gc.progressFill,
            { backgroundColor: categoryColor },
            barStyle,
          ]}
        />
      </View>

      <View style={gc.actions}>
        <View style={gc.actionItem}>
          <Feather name="zap" size={12} color={colors.gold} />
          <Text style={gc.actionText} numberOfLines={2}>{nextAction}</Text>
        </View>
        <View style={gc.actionItem}>
          <Feather name="arrow-up-right" size={12} color={colors.success} />
          <Text style={gc.impactText} numberOfLines={2}>{impact}</Text>
        </View>
      </View>
=======
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
>>>>>>> f81a9b8 (second try)
    </View>
  );
}

<<<<<<< HEAD
const gc = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 14,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topInfo: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.ivory,
    lineHeight: 20,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  percent: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    minWidth: 44,
    textAlign: "right",
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
  actions: {
    gap: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 2,
  },
  actionText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  impactText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.slateLight,
    lineHeight: 17,
  },
});

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const t = getTranslations(language).goals;
  const [filter, setFilter] = useState<GoalCategory>("all");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const filtered =
    filter === "all" ? GOALS : GOALS.filter((g) => g.category === filter);

  const totalProgress = Math.round(
    GOALS.reduce((sum, g) => sum + g.progress, 0) / GOALS.length
  );
  const activeCount = GOALS.length;

  const filters: { key: GoalCategory; labelEs: string; labelEn: string }[] = [
    { key: "all", labelEs: "Todas", labelEn: "All" },
    { key: "physical", labelEs: "Físicas", labelEn: "Physical" },
    { key: "personality", labelEs: "Personalidad", labelEn: "Personality" },
    { key: "style", labelEs: "Estilo", labelEn: "Style" },
    { key: "habits", labelEs: "Hábitos", labelEn: "Habits" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.header}</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <Feather name="plus" size={20} color={colors.gold} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPadding + 100 },
        ]}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryCircle}>
            <Text style={styles.summaryPercent}>{totalProgress}%</Text>
            <Text style={styles.summaryLabel}>{t.overallProgress}</Text>
          </View>
          <View style={styles.summaryTrack}>
            <View style={[styles.summaryFill, { width: `${totalProgress}%` }]} />
          </View>
          <View style={styles.activeRow}>
            <Ionicons name="sparkles" size={14} color={colors.gold} />
            <Text style={styles.activeText}>
              {activeCount} {t.activeGoals}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
              style={[
                styles.filterBtn,
                filter === f.key && styles.filterBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
              >
                {language === "es" ? f.labelEs : f.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

=======
function GoalCard({ goal, language }: { goal: Goal; language: string }) {
  const { t, updateGoalProgress } = useApp();
  const catCfg = categoryConfig[goal.category] ?? categoryConfig.todas;
  const [pressed, setPressed] = useState(false);

  const getProgressColor = (p: number) => {
    if (p >= 70) return Colors.success;
    if (p >= 40) return Colors.accent;
    return "#74C0FC";
  };

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={({ pressed: p }) => [
        styles.goalCard,
        { opacity: p ? 0.92 : 1, transform: [{ scale: p ? 0.985 : 1 }] },
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

  const avgProgress = Math.round(
    goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
  );
  const activeGoals = goals.length;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {t("Mis Metas", "My Goals")}
            </Text>
            <Text style={styles.headerSub}>
              {t("Tu plan de mejora personal", "Your personal improvement plan")}
            </Text>
          </View>
          <Pressable style={styles.addBtn}>
            <Feather name="plus" size={20} color={Colors.primaryLight} />
          </Pressable>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
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

          <View style={styles.summaryCard}>
            <LinearGradient
              colors={["rgba(183,152,110,0.15)", "rgba(183,152,110,0.05)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={[styles.summaryValue, { color: Colors.accent }]}>
              {activeGoals}
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

        {/* Category filter */}
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

        {/* Goal cards */}
>>>>>>> f81a9b8 (second try)
        <View style={styles.goalsList}>
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} language={language} />
          ))}
        </View>
<<<<<<< HEAD
=======

        {/* Motivational message */}
        <View style={styles.motivational}>
          <Feather name="award" size={18} color={Colors.accent} />
          <Text style={styles.motivationalText}>
            {t(
              "Cada pequeño avance te acerca a la mejor versión de ti mismo.",
              "Every small step brings you closer to the best version of yourself."
            )}
          </Text>
        </View>
>>>>>>> f81a9b8 (second try)
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
<<<<<<< HEAD
    backgroundColor: colors.navy,
=======
    backgroundColor: Colors.background,
>>>>>>> f81a9b8 (second try)
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
<<<<<<< HEAD
    paddingVertical: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: colors.ivory,
    letterSpacing: -0.5,
=======
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
>>>>>>> f81a9b8 (second try)
  },
  addBtn: {
    width: 40,
    height: 40,
<<<<<<< HEAD
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    gap: 14,
    marginBottom: 20,
  },
  summaryCircle: {
    alignItems: "center",
    gap: 4,
  },
  summaryPercent: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
    color: colors.gold,
    lineHeight: 56,
  },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  summaryFill: {
    height: "100%",
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  activeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.muted,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: "rgba(76,175,114,0.15)",
    borderColor: "rgba(76,175,114,0.4)",
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.slateLight,
  },
  filterTextActive: {
    color: colors.goldLight,
  },
  goalsList: {
    gap: 12,
=======
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: Colors.primaryLight,
    letterSpacing: -1,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  summaryProgress: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: 8,
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
    marginTop: 8,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  goalDotComplete: {
    backgroundColor: Colors.accent,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 20,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
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
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  goalCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  goalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.text,
  },
  progressTrack: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  goalCardBottom: {
    gap: 8,
  },
  nextAction: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  nextActionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  impactText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  motivational: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  motivationalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
    fontStyle: "italic",
>>>>>>> f81a9b8 (second try)
  },
});
