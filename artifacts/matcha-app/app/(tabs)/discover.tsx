<<<<<<< HEAD
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
=======
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
>>>>>>> f81a9b8 (second try)
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
<<<<<<< HEAD
=======
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 1.45;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

type SwipeState = "neutral" | "like" | "dislike";

const DISCOVER_PROFILES = [
  {
    id: "1",
    name: "Sofía",
    age: 27,
    location: "Madrid, España",
    occupation: "Diseñadora UX",
    interests: ["Yoga", "Viajes", "Arte"],
    lookingFor: ["Deportivo", "Seguro de sí mismo", "Cuida su apariencia"],
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
    score: 91,
  },
  {
    id: "2",
    name: "Valentina",
    age: 29,
    location: "Buenos Aires, AR",
    occupation: "Arquitecta",
    interests: ["Lectura", "Cocinar", "Fotografía"],
    lookingFor: ["Inteligencia emocional", "Buen comunicador", "Disciplinado"],
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
    score: 86,
  },
  {
    id: "3",
    name: "Isabella",
    age: 31,
    location: "Ciudad de México",
    occupation: "Médica",
    interests: ["Running", "Naturaleza", "Música"],
    lookingFor: ["Buena postura", "Hábitos saludables", "Presencia"],
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    score: 83,
  },
  {
    id: "4",
    name: "Camila",
    age: 28,
    location: "Bogotá, Colombia",
    occupation: "Emprendedora",
    interests: ["Fitness", "Podcast", "Emprendimiento"],
    lookingFor: ["Ambicioso", "Deportivo", "Bien vestido"],
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
    score: 79,
  },
  {
    id: "5",
    name: "Gabriela",
    age: 33,
    location: "Lima, Perú",
    occupation: "Psicóloga",
    interests: ["Meditación", "Senderismo", "Cine"],
    lookingFor: ["Inteligencia emocional", "Seguro de sí mismo", "Honesto"],
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
    score: 88,
  },
  {
    id: "6",
    name: "Natalia",
    age: 26,
    location: "Santiago, Chile",
    occupation: "Periodista",
    interests: ["Surf", "Escritura", "Gastronomía"],
    lookingFor: ["Buen comunicador", "Arreglado", "Con iniciativa"],
    image: "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=600&q=80",
    score: 75,
  },
];

function ScoreChip({ score }: { score: number }) {
  return (
    <View style={styles.scoreChip}>
      <Ionicons name="sparkles" size={12} color={colors.gold} />
      <Text style={styles.scoreText}>{score}</Text>
    </View>
  );
}

function CardStack({
  profiles,
  onSwipeLeft,
  onSwipeRight,
}: {
  profiles: typeof DISCOVER_PROFILES;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [swipeState, setSwipeState] = useState<SwipeState>("neutral");
  const pan = useRef(new Animated.ValueXY()).current;
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const dislikeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
=======
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { discoverProfiles } from "@/data/profiles";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.62;
const SWIPE_THRESHOLD = 80;

type SwipeState = "idle" | "like" | "dislike";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { t, likeProfile, goals } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>("idle");
  const [showInsight, setShowInsight] = useState(false);
  const [lastLikedProfile, setLastLikedProfile] = useState<string | null>(null);

  const position = useRef(new Animated.ValueXY()).current;
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
>>>>>>> f81a9b8 (second try)
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
<<<<<<< HEAD
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.3 });
        if (gestureState.dx > SWIPE_THRESHOLD * 0.5) {
          setSwipeState("like");
        } else if (gestureState.dx < -SWIPE_THRESHOLD * 0.5) {
          setSwipeState("dislike");
        } else {
          setSwipeState("neutral");
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(pan, {
            toValue: { x: SCREEN_WIDTH * 1.5, y: gestureState.dy * 0.3 },
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            setSwipeState("neutral");
            onSwipeRight();
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.spring(pan, {
            toValue: { x: -SCREEN_WIDTH * 1.5, y: gestureState.dy * 0.3 },
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            setSwipeState("neutral");
            onSwipeLeft();
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 8,
            useNativeDriver: true,
          }).start();
          setSwipeState("neutral");
=======
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        if (gesture.dx > 40) setSwipeState("like");
        else if (gesture.dx < -40) setSwipeState("dislike");
        else setSwipeState("idle");
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
          setSwipeState("idle");
>>>>>>> f81a9b8 (second try)
        }
      },
    })
  ).current;

