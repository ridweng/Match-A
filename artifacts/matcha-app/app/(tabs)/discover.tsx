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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  GENDER_IDENTITIES,
  getAlcoholUseLabel,
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getEthnicityLabel,
  getGenderIdentityLabel,
  getHairColorLabel,
  getPhysicalActivityLabel,
  getPoliticalInterestLabel,
  getPronounLabel,
  getRelationshipGoalLabel,
  getReligionImportanceLabel,
  getReligionLabel,
  getTobaccoUseLabel,
} from "@/constants/profile-options";
import { useApp } from "@/context/AppContext";
import { discoverProfiles, type DiscoverProfile } from "@/data/profiles";
import { getZodiacSignFromIsoDate, getZodiacSignLabel } from "@/utils/dateOfBirth";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.62;
const SWIPE_THRESHOLD = 80;
const INFO_SWIPE_THRESHOLD = 82;
const IS_WEB = Platform.OS === "web";

type SwipeState = "idle" | "like" | "dislike";
type FeatherName = React.ComponentProps<typeof Feather>["name"];
type DiscoveryFilters = {
  genderIdentity: string | null;
  ageMin: number;
  ageMax: number;
};
type AgeBounds = {
  min: number;
  max: number;
};

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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function filtersEqual(a: DiscoveryFilters, b: DiscoveryFilters) {
  return (
    a.genderIdentity === b.genderIdentity &&
    a.ageMin === b.ageMin &&
    a.ageMax === b.ageMax
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string | null; label: string }>;
  placeholder: string;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.filterField, open && styles.filterFieldOpen]}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={[styles.filterSelectWrap, open && styles.filterSelectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={styles.filterSelectField}
        >
          <Text style={styles.filterSelectValue}>
            {options.find((option) => option.value === value)?.label || placeholder}
          </Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.textSecondary}
          />
        </Pressable>
        {open ? (
          <View style={styles.filterDropdown}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value ?? "__all__"}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.filterDropdownOption,
                    selected && styles.filterDropdownOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterDropdownOptionText,
                      selected && styles.filterDropdownOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={14} color={Colors.primaryLight} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AgeRangeFields({
  bounds,
  valueMin,
  valueMax,
  onChange,
  t,
}: {
  bounds: AgeBounds;
  valueMin: number;
  valueMax: number;
  onChange: (nextMin: number, nextMax: number) => void;
  t: (es: string, en: string) => string;
}) {
  const [minText, setMinText] = useState(String(valueMin));
  const [maxText, setMaxText] = useState(String(valueMax));

  React.useEffect(() => {
    setMinText(String(valueMin));
  }, [valueMin]);

  React.useEffect(() => {
    setMaxText(String(valueMax));
  }, [valueMax]);

  const commitMin = React.useCallback(
    (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      if (!digits) {
        setMinText(String(valueMin));
        return;
      }

      const nextMin = clampNumber(Number(digits), bounds.min, valueMax);
      setMinText(String(nextMin));
      onChange(nextMin, valueMax);
    },
    [bounds.min, onChange, valueMax, valueMin]
  );

  const commitMax = React.useCallback(
    (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      if (!digits) {
        setMaxText(String(valueMax));
        return;
      }

      const nextMax = clampNumber(Number(digits), valueMin, bounds.max);
      setMaxText(String(nextMax));
      onChange(valueMin, nextMax);
    },
    [bounds.max, onChange, valueMax, valueMin]
  );

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{t("Rango de edad", "Age range")}</Text>
      <View style={styles.ageNumberRow}>
        <View style={styles.ageNumberField}>
          <Text style={styles.ageNumberLabel}>{t("Mínima", "Minimum")}</Text>
          <TextInput
            value={minText}
            onChangeText={(value) => setMinText(value.replace(/\D/g, ""))}
            onBlur={() => commitMin(minText)}
            onEndEditing={() => commitMin(minText)}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={styles.ageNumberInput}
            placeholder="18"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primaryLight}
            maxLength={3}
          />
        </View>
        <View style={styles.ageNumberField}>
          <Text style={styles.ageNumberLabel}>{t("Máxima", "Maximum")}</Text>
          <TextInput
            value={maxText}
            onChangeText={(value) => setMaxText(value.replace(/\D/g, ""))}
            onBlur={() => commitMax(maxText)}
            onEndEditing={() => commitMax(maxText)}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={styles.ageNumberInput}
            placeholder="40"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primaryLight}
            maxLength={3}
          />
        </View>
      </View>
      <Text style={styles.ageRangeHint}>
        {t("Solo números entre 18 y 100", "Numbers only between 18 and 100")}
      </Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { t, likeProfile, goals, language } = useApp();
  const ageBounds = useMemo<AgeBounds>(() => ({ min: 18, max: 100 }), []);
  const defaultFilters = useMemo<DiscoveryFilters>(
    () => ({
      genderIdentity: null,
      ageMin: 18,
      ageMax: 40,
    }),
    []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>("idle");
  const [showInsight, setShowInsight] = useState(false);
  const [lastLikedProfile, setLastLikedProfile] = useState<DiscoverProfile | null>(null);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DiscoveryFilters>(
    defaultFilters
  );
  const [draftFilters, setDraftFilters] = useState<DiscoveryFilters>(defaultFilters);

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
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [1, 1, 0, 0],
    extrapolate: "clamp",
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: "clamp",
  });

  const filteredProfiles = useMemo(
    () =>
      discoverProfiles.filter((profile) => {
        if (
          appliedFilters.genderIdentity &&
          profile.genderIdentity !== appliedFilters.genderIdentity
        ) {
          return false;
        }
        return (
          profile.age >= appliedFilters.ageMin &&
          profile.age <= appliedFilters.ageMax
        );
      }),
    [appliedFilters]
  );
  const hasProfiles = filteredProfiles.length > 0;
  const safeIndex = hasProfiles ? currentIndex % filteredProfiles.length : 0;
  const current = hasProfiles ? filteredProfiles[safeIndex] : null;
  const next =
    filteredProfiles.length > 1
      ? filteredProfiles[(safeIndex + 1) % filteredProfiles.length]
      : null;
  const nextNext =
    filteredProfiles.length > 2
      ? filteredProfiles[(safeIndex + 2) % filteredProfiles.length]
      : null;
  const currentImages = current?.images ?? [];
  const currentImage =
    currentImages[Math.min(activePhotoIndex, currentImages.length - 1)] ??
    currentImages[0];
  const pronounLabel = current
    ? getPronounLabel(current.pronouns, language)
    : "";
  const zodiacLabel = getZodiacSignLabel(
    getZodiacSignFromIsoDate(current?.dateOfBirth ?? ""),
    t
  );
  const ageWithSign = current
    ? zodiacLabel
      ? `${current.age} · ${zodiacLabel}`
      : String(current.age)
    : "";
  const hasActiveFilters = !filtersEqual(appliedFilters, defaultFilters);
  const canApplyFilters = !filtersEqual(draftFilters, appliedFilters);
  const filterOptions = useMemo(
    () => [
      {
        value: null,
        label: t("Todas las identidades", "All identities"),
      },
      ...GENDER_IDENTITIES.map((value) => ({
        value,
        label: getGenderIdentityLabel(value, t),
      })),
    ],
    [t]
  );

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

  React.useEffect(() => {
    setActivePhotoIndex(0);
  }, [currentIndex]);

  React.useEffect(() => {
    if (filteredProfiles.length === 0) {
      setCurrentIndex(0);
      setActivePhotoIndex(0);
      return;
    }

    if (currentIndex >= filteredProfiles.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, filteredProfiles.length]);

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
    setActivePhotoIndex(0);
    setIsInfoVisible(false);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const stepPhoto = (direction: "prev" | "next") => {
    if (currentImages.length <= 1) {
      return;
    }

    setActivePhotoIndex((prev) => {
      const nextIndex =
        direction === "next"
          ? Math.min(prev + 1, currentImages.length - 1)
          : Math.max(prev - 1, 0);

      if (nextIndex !== prev) {
        Haptics.selectionAsync().catch(() => {});
      }

      return nextIndex;
    });
  };

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setIsFilterVisible(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setCurrentIndex(0);
    resetCardState();
    setIsFilterVisible(false);
  };

  const clearFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setCurrentIndex(0);
    resetCardState();
    setIsFilterVisible(false);
  };

  const swipeRight = () => {
    if (!current) {
      return;
    }
    const profile = current;
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
        filteredProfiles.length > 1 ? (prev + 1) % filteredProfiles.length : 0
      );
    });
  };

  const swipeLeft = () => {
    if (!current) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      resetCardState();
      setCurrentIndex((prev) =>
        filteredProfiles.length > 1 ? (prev + 1) % filteredProfiles.length : 0
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
          <Pressable
            onPress={openFilters}
            style={({ pressed }) => [
              styles.filterBtn,
              hasActiveFilters && styles.filterBtnActive,
              pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Feather name="sliders" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {hasProfiles && current ? (
        <>
          <View style={styles.cardStack}>
            {nextNext ? (
              <View style={[styles.cardBase, styles.cardThird]}>
                <Image
                  source={{ uri: nextNext.images[0] }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {next ? (
              <View style={[styles.cardBase, styles.cardSecond]}>
                <Image
                  source={{ uri: next.images[0] }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

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
                  IS_WEB
                    ? {
                        opacity: frontOpacity,
                        zIndex: isInfoVisible ? 1 : 3,
                      }
                    : {
                        transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
                      },
                ]}
              >
                <Image
                  source={{ uri: currentImage }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />

                <View style={styles.photoTapLayer} pointerEvents="box-none">
                  <Pressable
                    onPress={() => stepPhoto("prev")}
                    style={styles.photoTapZone}
                  />
                  <Pressable
                    onPress={() => stepPhoto("next")}
                    style={styles.photoTapZone}
                  />
                </View>

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
                  {pronounLabel ? (
                    <Text style={styles.cardPronouns}>{pronounLabel}</Text>
                  ) : null}
                  <Text style={styles.cardName}>{current.name}</Text>
                  <Text style={styles.cardAgeSign}>{ageWithSign}</Text>
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
                      <View
                        key={`${current.id}-${interest}`}
                        style={styles.interestChip}
                      >
                        <Text style={styles.interestChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>

                  {currentImages.length > 1 ? (
                    <View style={styles.photoDotsRow}>
                      {currentImages.map((_, index) => (
                        <View
                          key={`${current.id}-photo-dot-${index}`}
                          style={[
                            styles.photoDot,
                            index === activePhotoIndex && styles.photoDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </LinearGradient>
              </Animated.View>

              <Animated.View
                pointerEvents={isInfoVisible ? "auto" : "none"}
                style={[
                  styles.cardFace,
                  styles.cardFaceBack,
                  IS_WEB
                    ? {
                        opacity: backOpacity,
                        zIndex: isInfoVisible ? 3 : 1,
                      }
                    : {
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
                      value={getChildrenPreferenceLabel(
                        current.about.childrenPreference,
                        t
                      )}
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
                        value={getPhysicalActivityLabel(
                          current.lifestyle.physicalActivity,
                          t
                        )}
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
                        value={getPoliticalInterestLabel(
                          current.lifestyle.politicalInterest,
                          t
                        )}
                      />
                      <LifestyleTile
                        icon="star"
                        label={t("Religión", "Religion")}
                        value={getReligionImportanceLabel(
                          current.lifestyle.religionImportance,
                          t
                        )}
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
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
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
                {
                  opacity: pressed ? 0.75 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Feather name="info" size={20} color={Colors.info} />
            </Pressable>

            <Pressable
              onPress={swipeRight}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.likeBtn,
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.93 : 1 }],
                },
              ]}
            >
              <Feather name="heart" size={26} color={Colors.like} />
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Feather name="sliders" size={24} color={Colors.info} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t("Cambia los valores del filtro", "Change your filter values")}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {t(
                "No encontramos perfiles con esa combinación.",
                "We could not find profiles with that combination."
              )}
            </Text>
            <Pressable
              onPress={clearFilters}
              style={({ pressed }) => [
                styles.emptyCardButton,
                pressed && { opacity: 0.84 },
              ]}
            >
              <Text style={styles.emptyCardButtonText}>
                {t("Limpiar filtros", "Clear filters")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterVisible(false)}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={() => setIsFilterVisible(false)}
          />
          <View style={[styles.filterSheet, { top: topPad + 6 }]}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>{t("Filtros", "Filters")}</Text>
                <Text style={styles.filterSheetSub}>
                  {t(
                    "Ajusta interés y rango de edad",
                    "Adjust interest and age range"
                  )}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsFilterVisible(false)}
                style={({ pressed }) => [styles.filterCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <FilterSelect
              label={t("Interés", "Interest")}
              value={draftFilters.genderIdentity}
              options={filterOptions}
              placeholder={t("Todas las identidades", "All identities")}
              onChange={(value) =>
                setDraftFilters((current) => ({ ...current, genderIdentity: value }))
              }
            />

            <AgeRangeFields
              bounds={ageBounds}
              valueMin={draftFilters.ageMin}
              valueMax={draftFilters.ageMax}
              onChange={(ageMin, ageMax) =>
                setDraftFilters((current) => ({ ...current, ageMin, ageMax }))
              }
              t={t}
            />

            <View style={styles.filterFooter}>
              <Pressable
                onPress={clearFilters}
                style={({ pressed }) => [
                  styles.filterFooterBtn,
                  styles.filterFooterBtnSecondary,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.filterFooterBtnSecondaryText}>
                  {t("Limpiar", "Clear")}
                </Text>
              </Pressable>
              <Pressable
                onPress={applyFilters}
                disabled={!canApplyFilters}
                style={({ pressed }) => [
                  styles.filterFooterBtn,
                  canApplyFilters
                    ? styles.filterFooterBtnPrimary
                    : styles.filterFooterBtnPrimaryDisabled,
                  pressed && canApplyFilters && { opacity: 0.84 },
                ]}
              >
                <Text
                  style={[
                    styles.filterFooterBtnPrimaryText,
                    !canApplyFilters && styles.filterFooterBtnPrimaryTextDisabled,
                  ]}
                >
                  {t("Aplicar", "Apply")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  filterBtnActive: {
    borderColor: "rgba(90,169,255,0.35)",
    backgroundColor: Colors.infoOverlay,
  },
  filterModalRoot: {
    flex: 1,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,10,8,0.48)",
  },
  filterSheet: {
    position: "absolute",
    right: 16,
    width: Math.min(width - 32, 340),
    borderRadius: 24,
    padding: 18,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 18,
    gap: 16,
  },
  filterSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  filterSheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  filterSheetSub: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterField: {
    gap: 8,
  },
  filterFieldOpen: {
    zIndex: 20,
  },
  filterLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  filterSelectWrap: {
    position: "relative",
  },
  filterSelectWrapOpen: {
    zIndex: 10,
  },
  filterSelectField: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterSelectValue: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  filterDropdown: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    overflow: "hidden",
  },
  filterDropdownOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterDropdownOptionActive: {
    backgroundColor: Colors.surface,
  },
  filterDropdownOptionText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  filterDropdownOptionTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primaryLight,
  },
  ageNumberRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ageNumberField: {
    flex: 1,
    gap: 6,
  },
  ageNumberLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ageNumberInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.text,
  },
  ageRangeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  filterFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  filterFooterBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterFooterBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterFooterBtnPrimary: {
    backgroundColor: Colors.info,
  },
  filterFooterBtnPrimaryDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterFooterBtnSecondaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  filterFooterBtnPrimaryText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  filterFooterBtnPrimaryTextDisabled: {
    color: Colors.textMuted,
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
  emptyCard: {
    position: "relative",
    paddingHorizontal: 28,
    paddingVertical: 34,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCardIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCardTitle: {
    marginTop: 18,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  emptyCardCopy: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyCardButton: {
    marginTop: 22,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: Colors.info,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCardButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
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
    backfaceVisibility: IS_WEB ? "visible" : "hidden",
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
  photoTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    flexDirection: "row",
  },
  photoTapZone: {
    flex: 1,
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
    paddingTop: 86,
    zIndex: 3,
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  cardPronouns: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.ivoryDim,
    marginBottom: 4,
  },
  cardAgeSign: {
    marginTop: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primaryLight,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
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
    backgroundColor: "rgba(82,183,136,0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.35)",
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  photoDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  photoDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(245,243,238,0.28)",
  },
  photoDotActive: {
    width: 18,
    backgroundColor: Colors.text,
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
