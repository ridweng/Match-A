import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getPersonalityLabel,
  getRelationshipGoalLabel,
  getSpokenLanguageLabel,
} from "@/constants/profile-options";
import {
  type Goal,
  type GoalCategory,
  useApp,
} from "@/context/AppContext";
import { discoverProfiles } from "@/data/profiles";
import { formatPopularAttributeValue } from "@/utils/popularAttributes";

type GoalsFilter = "all" | GoalCategory;
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

type CategoryModule = {
  key: GoalCategory;
  label: string;
  summary: string;
  icon: FeatherName;
  color: string;
  userValue: string;
  popularValue: string;
  featuredTask: Goal | null;
  activeTasks: Goal[];
  completedTasks: Goal[];
  progress: number;
  completedCount: number;
  totalCount: number;
  toneLabel: string;
  toneCopy: string;
};

type DragState = {
  taskId: string;
  startIndex: number;
  hoverIndex: number;
  offsetY: number;
};

const CATEGORY_CONFIG: Record<GoalsFilter, CategoryDescriptor> = {
  all: {
    key: "all",
    labelEs: "Todas",
    labelEn: "All",
    icon: "grid",
    color: Colors.primaryLight,
    summaryEs: "Ver todo el mapa",
    summaryEn: "See the full map",
  },
  physical: {
    key: "physical",
    labelEs: "Físicas",
    labelEn: "Physical",
    icon: "activity",
    color: "#74C0FC",
    summaryEs: "Cuerpo, presencia y energía",
    summaryEn: "Body, presence, and energy",
  },
  personality: {
    key: "personality",
    labelEs: "Personalidad",
    labelEn: "Personality",
    icon: "smile",
    color: Colors.accent,
    summaryEs: "Confianza interna y claridad emocional",
    summaryEn: "Inner confidence and emotional clarity",
  },
  family: {
    key: "family",
    labelEs: "Familia",
    labelEn: "Family",
    icon: "users",
    color: "#FFB86B",
    summaryEs: "Visión y estabilidad compartida",
    summaryEn: "Shared vision and stability",
  },
  expectations: {
    key: "expectations",
    labelEs: "Expectativas",
    labelEn: "Expectations",
    icon: "target",
    color: "#B794F4",
    summaryEs: "Intención, ritmo y dirección",
    summaryEn: "Intention, pace, and direction",
  },
  language: {
    key: "language",
    labelEs: "Idioma",
    labelEn: "Language",
    icon: "message-circle",
    color: "#63E6BE",
    summaryEs: "Comunicación más natural",
    summaryEn: "More natural communication",
  },
  studies: {
    key: "studies",
    labelEs: "Estudios",
    labelEn: "Studies",
    icon: "book-open",
    color: "#FF8787",
    summaryEs: "Aprendizaje y proyección personal",
    summaryEn: "Learning and personal projection",
  },
};

const REAL_CATEGORIES: GoalCategory[] = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

const ACTIVE_TASK_ROW_HEIGHT = 86;

function formatPreviewList(values: string[], emptyLabel: string, maxVisible = 2) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) {
    return emptyLabel;
  }
  if (filtered.length <= maxVisible) {
    return filtered.join(", ");
  }
  return `${filtered.slice(0, maxVisible).join(", ")} +${filtered.length - maxVisible}`;
}

function getGrowthTone(
  progress: number,
  t: (es: string, en: string) => string
) {
  if (progress >= 100) {
    return {
      label: t("Integrado", "Integrated"),
      copy: t(
        "Tu base aquí ya se siente estable. Puedes mantenerla sin esfuerzo extra.",
        "This area already feels grounded. You can maintain it without extra strain."
      ),
    };
  }
  if (progress >= 67) {
    return {
      label: t("Avance sólido", "Strong momentum"),
      copy: t(
        "Ya hay tracción real en esta dimensión. Unos pocos pasos más la consolidan.",
        "There is real traction in this dimension. A few more steps will solidify it."
      ),
    };
  }
  if (progress >= 34) {
    return {
      label: t("Tomando ritmo", "Gaining rhythm"),
      copy: t(
        "Esta categoría ya se está moviendo. Priorizando bien, el progreso se vuelve visible.",
        "This category is already moving. With the right priority, progress becomes visible."
      ),
    };
  }
  return {
    label: t("Primer impulso", "First momentum"),
    copy: t(
      "Este es un buen punto de partida para construir mejora constante sin saturarte.",
      "This is a good starting point to build steady improvement without overload."
    ),
  };
}