<<<<<<< HEAD
  if (profiles.length === 0) return null;
  const topProfile = profiles[0];
  const nextProfile = profiles[1];
  const thirdProfile = profiles[2];

  return (
    <View style={styles.cardStack}>
      {thirdProfile && (
        <View
          style={[
            styles.card,
            styles.cardBehind2,
            { width: CARD_WIDTH, height: CARD_HEIGHT },
          ]}
        >
          <Image
            source={{ uri: thirdProfile.image }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(8,20,12,0.95)"]}
            style={styles.cardGradient}
          />
        </View>
      )}
      {nextProfile && (
        <View
          style={[
            styles.card,
            styles.cardBehind1,
            { width: CARD_WIDTH, height: CARD_HEIGHT },
          ]}
        >
          <Image
            source={{ uri: nextProfile.image }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(8,20,12,0.95)"]}
            style={styles.cardGradient}
          />
        </View>
      )}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { rotate },
            ],
          },
        ]}
      >
        <Image
          source={{ uri: topProfile.image }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(8,20,12,0.97)"]}
          style={styles.cardGradient}
        />

        <Animated.View
          style={[styles.swipeOverlay, styles.likeOverlay, { opacity: likeOpacity }]}
        >
          <View style={styles.stampBadge}>
            <Feather name="check" size={28} color={colors.likeGreen} />
            <Text style={[styles.stampText, { color: colors.likeGreen }]}>
              INTERESANTE
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.swipeOverlay,
            styles.dislikeOverlay,
            { opacity: dislikeOpacity },
          ]}
        >
          <View style={styles.stampBadge}>
            <Feather name="x" size={28} color={colors.dislikeRed} />
            <Text style={[styles.stampText, { color: colors.dislikeRed }]}>
              PASAR
            </Text>
          </View>
        </Animated.View>

        <View style={styles.cardContent}>
          <ScoreChip score={topProfile.score} />
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{topProfile.name}</Text>
              <Text style={styles.cardAge}>{topProfile.age}</Text>
            </View>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.muted} />
              <Text style={styles.cardLocation}>{topProfile.location}</Text>
              <Text style={styles.cardOccupation}> · {topProfile.occupation}</Text>
            </View>
            <View style={styles.interestRow}>
              {topProfile.interests.map((interest) => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
            <View style={styles.lookingForSection}>
              <View style={styles.lookingForHeader}>
                <Ionicons name="sparkles" size={11} color={colors.gold} />
                <Text style={styles.lookingForLabel}>Busca en un hombre</Text>
              </View>
              <View style={styles.lookingForRow}>
                {topProfile.lookingFor.map((trait) => (
                  <View key={trait} style={styles.lookingForChip}>
                    <Text style={styles.lookingForText}>{trait}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const t = getTranslations(language).discover;
  const [profiles, setProfiles] = useState(DISCOVER_PROFILES);

  const handleSwipeLeft = () => {
    setProfiles((prev) => prev.slice(1));
  };

  const handleSwipeRight = () => {
    setProfiles((prev) => prev.slice(1));
  };

  const handleDislike = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfiles((prev) => prev.slice(1));
  };

  const handleLike = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProfiles((prev) => prev.slice(1));
  };

  const handleReset = () => {
    setProfiles(DISCOVER_PROFILES);
  };

  const topPadding =
    insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding =
    insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View
      style={[styles.container, { paddingTop: topPadding }]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.header}</Text>
        <View style={styles.headerRight}>
          <View style={styles.profileCountBadge}>
            <Text style={styles.profileCountText}>{profiles.length}</Text>
=======
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const swipeRight = () => {
    const profile = discoverProfiles[currentIndex];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      likeProfile(profile.id);
      setLastLikedProfile(profile.id);
      setShowInsight(true);
      setSwipeState("idle");
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) =>
        prev < discoverProfiles.length - 1 ? prev + 1 : 0
      );
    });
  };

  const swipeLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setSwipeState("idle");
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) =>
        prev < discoverProfiles.length - 1 ? prev + 1 : 0
      );
    });
  };

  const current = discoverProfiles[currentIndex];
  const next =
    discoverProfiles[(currentIndex + 1) % discoverProfiles.length];
  const nextNext =
    discoverProfiles[(currentIndex + 2) % discoverProfiles.length];

  const likedProfile = lastLikedProfile
    ? discoverProfiles.find((p) => p.id === lastLikedProfile)
    : null;

  const relatedGoals = likedProfile
    ? likedProfile.goalFeedback.map((gf) => {
        const goal = goals.find((g) => g.id === gf.goalId);
        return { goal, reason: gf.reason };
      })
    : [];

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
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
>>>>>>> f81a9b8 (second try)
          </View>
        </View>
      </View>

