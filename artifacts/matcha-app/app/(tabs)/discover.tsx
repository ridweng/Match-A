import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
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
  getAlcoholUseLabel,
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getEthnicityLabel,
  getHairColorLabel,
  getPhysicalActivityLabel,
  getPoliticalInterestLabel,
  getRelationshipGoalLabel,
  getReligionImportanceLabel,
  getReligionLabel,
  getTobaccoUseLabel,
} from "@/constants/profile-options";
import { useApp } from "@/context/AppContext";
import { discoverProfiles, type DiscoverProfile } from "@/data/profiles";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.62;
const SWIPE_THRESHOLD = 80;
const INFO_SWIPE_THRESHOLD = 82;

type SwipeState = "idle" | "like" | "dislike";
type FeatherName = React.ComponentProps<typeof Feather>["name"];

const LANGUAGE_FLAG_CODES: Record<string, string> = {
  spanish: "es",
  english: "gb",
  portuguese: "pt",
  french: "fr",
  italian: "it",
  german: "de",
  dutch: "nl",
  catalan: "ad",
  galician: "es",
  basque: "es",
};

function AboutRow({
  icon,
  label,
  value,
}: {
  icon: FeatherName;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIconWrap}>
        <Feather name={icon} size={16} color={Colors.info} />
      </View>
      <View style={styles.infoRowBody}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        {typeof value === "string" ? (
          <Text style={styles.infoRowValue}>{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

function PhysicalRow({
  icon,
  label,
  value,
}: {
  icon: FeatherName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.physicalRow}>
      <View style={styles.physicalIconWrap}>
        <Feather name={icon} size={16} color={Colors.primaryLight} />
      </View>
      <View style={styles.physicalBody}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function LifestyleTile({
  icon,
  label,
  value,
}: {
  icon: FeatherName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.lifestyleTile}>
      <View style={styles.lifestyleIconWrap}>
        <Feather name={icon} size={18} color={Colors.info} />
      </View>
      <Text style={styles.lifestyleTileLabel}>{label}</Text>
      <Text style={styles.lifestyleTileValue}>{value}</Text>
    </View>
  );
}

function getLanguageFlagUri(value: string) {
  const countryCode = LANGUAGE_FLAG_CODES[value];
  if (!countryCode) {
    return null;
  }
  return `https://flagcdn.com/w40/${countryCode}.png`;
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { t, likeProfile, goals } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>("idle");
  const [showInsight, setShowInsight] = useState(false);
  const [lastLikedProfile, setLastLikedProfile] = useState<DiscoverProfile | null>(null);
  const [isInfoVisible, setIsInfoVisible] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const backScrollRef = useRef<ScrollView | null>(null);

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const dislikeOpacity = position.x.interpolate({
    inputRange: [-60, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  const current = discoverProfiles[currentIndex];
  const next = discoverProfiles[(currentIndex + 1) % discoverProfiles.length];
  const nextNext = discoverProfiles[(currentIndex + 2) % discoverProfiles.length];

  const relatedGoals = useMemo(
    () =>
      lastLikedProfile
        ? lastLikedProfile.goalFeedback
            .map((gf) => {
              const goal = goals.find((g) => g.id === gf.goalId);
              return goal ? { goal, reason: gf.reason } : null;
            })
            .filter(Boolean)
        : [],
    [goals, lastLikedProfile]
  );

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const setInfoVisible = (nextVisible: boolean) => {
    setIsInfoVisible(nextVisible);
    if (nextVisible) {
      backScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    Animated.spring(flipAnim, {
      toValue: nextVisible ? 1 : 0,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const toggleInfo = () => {
    Haptics.selectionAsync().catch(() => {});
    setInfoVisible(!isInfoVisible);
  };

  const resetCardState = () => {
    setSwipeState("idle");
    position.setValue({ x: 0, y: 0 });
    setIsInfoVisible(false);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const swipeRight = () => {
    const profile = discoverProfiles[currentIndex];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      likeProfile(profile.id);
      setLastLikedProfile(profile);
      setShowInsight(true);
      resetCardState();
      setCurrentIndex((prev) =>
        prev < discoverProfiles.length - 1 ? prev + 1 : 0
      );
    });
  };

  const swipeLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      resetCardState();
      setCurrentIndex((prev) =>
        prev < discoverProfiles.length - 1 ? prev + 1 : 0
      );
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          const horizontalIntent =
            Math.abs(gesture.dx) > 12 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy);
          const upwardInfoIntent =
            !isInfoVisible &&
            gesture.dy < -12 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return horizontalIntent || upwardInfoIntent;
        },
        onPanResponderMove: (_, gesture) => {
          const horizontalIntent = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
          if (horizontalIntent) {
            position.setValue({ x: gesture.dx, y: gesture.dy * 0.18 });
            if (gesture.dx > 40) setSwipeState("like");
            else if (gesture.dx < -40) setSwipeState("dislike");
            else setSwipeState("idle");
            return;
          }

          if (!isInfoVisible && gesture.dy < 0) {
            position.setValue({ x: 0, y: gesture.dy * 0.4 });
            setSwipeState("idle");
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const horizontalIntent = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
          if (horizontalIntent) {
            if (gesture.dx > SWIPE_THRESHOLD) {
              swipeRight();
            } else if (gesture.dx < -SWIPE_THRESHOLD) {
              swipeLeft();
            } else {
              resetPosition();
              setSwipeState("idle");
            }
            return;
          }

          if (
            !isInfoVisible &&
            gesture.dy < -INFO_SWIPE_THRESHOLD &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx)
          ) {
            Haptics.selectionAsync().catch(() => {});
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
            setInfoVisible(true);
            return;
          }

          resetPosition();
          setSwipeState("idle");
        },
        onPanResponderTerminate: () => {
          resetPosition();
          setSwipeState("idle");
        },
      }),
    [isInfoVisible]
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t("Descubrir", "Discover")}</Text>
          <Text style={styles.headerSub}>
            {t("Aprende de cada perfil", "Learn from every profile")}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.filterBtn}>
            <Feather name="sliders" size={18} color={Colors.textSecondary} />
          </View>
        </View>
      </View>

      <View style={styles.cardStack}>
        <View style={[styles.cardBase, styles.cardThird]}>
          <Image
            source={{ uri: nextNext.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>

        <View style={[styles.cardBase, styles.cardSecond]}>
          <Image
            source={{ uri: next.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.cardBase,
            styles.cardInteractive,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
        >
          <Animated.View
            pointerEvents={isInfoVisible ? "none" : "auto"}
            style={[
              styles.cardFace,
              styles.cardFaceFront,
              {
                transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
              },
            ]}
          >
            <Image
              source={{ uri: current.imageUrl }}
              style={styles.cardImage}
              resizeMode="cover"
            />

            <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
              <LinearGradient
                colors={["transparent", Colors.likeOverlay]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.stampContainer}>
                <View style={styles.likeStamp}>
                  <Feather name="heart" size={28} color="#fff" />
                  <Text style={styles.stampText}>{t("ME GUSTA", "LIKE")}</Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={[styles.dislikeOverlay, { opacity: dislikeOpacity }]}
            >
              <LinearGradient
                colors={["transparent", Colors.dislikeOverlay]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.stampContainer}>
                <View style={styles.dislikeStamp}>
                  <Feather name="x" size={28} color="#fff" />
                  <Text style={styles.stampText}>{t("PASAR", "PASS")}</Text>
                </View>
              </View>
            </Animated.View>

            <LinearGradient
              colors={["transparent", "rgba(15,26,20,0.98)"]}
              style={styles.cardGradient}
            >
              <View style={styles.insightTags}>
                {current.insightTags.map((tag) => (
                  <View key={`${current.id}-${tag.es}`} style={styles.insightTag}>
                    <Text style={styles.insightTagText}>{t(tag.es, tag.en)}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.cardName}>
                {current.name}, {current.age}
              </Text>
              <View style={styles.cardRow}>
                <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                <Text style={styles.cardLocation}>{current.location}</Text>
                <Text style={styles.cardDot}>·</Text>
                <Text style={styles.cardOccupation}>
                  {t(current.occupation.es, current.occupation.en)}
                </Text>
              </View>

              <View style={styles.interestsRow}>
                {current.attributes.interests.slice(0, 3).map((interest) => (
                  <View key={`${current.id}-${interest}`} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View
            pointerEvents={isInfoVisible ? "auto" : "none"}
            style={[
              styles.cardFace,
              styles.cardFaceBack,
              {
                transform: [{ perspective: 1200 }, { rotateY: backRotate }],
              },
            ]}
          >
            <View style={styles.backHeader}>
              <View style={styles.backInfoBadge}>
                <Feather name="info" size={14} color={Colors.info} />
              </View>
              <Text style={styles.backName}>
                {current.name}, {current.age}
              </Text>
              <Text style={styles.backMeta}>
                {current.location} · {t(current.occupation.es, current.occupation.en)}
              </Text>
            </View>

            <ScrollView
              ref={backScrollRef}
              style={styles.backScroll}
              contentContainerStyle={styles.backScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.backSection}>
                <Text style={styles.backSectionTitle}>{t("Sobre mí", "About me")}</Text>
                <AboutRow
                  icon="message-circle"
                  label={t("Sobre mí", "About me")}
                  value={t(current.about.bio.es, current.about.bio.en)}
                />
                <AboutRow
                  icon="heart"
                  label={t("Metas de tu relación", "Relationship goals")}
                  value={getRelationshipGoalLabel(current.about.relationshipGoals, t)}
                />
                <AboutRow
                  icon="book-open"
                  label={t("Educación", "Education")}
                  value={getEducationLabel(current.about.education, t)}
                />
                <AboutRow
                  icon="users"
                  label={t("Hijxs", "Children")}
                  value={getChildrenPreferenceLabel(current.about.childrenPreference, t)}
                />
                <AboutRow
                  icon="globe"
                  label={t("Idiomas", "Languages")}
                  value={
                    <View style={styles.flagImageRow}>
                      {current.about.languagesSpoken.map((value) => {
                        const uri = getLanguageFlagUri(value);
                        return uri ? (
                          <Image
                            key={`${current.id}-${value}`}
                            source={{ uri }}
                            style={styles.flagImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            key={`${current.id}-${value}`}
                            style={styles.flagFallback}
                          >
                            <Feather name="globe" size={14} color={Colors.info} />
                          </View>
                        );
                      })}
                    </View>
                  }
                />
              </View>

              <View style={styles.backSection}>
                <Text style={styles.backSectionTitle}>
                  {t("Estilo de vida", "Life Style")}
                </Text>
                <View style={styles.lifestyleGrid}>
                  <LifestyleTile
                    icon="activity"
                    label={t("Actividad física", "Activity")}
                    value={getPhysicalActivityLabel(current.lifestyle.physicalActivity, t)}
                  />
                  <LifestyleTile
                    icon="coffee"
                    label={t("Bebida", "Drink")}
                    value={getAlcoholUseLabel(current.lifestyle.alcoholUse, t)}
                  />
                  <LifestyleTile
                    icon="wind"
                    label={t("Tabaco", "Smoke")}
                    value={getTobaccoUseLabel(current.lifestyle.tobaccoUse, t)}
                  />
                  <LifestyleTile
                    icon="flag"
                    label={t("Política", "Politics")}
                    value={getPoliticalInterestLabel(current.lifestyle.politicalInterest, t)}
                  />
                  <LifestyleTile
                    icon="star"
                    label={t("Religión", "Religion")}
                    value={getReligionImportanceLabel(current.lifestyle.religionImportance, t)}
                  />
                  <LifestyleTile
                    icon="moon"
                    label={t("Creencia", "Belief")}
                    value={getReligionLabel(current.lifestyle.religion, t)}
                  />
                </View>
              </View>

              <View style={styles.backSection}>
                <Text style={styles.backSectionTitle}>
                  {t("Atributos físicos", "Physical attributes")}
                </Text>
                <PhysicalRow
                  icon="user"
                  label={t("Tipo de cuerpo", "Body type")}
                  value={getBodyTypeLabel(current.physical.bodyType, t)}
                />
                <PhysicalRow
                  icon="maximize-2"
                  label={t("Altura", "Height")}
                  value={current.physical.height}
                />
                <PhysicalRow
                  icon="feather"
                  label={t("Color de cabello", "Hair color")}
                  value={getHairColorLabel(current.physical.hairColor, t)}
                />
                <PhysicalRow
                  icon="map"
                  label={t("Etnia", "Ethnicity")}
                  value={getEthnicityLabel(current.physical.ethnicity, t)}
                />
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={[styles.actions, { paddingBottom: bottomPad + 80 }]}>
        <Pressable
          onPress={swipeLeft}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.dislikeBtn,
            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
          ]}
        >
          <Feather name="x" size={26} color={Colors.dislike} />
        </Pressable>

        <Pressable
          onPress={toggleInfo}
          style={({ pressed }) => [
            styles.actionBtnSm,
            styles.infoBtn,
            isInfoVisible && styles.infoBtnActive,
            { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <Feather name="info" size={20} color={Colors.info} />
        </Pressable>

        <Pressable
          onPress={swipeRight}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.likeBtn,
            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
          ]}
        >
          <Feather name="heart" size={26} color={Colors.like} />
        </Pressable>
      </View>

      <Modal
        visible={showInsight}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInsight(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Feather name="zap" size={22} color={Colors.primaryLight} />
              </View>
              <Text style={styles.modalTitle}>
                {t("Insight de mejora", "Improvement Insight")}
              </Text>
              <Text style={styles.modalSub}>
                {t(
                  `Basado en ${lastLikedProfile?.name ?? ""}, estas metas pueden aumentar tu atractivo`,
                  `Based on ${lastLikedProfile?.name ?? ""}, these goals may boost your appeal`
                )}
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 260 }}
              showsVerticalScrollIndicator={false}
            >
              {relatedGoals.map((item: any, index: number) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightItemLeft}>
                    <Feather name="target" size={16} color={Colors.primaryLight} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightGoalTitle}>
                        {t(item.goal.titleEs, item.goal.titleEn)}
                      </Text>
                      <Text style={styles.insightReason}>
                        {t(item.reason.es, item.reason.en)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.insightProgress}>
                    <Text style={styles.insightProgressText}>
                      {item.goal.progress}%
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setShowInsight(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>
                {t("Continuar explorando", "Keep exploring")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 12,
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
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cardBase: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    position: "absolute",
    backgroundColor: Colors.backgroundCard,
  },
  cardInteractive: {
    zIndex: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  cardSecond: {
    zIndex: 2,
    transform: [{ scale: 0.95 }, { translateY: 16 }],
    opacity: 0.85,
  },
  cardThird: {
    zIndex: 1,
    transform: [{ scale: 0.9 }, { translateY: 32 }],
    opacity: 0.6,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
  },
  cardFaceFront: {
    backgroundColor: Colors.backgroundCard,
  },
  cardFaceBack: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  dislikeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  stampContainer: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  likeStamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.like,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dislikeStamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dislike,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  stampText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: 1,
  },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
    zIndex: 3,
  },
  insightTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  insightTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(82,183,136,0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.35)",
  },
  insightTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryLight,
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardLocation: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cardDot: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  cardOccupation: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  interestsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.text,
  },
  backHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backInfoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  backName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  backMeta: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  backScroll: {
    flex: 1,
  },
  backScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 20,
  },
  backSection: {
    gap: 12,
  },
  backSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoRowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  infoRowBody: {
    flex: 1,
    gap: 2,
  },
  infoRowLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoRowValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  flagImageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    paddingTop: 2,
  },
  flagImage: {
    width: 26,
    height: 18,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.backgroundElevated,
  },
  flagFallback: {
    width: 26,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  lifestyleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  lifestyleTile: {
    width: "31%",
    minHeight: 118,
    borderRadius: 16,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  lifestyleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lifestyleTileLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  lifestyleTileValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.text,
    textAlign: "center",
    lineHeight: 17,
  },
  physicalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  physicalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  physicalBody: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  dislikeBtn: {
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.dislike,
  },
  likeBtn: {
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.like,
  },
  actionBtnSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    borderColor: "rgba(90,169,255,0.38)",
    backgroundColor: Colors.infoOverlay,
  },
  infoBtnActive: {
    borderColor: Colors.info,
    backgroundColor: "rgba(90,169,255,0.24)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  insightItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  insightGoalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  insightReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  insightProgress: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  insightProgressText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  modalClose: {
    marginTop: 20,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalCloseText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.textInverted,
  },
});
