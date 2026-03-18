import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
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
import { useApp } from "@/context/AppContext";
import { discoverProfiles, type DiscoverProfile } from "@/data/profiles";

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
  const [lastLikedProfile, setLastLikedProfile] = useState<DiscoverProfile | null>(null);

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
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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
      setLastLikedProfile(profile);
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
        }
      },
    })
  ).current;

  const current = discoverProfiles[currentIndex];
  const next = discoverProfiles[(currentIndex + 1) % discoverProfiles.length];
  const nextNext = discoverProfiles[(currentIndex + 2) % discoverProfiles.length];

  const relatedGoals = lastLikedProfile
    ? lastLikedProfile.goalFeedback
        .map((gf) => {
          const goal = goals.find((g) => g.id === gf.goalId);
          return goal ? { goal, reason: gf.reason } : null;
        })
        .filter(Boolean)
    : [];

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

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
              {relatedGoals.map((item: any, i: number) => (
                <View key={i} style={styles.insightItem}>
                  <View style={styles.insightItemLeft}>
                    <Feather
                      name="target"
                      size={16}
                      color={Colors.primaryLight}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightGoalTitle}>
                        {t(item.goal.titleEs, item.goal.titleEn)}
                      </Text>
                      <Text style={styles.insightReason}>{item.reason}</Text>
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
  cardFront: {
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
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
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
