import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    name: "Alejandro",
    age: 31,
    location: "Madrid, España",
    bodyType: "Atlético",
    height: "1.82m",
    interests: ["Fitness", "Viajes", "Fotografía"],
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
    score: 87,
  },
  {
    id: "2",
    name: "Mateo",
    age: 28,
    location: "Buenos Aires, AR",
    bodyType: "Musculoso",
    height: "1.79m",
    interests: ["Running", "Emprendimiento", "Surf"],
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80",
    score: 82,
  },
  {
    id: "3",
    name: "Carlos",
    age: 34,
    location: "Ciudad de México",
    bodyType: "Atlético",
    height: "1.76m",
    interests: ["Arte", "Cocinar", "Música"],
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
    score: 79,
  },
  {
    id: "4",
    name: "Sebastián",
    age: 29,
    location: "Bogotá, Colombia",
    bodyType: "Delgado",
    height: "1.80m",
    interests: ["Yoga", "Lectura", "Naturaleza"],
    image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&q=80",
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
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
        }
      },
    })
  ).current;

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
            </View>
            <View style={styles.attributeRow}>
              <View style={styles.attributeChip}>
                <Text style={styles.attributeText}>{topProfile.bodyType}</Text>
              </View>
              <View style={styles.attributeChip}>
                <Text style={styles.attributeText}>{topProfile.height}</Text>
              </View>
            </View>
            <View style={styles.interestRow}>
              {topProfile.interests.map((interest) => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
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
          </View>
        </View>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
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
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
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
  },
});