function ProgressBar({
  progress,
  color,
  large = false,
}: {
  progress: number;
  color: string;
  large?: boolean;
}) {
  return (
    <View style={[styles.progressTrack, large && styles.progressTrackLarge]}>
      <View
        style={[
          styles.progressFill,
          large && styles.progressFillLarge,
          { width: `${progress}%` as const, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function ReorderableTaskList({
  tasks,
  color,
  t,
  onReorder,
  onComplete,
}: {
  tasks: Goal[];
  color: string;
  t: (es: string, en: string) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onComplete: (id: string) => void;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const updateDragState = useCallback((next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  useEffect(() => {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }
    if (!tasks.some((task) => task.id === current.taskId)) {
      updateDragState(null);
    }
  }, [tasks, updateDragState]);

  const finishDrag = useCallback(() => {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }

    if (current.startIndex !== current.hoverIndex) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Haptics.selectionAsync().catch(() => {});
      onReorder(current.startIndex, current.hoverIndex);
    }

    updateDragState(null);
  }, [onReorder, updateDragState]);

  if (!tasks.length) {
    return (
      <View style={styles.emptyTasksState}>
        <Text style={styles.emptyTasksTitle}>
          {t("Sin tareas activas por ahora", "No active tasks right now")}
        </Text>
        <Text style={styles.emptyTasksCopy}>
          {t(
            "Has cerrado este frente. Tu energía puede ir a otra dimensión.",
            "You have closed this front for now. Your energy can go to another dimension."
          )}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.listLabel}>{t("Prioridad activa", "Active priority")}</Text>
      <Text style={styles.listCopy}>
        {t(
          "Arrastra el mango para cambiar qué va primero. La primera tarea será tu foco visible.",
          "Drag the handle to change what comes first. The first task becomes your visible focus."
        )}
      </Text>

      <View
        style={[
          styles.taskArena,
          { height: tasks.length * ACTIVE_TASK_ROW_HEIGHT },
        ]}
      >
        {tasks.map((task, index) => {
          const isDragging = dragState?.taskId === task.id;
          let top = index * ACTIVE_TASK_ROW_HEIGHT;

          if (dragState) {
            if (isDragging) {
              top = dragState.startIndex * ACTIVE_TASK_ROW_HEIGHT + dragState.offsetY;
            } else if (
              dragState.hoverIndex > dragState.startIndex &&
              index > dragState.startIndex &&
              index <= dragState.hoverIndex
            ) {
              top -= ACTIVE_TASK_ROW_HEIGHT;
            } else if (
              dragState.hoverIndex < dragState.startIndex &&
              index < dragState.startIndex &&
              index >= dragState.hoverIndex
            ) {
              top += ACTIVE_TASK_ROW_HEIGHT;
            }
          }

          const responder = PanResponder.create({
            onStartShouldSetPanResponder: () => tasks.length > 1,
            onMoveShouldSetPanResponder: () => tasks.length > 1,
            onPanResponderGrant: () => {
              Haptics.selectionAsync().catch(() => {});
              updateDragState({
                taskId: task.id,
                startIndex: index,
                hoverIndex: index,
                offsetY: 0,
              });
            },
            onPanResponderMove: (_, gestureState) => {
              const current = dragStateRef.current;
              if (!current || current.taskId !== task.id) {
                return;
              }

              const rawIndex = Math.round(
                (current.startIndex * ACTIVE_TASK_ROW_HEIGHT + gestureState.dy) /
                  ACTIVE_TASK_ROW_HEIGHT
              );
              const nextHoverIndex = Math.max(
                0,
                Math.min(tasks.length - 1, rawIndex)
              );

              if (nextHoverIndex !== current.hoverIndex) {
                Haptics.selectionAsync().catch(() => {});
              }

              updateDragState({
                ...current,
                hoverIndex: nextHoverIndex,
                offsetY: gestureState.dy,
              });
            },
            onPanResponderRelease: finishDrag,
            onPanResponderTerminate: finishDrag,
          });

          return (
            <View
              key={task.id}
              style={[
                styles.taskRow,
                { top, zIndex: isDragging ? 5 : 1 },
                isDragging && styles.taskRowDragging,
              ]}
            >
              <View
                style={[
                  styles.taskOrderBadge,
                  index === 0 && { backgroundColor: `${color}22` },
                ]}
              >
                <Text
                  style={[
                    styles.taskOrderText,
                    index === 0 && { color },
                  ]}
                >
                  {index + 1}
                </Text>
              </View>

              <View style={styles.taskTextBlock}>
                <Text style={styles.taskTitle}>
                  {t(task.titleEs, task.titleEn)}
                </Text>
                <Text style={styles.taskSub}>
                  {t(task.nextActionEs, task.nextActionEn)}
                </Text>
              </View>

              <View style={styles.taskRowActions}>
                <Pressable
                  onPress={() => onComplete(task.id)}
                  style={({ pressed }) => [
                    styles.taskDoneButton,
                    { backgroundColor: `${color}18`, borderColor: `${color}30` },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Feather name="check" size={13} color={color} />
                </Pressable>
                <View
                  style={styles.taskDragHandle}
                  {...responder.panHandlers}
                >
                  <Feather name="menu" size={18} color={Colors.textSecondary} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CategoryProgressCard({
  item,
  expanded,
  onToggleExpand,
  onCompleteFeaturedTask,
  onCompleteTask,
  onReorderTasks,
  t,
}: {
  item: CategoryModule;
  expanded: boolean;
  onToggleExpand: () => void;
  onCompleteFeaturedTask: () => void;
  onCompleteTask: (id: string) => void;
  onReorderTasks: (fromIndex: number, toIndex: number) => void;
  t: (es: string, en: string) => string;
}) {
  return (
    <View style={styles.moduleCard}>
      <LinearGradient
        colors={[`${item.color}18`, "rgba(28,43,31,0.96)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Pressable onPress={onToggleExpand} style={styles.cardPressArea}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.cardHeaderIcon,
                { backgroundColor: `${item.color}20` },
              ]}
            >
              <Feather name={item.icon} size={18} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardCategoryLabel}>{item.label}</Text>
              <Text style={styles.cardToneLabel}>{item.toneLabel}</Text>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <Text style={[styles.cardPercent, { color: item.color }]}>
              {item.progress}%
            </Text>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Colors.textSecondary}
            />
          </View>
        </View>

        <ProgressBar progress={item.progress} color={item.color} />

        <Text style={styles.cardToneCopy}>{item.toneCopy}</Text>

        <View style={styles.featuredTaskCard}>
          <Text style={styles.featuredTaskLabel}>
            {t("En foco ahora", "Current focus")}
          </Text>
          {item.featuredTask ? (
            <>
              <Text style={styles.featuredTaskTitle}>
                {t(item.featuredTask.titleEs, item.featuredTask.titleEn)}
              </Text>
              <Text style={styles.featuredTaskCopy}>
                {t(item.featuredTask.impactEs, item.featuredTask.impactEn)}
              </Text>
              <Text style={styles.featuredTaskHint}>
                {t(item.featuredTask.nextActionEs, item.featuredTask.nextActionEn)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.featuredTaskTitle}>
                {t("Todo al día", "Everything up to date")}
              </Text>
              <Text style={styles.featuredTaskCopy}>
                {t(
                  "Has completado las tareas activas de esta dimensión.",
                  "You have completed the active tasks for this dimension."
                )}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          {t(
            `${item.completedCount} de ${item.totalCount} tareas completadas`,
            `${item.completedCount} of ${item.totalCount} tasks completed`
          )}
        </Text>

        <View style={styles.cardActionsRow}>
          {item.featuredTask ? (
            <Pressable
              onPress={onCompleteFeaturedTask}
              style={({ pressed }) => [
                styles.completeCta,
                { backgroundColor: item.color },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Feather name="check" size={14} color={Colors.textInverted} />
              <Text style={styles.completeCtaText}>
                {t("Completar", "Complete")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.completedBadge}>
              <Feather name="check-circle" size={14} color={Colors.primaryLight} />
              <Text style={styles.completedBadgeText}>
                {t("Completado", "Completed")}
              </Text>
            </View>
          )}

          <Pressable onPress={onToggleExpand} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>
              {expanded ? t("Ocultar lista", "Hide list") : t("Ver lista", "View list")}
            </Text>
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={styles.expandedContent}>
          <ReorderableTaskList
            tasks={item.activeTasks}
            color={item.color}
            t={t}
            onComplete={onCompleteTask}
            onReorder={onReorderTasks}
          />

          {item.completedTasks.length ? (
            <View style={styles.completedSection}>
              <Text style={styles.listLabel}>
                {t("Completadas", "Completed")}
              </Text>
              <View style={styles.completedList}>
                {item.completedTasks.map((task) => (
                  <View key={task.id} style={styles.completedTaskRow}>
                    <View style={styles.completedTaskIcon}>
                      <Feather
                        name="check"
                        size={12}
                        color={Colors.primaryLight}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.completedTaskTitle}>
                        {t(task.titleEs, task.titleEn)}
                      </Text>
                      <Text style={styles.completedTaskCopy}>
                        {t(task.impactEs, task.impactEn)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const {
    t,
    goals,
    language,
    accountProfile,
    heightUnit,
    completeGoalTask,
    reorderGoalTasks,
    popularAttributesByCategory,
  } = useApp();
  const [activeFilter, setActiveFilter] = useState<GoalsFilter>("all");
  const [expandedCategory, setExpandedCategory] = useState<GoalCategory | null>(null);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 96);
  const emptyLabel = t("Sin definir", "Not set");

  const insightLookup = useMemo(() => {
    const map = new Map<string, { es: string; en: string }>();
    discoverProfiles.forEach((profile) => {
      profile.insightTags.forEach((tag) => {
        map.set(tag.en, tag);
      });
    });
    return map;
  }, []);

  const categoryModules = useMemo<CategoryModule[]>(() => {
    const goalsByCategory = new Map<GoalCategory, Goal[]>();

    REAL_CATEGORIES.forEach((category) => {
      goalsByCategory.set(
        category,
        goals
          .filter((goal) => goal.category === category)
          .sort((a, b) => a.order - b.order)
      );
    });

    const profileLabel: Record<GoalCategory, () => string> = {
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
    };

    return REAL_CATEGORIES.map((key) => {
      const orderedTasks = goalsByCategory.get(key) || [];
      const activeTasks = orderedTasks.filter((goal) => !goal.completed);
      const completedTasks = orderedTasks.filter((goal) => goal.completed);
      const progress = orderedTasks[0]?.progress || 0;
      const tone = getGrowthTone(progress, t);

      return {
        key,
        label: t(CATEGORY_CONFIG[key].labelEs, CATEGORY_CONFIG[key].labelEn),
        summary: t(CATEGORY_CONFIG[key].summaryEs, CATEGORY_CONFIG[key].summaryEn),
        icon: CATEGORY_CONFIG[key].icon,
        color: CATEGORY_CONFIG[key].color,
        userValue: profileLabel[key](),
        popularValue: formatPopularAttributeValue(
          key,
          popularAttributesByCategory[key]?.valueKey,
          {
            t,
            language,
            insightLookup,
            emptyLabel,
          }
        ),
        featuredTask: activeTasks[0] || null,
        activeTasks,
        completedTasks,
        progress,
        completedCount: completedTasks.length,
        totalCount: orderedTasks.length,
        toneLabel: tone.label,
        toneCopy: tone.copy,
      };
    });
  }, [
    accountProfile,
    emptyLabel,
    goals,
    heightUnit,
    insightLookup,
    language,
    popularAttributesByCategory,
    t,
  ]);

  const avgProgress = categoryModules.length
    ? Math.round(
        categoryModules.reduce((sum, category) => sum + category.progress, 0) /
          categoryModules.length
      )
    : 0;

  const visibleModules =
    activeFilter === "all"
      ? categoryModules
      : categoryModules.filter((module) => module.key === activeFilter);

  const filters = (Object.keys(CATEGORY_CONFIG) as GoalsFilter[]).map((key) => ({
    key,
    label: t(CATEGORY_CONFIG[key].labelEs, CATEGORY_CONFIG[key].labelEn),
    icon: CATEGORY_CONFIG[key].icon,
  }));

  useEffect(() => {
    if (
      expandedCategory &&
      activeFilter !== "all" &&
      expandedCategory !== activeFilter
    ) {
      setExpandedCategory(null);
    }
  }, [activeFilter, expandedCategory]);

  const handleToggleExpand = useCallback((category: GoalCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategory((current) => (current === category ? null : category));
  }, []);

  const handleCompleteTask = useCallback((goalId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    completeGoalTask(goalId);
  }, [completeGoalTask]);

  const handleReorderTasks = useCallback(
    (category: GoalCategory, fromIndex: number, toIndex: number) => {
      reorderGoalTasks(category, fromIndex, toIndex);
    },
    [reorderGoalTasks]
  );

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
              "Una vista clara de lo que estás fortaleciendo ahora y cómo cada paso impulsa tu avance.",
              "A clear view of what you are strengthening now and how each step moves you forward."
            )}
          </Text>
        </View>

        <View style={styles.summaryWrap}>
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={["rgba(82,183,136,0.16)", "rgba(82,183,136,0.04)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryOverline}>
                  {t("Progreso global", "Overall progress")}
                </Text>
                <Text style={styles.summaryValue}>{avgProgress}%</Text>
              </View>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>
                  {avgProgress >= 67
                    ? t("Evolución sólida", "Strong evolution")
                    : avgProgress >= 34
                      ? t("Buen ritmo", "Good pace")
                      : t("Construyendo base", "Building the base")}
                </Text>
              </View>
            </View>

            <ProgressBar progress={avgProgress} color={Colors.primaryLight} large />

            <Text style={styles.summaryCopy}>
              {t(
                "Cada categoría aporta a una trayectoria más equilibrada. Completar una tarea mueve el conjunto.",
                "Every category contributes to a more balanced trajectory. Completing one task moves the whole picture."
              )}
            </Text>
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
          <Text style={styles.sectionTitle}>
            {t("Ruta por categoría", "Category path")}
          </Text>
          <Text style={styles.sectionCopy}>
            {t(
              "Cada módulo combina claridad, progreso y una siguiente acción concreta para ayudarte a avanzar sin sentir presión.",
              "Each module combines clarity, progress, and one concrete next action so you can move forward without feeling pressured."
            )}
          </Text>
        </View>

        <View style={styles.moduleStack}>
          {visibleModules.map((item) => (
            <CategoryProgressCard
              key={item.key}
              item={item}
              expanded={expandedCategory === item.key}
              onToggleExpand={() => handleToggleExpand(item.key)}
              onCompleteFeaturedTask={() =>
                item.featuredTask ? handleCompleteTask(item.featuredTask.id) : undefined
              }
              onCompleteTask={handleCompleteTask}
              onReorderTasks={(fromIndex, toIndex) =>
                handleReorderTasks(item.key, fromIndex, toIndex)
              }
              t={t}
            />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t("Comparativa", "Comparison")}
          </Text>
          <Text style={styles.sectionCopy}>
            {t(
              "Tu perfil define quién eres hoy. Los atributos populares mezclan perfiles simulados y tus interacciones para dar contexto.",
              "Your profile defines who you are today. Popular attributes blend simulated profiles and your interactions to add context."
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

          {visibleModules.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.tableRow,
                index < visibleModules.length - 1 && styles.tableRowBorder,
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
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  summaryWrap: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    overflow: "hidden",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryOverline: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryValue: {
    marginTop: 4,
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: Colors.primaryLight,
    letterSpacing: -1,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.24)",
  },
  summaryBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryLight,
  },
  summaryCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textInverted,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  sectionCopy: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  moduleStack: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 24,
  },
  moduleCard: {
    overflow: "hidden",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressArea: {
    padding: 18,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  cardHeaderRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCategoryLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  cardToneLabel: {
    marginTop: 2,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardPercent: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.4,
  },
  cardToneCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  featuredTaskCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  featuredTaskLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  featuredTaskTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  featuredTaskCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  featuredTaskHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.ivoryDim,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 14,
    gap: 12,
  },
  cardMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  completeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  completeCtaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.textInverted,
  },
  secondaryAction: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  secondaryActionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.18)",
  },
  completedBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 14,
    gap: 18,
  },
  listLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  listCopy: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  taskArena: {
    position: "relative",
    marginTop: 12,
  },
  taskRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 74,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  taskRowDragging: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    backgroundColor: Colors.backgroundElevated,
  },
  taskOrderBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  taskOrderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  taskTextBlock: {
    flex: 1,
    gap: 3,
  },
  taskTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  taskSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  taskRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskDoneButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskDragHandle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyTasksState: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    gap: 6,
  },
  emptyTasksTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  emptyTasksCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  completedSection: {
    gap: 10,
  },
  completedList: {
    gap: 10,
  },
  completedTaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completedTaskIcon: {
    marginTop: 2,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.12)",
  },
  completedTaskTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.ivoryDim,
  },
  completedTaskCopy: {
    marginTop: 3,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  tableCard: {
    overflow: "hidden",
    marginHorizontal: 20,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  tableHeaderRow: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableBodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text,
  },
  tableCategoryColumn: {
    width: "26%",
  },
  tableWhoColumn: {
    width: "32%",
    paddingRight: 8,
  },
  tablePopularColumn: {
    width: "42%",
  },
  tableCategoryCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  tableCategoryIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tableCategoryText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.text,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressTrackLarge: {
    height: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressFillLarge: {
    shadowColor: Colors.primaryLight,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