<<<<<<< HEAD
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {profiles.length > 0 ? (
          <>
            <CardStack
              profiles={profiles}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.dislikeBtn,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={handleDislike}
              >
                <Feather name="x" size={28} color={colors.dislikeRed} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.infoBtn,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Ionicons name="sparkles" size={18} color={colors.gold} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.likeBtn,
                  pressed && styles.actionBtnPressed,
                ]}
                onPress={handleLike}
              >
                <Feather name="check" size={28} color={colors.likeGreen} />
              </Pressable>
            </View>

            <Text style={styles.swipeHint}>
              Desliza para explorar · Swipe to explore
            </Text>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles-outline" size={40} color={colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>{t.noMore}</Text>
            <Text style={styles.emptySubtitle}>{t.noMoreSub}</Text>
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.resetBtnText}>Explorar de nuevo</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
=======
      {/* Card Stack */}
      <View style={styles.cardStack}>
        {/* Third card (background) */}
        <View style={[styles.cardBase, styles.cardThird]}>
          <Image
            source={{ uri: nextNext.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>

        {/* Second card */}
        <View style={[styles.cardBase, styles.cardSecond]}>
          <Image
            source={{ uri: next.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </View>

        {/* Front card (interactive) */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.cardBase,
            styles.cardFront,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: current.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />

          {/* Like overlay */}
          <Animated.View
            style={[styles.likeOverlay, { opacity: likeOpacity }]}
          >
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

          {/* Dislike overlay */}
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

          {/* Card info gradient */}
          <LinearGradient
            colors={["transparent", "rgba(15,26,20,0.98)"]}
            style={styles.cardGradient}
          >
            {/* Insight tags */}
            <View style={styles.insightTags}>
              {current.insightTags.map((tag) => (
                <View key={tag} style={styles.insightTag}>
                  <Text style={styles.insightTagText}>{tag}</Text>
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
              <Text style={styles.cardOccupation}>{current.occupation}</Text>
            </View>

            {/* Interests */}
            <View style={styles.interestsRow}>
              {current.attributes.interests.slice(0, 3).map((i) => (
                <View key={i} style={styles.interestChip}>
                  <Text style={styles.interestChipText}>{i}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
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
          style={({ pressed }) => [
            styles.actionBtnSm,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="star" size={20} color={Colors.accent} />
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

      {/* Insight modal */}
      {showInsight && likedProfile && (
        <Pressable
          style={styles.insightOverlay}
          onPress={() => setShowInsight(false)}
        >
          <View style={styles.insightModal}>
            <View style={styles.insightHeader}>
              <View style={styles.insightIconWrap}>
                <Feather name="zap" size={20} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>
                  {t("Insight de mejora", "Improvement Insight")}
                </Text>
                <Text style={styles.insightSubtitle}>
                  {t(
                    `Aprendiste de ${likedProfile.name}`,
                    `You learned from ${likedProfile.name}`
                  )}
                </Text>
              </View>
              <Pressable onPress={() => setShowInsight(false)}>
                <Feather name="x" size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {relatedGoals.map(
              ({ goal, reason }) =>
                goal && (
                  <View key={goal.id} style={styles.insightItem}>
                    <View style={styles.insightItemHeader}>
                      <Feather
                        name="target"
                        size={14}
                        color={Colors.primaryLight}
                      />
                      <Text style={styles.insightGoalTitle}>
                        {t(goal.titleEs, goal.titleEn)}
                      </Text>
                    </View>
                    <Text style={styles.insightReason}>{reason}</Text>
                    <View style={styles.insightImpact}>
                      <Feather
                        name="trending-up"
                        size={12}
                        color={Colors.accent}
                      />
                      <Text style={styles.insightImpactText}>
                        {t(goal.impactEs, goal.impactEn)}
                      </Text>
                    </View>
                  </View>
                )
            )}

            <Pressable
              style={styles.insightCta}
              onPress={() => setShowInsight(false)}
            >
              <Text style={styles.insightCtaText}>
                {t("Ver mis metas", "View my goals")}
              </Text>
              <Feather name="arrow-right" size={16} color={Colors.textInverted} />
            </Pressable>
          </View>
        </Pressable>
      )}
>>>>>>> f81a9b8 (second try)
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
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileCountBadge: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  profileCountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.muted,
  },
  scroll: {
    alignItems: "center",
    paddingTop: 8,
  },
  cardStack: {
    alignItems: "center",
    justifyContent: "center",
    height: CARD_HEIGHT + 20,
    marginBottom: 16,
  },
  card: {
    position: "absolute",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.cardBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBehind1: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.8,
  },
  cardBehind2: {
    transform: [{ scale: 0.9 }, { translateY: 20 }],
    opacity: 0.5,
  },
=======
    paddingBottom: 16,
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
    gap: 10,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardBase: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    position: "absolute",
    backgroundColor: Colors.backgroundCard,
  },
  cardFront: {
    zIndex: 3,
    elevation: 5,
  },
  cardSecond: {
    zIndex: 2,
    transform: [{ scale: 0.95 }, { translateY: 14 }],
    opacity: 0.75,
  },
  cardThird: {
    zIndex: 1,
    transform: [{ scale: 0.9 }, { translateY: 28 }],
    opacity: 0.5,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  dislikeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  stampContainer: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: 24,
  },
  likeStamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.like,
    backgroundColor: "rgba(82,183,136,0.2)",
    transform: [{ rotate: "-12deg" }],
  },
  dislikeStamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dislike,
    backgroundColor: "rgba(230,57,70,0.2)",
    transform: [{ rotate: "12deg" }],
    alignSelf: "flex-end",
  },
  stampText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: 2,
  },
>>>>>>> f81a9b8 (second try)
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
<<<<<<< HEAD
    height: "60%",
  },
  swipeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  likeOverlay: {
    backgroundColor: "rgba(56,161,105,0.1)",
    borderWidth: 3,
    borderColor: colors.likeGreen,
  },
  dislikeOverlay: {
    backgroundColor: "rgba(229,62,62,0.1)",
    borderWidth: 3,
    borderColor: colors.dislikeRed,
  },
  stampBadge: {
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(13,34,24,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  stampText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 3,
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  scoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13,34,24,0.8)",
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
    position: "absolute",
    top: -CARD_HEIGHT + 60,
    right: 20,
  },
  scoreText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: colors.gold,
  },
  cardInfo: {
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
=======
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 24,
    gap: 6,
  },
  insightTags: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  insightTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(82,183,136,0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.3)",
  },
  insightTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryLight,
>>>>>>> f81a9b8 (second try)
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
<<<<<<< HEAD
    color: colors.ivory,
  },
  cardAge: {
    fontFamily: "Inter_500Medium",
    fontSize: 20,
    color: colors.ivoryDim,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardLocation: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  cardOccupation: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.slateLight,
  },
  lookingForSection: {
    marginTop: 4,
    gap: 6,
    backgroundColor: "rgba(8,20,12,0.6)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
  },
  lookingForHeader: {
=======
    color: Colors.text,
    letterSpacing: -0.5,
  },
  cardRow: {
>>>>>>> f81a9b8 (second try)
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
<<<<<<< HEAD
  lookingForLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  lookingForRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  lookingForChip: {
    backgroundColor: "rgba(76,175,114,0.18)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.35)",
  },
  lookingForText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: colors.goldLight,
  },
  attributeRow: {
    flexDirection: "row",
    gap: 8,
  },
  attributeChip: {
    backgroundColor: "rgba(76,175,114,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
  },
  attributeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.goldLight,
  },
  interestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  interestChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  interestText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.ivoryDim,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnPressed: {
    transform: [{ scale: 0.93 }],
  },
  dislikeBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: "rgba(229,62,62,0.3)",
  },
  likeBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: "rgba(56,161,105,0.3)",
  },
  infoBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: "rgba(76,175,114,0.25)",
  },
  swipeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.slateLight,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: colors.ivory,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  resetBtn: {
    marginTop: 8,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  resetBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.navy,
=======
  cardLocation: {
    fontFamily: "Inter_500Medium",
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
    color: Colors.textMuted,
  },
  interestsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  actionBtnSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dislikeBtn: {
    backgroundColor: "rgba(230,57,70,0.08)",
    borderColor: "rgba(230,57,70,0.3)",
  },
  likeBtn: {
    backgroundColor: "rgba(82,183,136,0.08)",
    borderColor: "rgba(82,183,136,0.3)",
  },
  insightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,26,20,0.85)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  insightModal: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insightIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
  },
  insightSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  insightItem: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightGoalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  insightReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  insightImpact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  insightImpactText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  insightCta: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  insightCtaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.textInverted,
>>>>>>> f81a9b8 (second try)
  },
});
