import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { KeyboardSheet } from "@/components/KeyboardSheet";
import {
  KEYBOARD_SURFACE_GAP,
  useBottomObstruction,
} from "@/components/useBottomObstruction";
import {
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
import { getZodiacSignFromIsoDate, getZodiacSignLabel } from "@/utils/dateOfBirth";
import {
  isDiscoveryImageWarm,
  isDiscoveryProfileWarm,
  warmDiscoveryDeck,
  warmDiscoveryFrontExtras,
  warmDiscoveryProfileImages,
} from "@/utils/discoveryPreload";
import {
  cacheDiscoveryFrontCardImages,
  clearDiscoveryFrontCardCache,
} from "@/utils/discoveryFrontCardCache";
import {
  debugDiscoveryLog,
  debugDiscoveryWarn,
  debugDiscoveryVerboseLog,
  discoveryVerboseDebugEnabled,
} from "@/utils/debug";
import { formatPopularAttributeValue } from "@/utils/popularAttributes";
import type {
  BaseGender,
  DiscoveryFeedProfileResponse,
  DiscoveryFilters,
  TherianMode,
} from "@/services/auth";

const SWIPE_THRESHOLD = 80;
const SWIPE_FEEDBACK_DISTANCE = 150;
const SWIPE_FEEDBACK_BUTTON_DURATION = 210;
const SWIPE_FEEDBACK_COMMIT_HOLD_DURATION = 110;
const SWIPE_FEEDBACK_RESET_DURATION = 180;
const INFO_SWIPE_THRESHOLD = 82;
const IS_WEB = Platform.OS === "web";
const DISCOVERY_PAGE_SIZE = 12;
const DISCOVERY_TRACE_PREFIX = "[discover]";
const DISCOVERY_ISOLATION_MODE: null | "A" | "B" | "C" | "D" = null;
const DISCOVERY_TRACE_EVENTS = new Set([
  "gesture_accepted",
  "gesture_threshold_crossed",
  "gesture_release",
  "gesture_terminated",
  "swipe_blocked",
  "swipe_animation_start",
  "swipe_animation_end",
  "advance_deck_before",
  "promotion_committed",
  "advance_deck_after",
  "state_change_during_animation",
]);

type SwipeState = "idle" | "like" | "dislike";
type FeatherName = React.ComponentProps<typeof Feather>["name"];
type AgeBounds = {
  min: number;
  max: number;
};
type PopularUpdateBanner = {
  id: number;
  title: string;
  body: string;
};
type DeckSlotName = "front" | "second" | "third";
type DeckShellId = "shellA" | "shellB" | "shellC";
type DeckSlotState = {
  shellId: DeckShellId;
  profile: DiscoverProfile | null;
  index: number | null;
  primaryReady: boolean;
  extraPhotosReady: boolean;
};
type DeckState = {
  shells: Record<DeckShellId, DeckSlotState>;
  order: Record<DeckSlotName, DeckShellId>;
  frontIndex: number;
  queueCursor: number;
};
type SwipeDirection = "left" | "right";
type SwipeCommitOrigin = "gesture" | "button";
type TraceLayout = {
  width: number;
  height: number;
};
type PendingNoopReconcile = {
  requestId: string;
  direction: SwipeDirection;
  targetProfileId: number;
};
type DiscoverProfile = DiscoveryFeedProfileResponse;

function createTraceId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function DiscoveryCardTrace({
  slot,
  logicalId,
  renderKey,
  enabled,
  trace,
}: {
  slot: "front" | "second";
  logicalId: string | number;
  renderKey: string;
  enabled: boolean;
  trace: (event: string, payload?: Record<string, unknown>) => void;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    trace("card_mount", {
      slot,
      logicalId,
      renderKey,
    });

    return () => {
      trace("card_unmount", {
        slot,
        logicalId,
        renderKey,
      });
    };
  }, [enabled, logicalId, renderKey, slot, trace]);

  return null;
}

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

const BASE_GENDERS: BaseGender[] = ["male", "female", "non_binary", "fluid"];

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

function createDeckSlot(
  shellId: DeckShellId,
  profile: DiscoverProfile | null,
  index: number | null,
  primaryReady = false,
  extraPhotosReady = false
): DeckSlotState {
  return {
    shellId,
    profile,
    index,
    primaryReady: profile ? primaryReady : true,
    extraPhotosReady: profile ? extraPhotosReady : true,
  };
}

function getDeckSlotByRole(deck: DeckState, role: DeckSlotName) {
  return deck.shells[deck.order[role]];
}

function updateDeckSlot(
  deck: DeckState,
  shellId: DeckShellId,
  updater: (slot: DeckSlotState) => DeckSlotState
): DeckState {
  const current = deck.shells[shellId];
  const next = updater(current);
  if (next === current) {
    return deck;
  }

  return {
    ...deck,
    shells: {
      ...deck.shells,
      [shellId]: next,
    },
  };
}

function isPrimaryImageReady(profile: DiscoverProfile | null) {
  return profile ? isDiscoveryProfileWarm(profile, 1) : true;
}

function areFrontExtrasReady(profile: DiscoverProfile | null) {
  if (!profile || profile.images.length <= 1) {
    return true;
  }

  return isDiscoveryProfileWarm(profile, profile.images.length - 1, 1);
}

function getNextDistinctIndex(
  profiles: DiscoverProfile[],
  startIndex: number,
  excludedIds: Set<number>
) {
  if (!profiles.length || excludedIds.size >= profiles.length || startIndex >= profiles.length) {
    return null;
  }

  for (
    let candidateIndex = Math.max(0, startIndex);
    candidateIndex < profiles.length;
    candidateIndex += 1
  ) {
    const candidate = profiles[candidateIndex];
    if (candidate && !excludedIds.has(candidate.id)) {
      return candidateIndex;
    }
  }

  return null;
}

function buildDeckState(profiles: DiscoverProfile[], startIndex = 0): DeckState {
  if (!profiles.length) {
    return {
      shells: {
        shellA: createDeckSlot("shellA", null, null, true, true),
        shellB: createDeckSlot("shellB", null, null, true, true),
        shellC: createDeckSlot("shellC", null, null, true, true),
      },
      order: {
        front: "shellA",
        second: "shellB",
        third: "shellC",
      },
      frontIndex: 0,
      queueCursor: 0,
    };
  }

  const safeStart = Math.max(0, startIndex);
  if (safeStart >= profiles.length) {
    return {
      shells: {
        shellA: createDeckSlot("shellA", null, null, true, true),
        shellB: createDeckSlot("shellB", null, null, true, true),
        shellC: createDeckSlot("shellC", null, null, true, true),
      },
      order: {
        front: "shellA",
        second: "shellB",
        third: "shellC",
      },
      frontIndex: safeStart,
      queueCursor: safeStart,
    };
  }
  const front = profiles[safeStart] ?? null;
  const secondIndex = getNextDistinctIndex(
    profiles,
    safeStart + 1,
    new Set(front ? [front.id] : [])
  );
  const second = secondIndex == null ? null : profiles[secondIndex] ?? null;
  const thirdIndex = getNextDistinctIndex(
    profiles,
    (secondIndex ?? safeStart) + 1,
    new Set([front?.id, second?.id].filter((value): value is number => typeof value === "number"))
  );
  const third = thirdIndex == null ? null : profiles[thirdIndex] ?? null;
  const lastAssignedIndex = thirdIndex ?? secondIndex ?? safeStart;

  return {
    shells: {
      shellA: createDeckSlot(
        "shellA",
        front,
        safeStart,
        isPrimaryImageReady(front),
        areFrontExtrasReady(front)
      ),
      shellB: createDeckSlot(
        "shellB",
        second,
        secondIndex,
        isPrimaryImageReady(second),
        false
      ),
      shellC: createDeckSlot("shellC", third, thirdIndex, true, false),
    },
    order: {
      front: "shellA",
      second: "shellB",
      third: "shellC",
    },
    frontIndex: safeStart,
    queueCursor: lastAssignedIndex + 1,
  };
}

function getAnchoredDeckStartIndex(
  profiles: DiscoverProfile[],
  currentFrontProfileId: number | null
) {
  if (!profiles.length || !currentFrontProfileId) {
    return 0;
  }

  const nextIndex = profiles.findIndex((profile) => profile.id === currentFrontProfileId);
  return nextIndex >= 0 ? nextIndex : 0;
}

function advanceDeckState(currentDeck: DeckState, profiles: DiscoverProfile[]): DeckState {
  const currentFront = getDeckSlotByRole(currentDeck, "front");
  const currentSecond = getDeckSlotByRole(currentDeck, "second");
  const currentThird = getDeckSlotByRole(currentDeck, "third");

  if (!profiles.length) {
    return buildDeckState(profiles, 0);
  }

  if (!currentSecond.profile || currentSecond.index == null) {
    return buildDeckState(profiles, profiles.length);
  }

  const excludedIds = new Set(
    [currentSecond.profile?.id, currentThird.profile?.id].filter(
      (value): value is number => typeof value === "number"
    )
  );
  const nextThirdIndex = getNextDistinctIndex(
    profiles,
    currentDeck.queueCursor,
    excludedIds
  );
  const nextThirdProfile = nextThirdIndex == null ? null : profiles[nextThirdIndex] ?? null;
  const recycledShellId = currentDeck.order.front;
  const nextFrontShellId = currentDeck.order.second;
  const nextSecondShellId = currentDeck.order.third;

  return {
    shells: {
      ...currentDeck.shells,
      [nextFrontShellId]: {
        ...currentDeck.shells[nextFrontShellId],
        extraPhotosReady: areFrontExtrasReady(currentSecond.profile),
      },
      [nextSecondShellId]: {
        ...currentDeck.shells[nextSecondShellId],
        primaryReady: isPrimaryImageReady(currentThird.profile),
        extraPhotosReady: false,
      },
      [recycledShellId]: createDeckSlot(
        recycledShellId,
        nextThirdProfile,
        nextThirdIndex,
        true,
        false
      ),
    },
    order: {
      front: nextFrontShellId,
      second: nextSecondShellId,
      third: recycledShellId,
    },
    frontIndex: currentSecond.index ?? currentDeck.frontIndex,
    queueCursor: nextThirdIndex == null ? currentDeck.queueCursor : nextThirdIndex + 1,
  };
}

function normalizeSelectedGenders(values: BaseGender[]) {
  return BASE_GENDERS.filter((value) => values.includes(value));
}

function filtersEqual(a: DiscoveryFilters, b: DiscoveryFilters) {
  return (
    a.therianMode === b.therianMode &&
    a.selectedGenders.length === b.selectedGenders.length &&
    a.selectedGenders.every((value, index) => value === b.selectedGenders[index]) &&
    a.ageMin === b.ageMin &&
    a.ageMax === b.ageMax
  );
}

function FilterCheckboxRow({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterCheckboxRow,
        compact && styles.filterCheckboxRowCompact,
        selected && styles.filterCheckboxRowSelected,
        pressed && { opacity: 0.82 },
      ]}
    >
      <View
        style={[
          styles.filterCheckboxBox,
          compact && styles.filterCheckboxBoxCompact,
          selected && styles.filterCheckboxBoxSelected,
        ]}
      >
        {selected ? (
          <Feather name="check" size={13} color={Colors.ivory} />
        ) : null}
      </View>
      <Text
        style={[
          styles.filterCheckboxLabel,
          compact && styles.filterCheckboxLabelCompact,
          selected && styles.filterCheckboxLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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

  const handleMinTextChange = React.useCallback(
    (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      setMinText(digits);

      if (!digits) {
        return;
      }

      const parsed = Number(digits);
      if (parsed >= bounds.min && parsed <= valueMax) {
        onChange(parsed, valueMax);
      }
    },
    [bounds.min, onChange, valueMax]
  );

  const handleMaxTextChange = React.useCallback(
    (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      setMaxText(digits);

      if (!digits) {
        return;
      }

      const parsed = Number(digits);
      if (parsed >= valueMin && parsed <= bounds.max) {
        onChange(valueMin, parsed);
      }
    },
    [bounds.max, onChange, valueMin]
  );

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
            onChangeText={handleMinTextChange}
            onBlur={() => commitMin(minText)}
            onEndEditing={() => commitMin(minText)}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={styles.ageNumberInput}
            placeholder="18"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primaryLight}
            maxLength={3}
            returnKeyType="done"
          />
        </View>
        <View style={styles.ageNumberField}>
          <Text style={styles.ageNumberLabel}>{t("Máxima", "Maximum")}</Text>
          <TextInput
            value={maxText}
            onChangeText={handleMaxTextChange}
            onBlur={() => commitMax(maxText)}
            onEndEditing={() => commitMax(maxText)}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={styles.ageNumberInput}
            placeholder="40"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primaryLight}
            maxLength={3}
            returnKeyType="done"
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
  const netInfo = useNetInfo();
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const CARD_WIDTH = width - 32;
  const CARD_HEIGHT = height * 0.62;
  const cardFrameStyle = useMemo(
    () => ({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    }),
    [CARD_HEIGHT, CARD_WIDTH]
  );
  const {
    t,
    user,
    likeProfile,
    passProfile,
    likedProfiles,
    passedProfiles,
    goals,
    language,
    discoveryFeed,
    discoveryFilters,
    lastServerSyncAt,
    recordDiscoverySwipe,
    refreshProfileLocation,
    refreshDiscoveryCandidates,
    fetchNextDiscoveryWindow,
    saveDiscoveryFilters,
  } = useApp();
  const ageBounds = useMemo<AgeBounds>(() => ({ min: 18, max: 100 }), []);
  const defaultFilters = useMemo<DiscoveryFilters>(
    () => ({
      selectedGenders: [],
      therianMode: "exclude",
      ageMin: 18,
      ageMax: 40,
    }),
    []
  );
  const activeFilters = discoveryFilters ?? defaultFilters;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>("idle");
  const [showInsight, setShowInsight] = useState(false);
  const [lastLikedProfile, setLastLikedProfile] = useState<DiscoverProfile | null>(null);
  const [popularUpdateBanner, setPopularUpdateBanner] = useState<PopularUpdateBanner | null>(null);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DiscoveryFilters>(activeFilters);
  const [isDeckAnimating, setIsDeckAnimating] = useState(false);
  const [pendingDecisionProfileId, setPendingDecisionProfileId] = useState<number | null>(null);
  const [pendingNoopReconcile, setPendingNoopReconcile] =
    useState<PendingNoopReconcile | null>(null);
  const [loadedCount, setLoadedCount] = useState(DISCOVERY_PAGE_SIZE);
  const [, setPreloadRevision] = useState(0);
  const [deck, setDeck] = useState<DeckState>(() => buildDeckState([], 0));
  const [frontCachedImages, setFrontCachedImages] = useState<string[]>([]);
  const [frontCachedProfileId, setFrontCachedProfileId] = useState<number | null>(null);
  const [frontImageLoading, setFrontImageLoading] = useState(false);
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [locationPromptReason, setLocationPromptReason] = useState<
    "permission_denied" | "services_disabled" | null
  >(null);
  const deckRef = useRef<DeckState>(deck);
  const screenSessionIdRef = useRef(createTraceId("discover"));
  const swipeSessionIdRef = useRef<string | null>(null);
  const swipeDirectionRef = useRef<SwipeDirection | null>(null);
  const thresholdLoggedRef = useRef(false);
  const previousLayoutRef = useRef<Record<string, TraceLayout>>({});
  const previousTraceSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const deferredDeckRebuildRef = useRef(false);
  const traceFocused = discoveryVerboseDebugEnabled && pathname.endsWith("/discover");

  const position = useRef(new Animated.ValueXY()).current;
  const swipeFeedbackX = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const deckProgress = useRef(new Animated.Value(0)).current;
  const backScrollRef = useRef<ScrollView | null>(null);

  const trace = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      if (!traceFocused || !DISCOVERY_TRACE_EVENTS.has(event)) {
        return;
      }

      debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} ${event}`, {
        screenSessionId: screenSessionIdRef.current,
        swipeSessionId: swipeSessionIdRef.current,
        ...payload,
      });
    },
    [traceFocused]
  );

  useEffect(() => {
    if (!pathname.endsWith("/discover")) {
      return;
    }

    void (async () => {
      const result = await refreshProfileLocation({
        reason: "discover_entry",
      });

      if (
        result.status === "permission_denied" ||
        result.status === "services_disabled"
      ) {
        setLocationPromptReason(result.status);
        setLocationPromptVisible(true);
      }
    })();
  }, [pathname, refreshProfileLocation]);

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = swipeFeedbackX.interpolate({
    inputRange: [0, SWIPE_FEEDBACK_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const dislikeOpacity = swipeFeedbackX.interpolate({
    inputRange: [-SWIPE_FEEDBACK_DISTANCE, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const likeStampScale = likeOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.08],
    extrapolate: "clamp",
  });
  const dislikeStampScale = dislikeOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.08],
    extrapolate: "clamp",
  });
  const likeStampTranslateY = likeOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
    extrapolate: "clamp",
  });
  const dislikeStampTranslateY = dislikeOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
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
  const promotedSecondScale = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
    extrapolate: "clamp",
  });
  const promotedSecondTranslateY = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
    extrapolate: "clamp",
  });
  const promotedSecondOpacity = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
    extrapolate: "clamp",
  });
  const promotedThirdScale = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0.95],
    extrapolate: "clamp",
  });
  const promotedThirdTranslateY = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 16],
    extrapolate: "clamp",
  });
  const promotedThirdOpacity = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.85],
    extrapolate: "clamp",
  });

  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const feedProfiles = discoveryFeed.profiles ?? [];
  const sourceProfiles = useMemo(
    () =>
      feedProfiles.filter(
        (profile) =>
          !likedProfiles.includes(profile.id) &&
          !passedProfiles.includes(profile.id)
      ),
    [feedProfiles, likedProfiles, passedProfiles]
  );
  const filteredProfiles = useMemo(
    () => sourceProfiles.slice(0, loadedCount),
    [loadedCount, sourceProfiles]
  );
  const supply = discoveryFeed.supply;
  const eligibleCount = Number(supply?.eligibleCount) || 0;
  const unseenCount = Number(supply?.unseenCount) || 0;
  const hasMoreServerProfiles = Boolean(discoveryFeed.hasMore);
  const hasFilterMatches = sourceProfiles.length > 0;
  const hasCatalogMatches = eligibleCount > 0;
  const frontSlot = getDeckSlotByRole(deck, "front");
  const secondSlot = getDeckSlotByRole(deck, "second");
  const thirdSlot = getDeckSlotByRole(deck, "third");
  const frontShellId = deck.order.front;
  const secondShellId = deck.order.second;
  const thirdShellId = deck.order.third;
  const frontProfile = frontSlot.profile;
  const secondProfile = secondSlot.profile;
  const thirdProfile = thirdSlot.profile;
  const secondReady = secondProfile ? secondSlot.primaryReady : true;
  const hasPendingDecision = pendingDecisionProfileId !== null;
  const currentImages =
    frontProfile && frontCachedProfileId === frontProfile.id && frontCachedImages.length
      ? frontCachedImages
      : frontProfile?.images ?? [];
  const currentImage =
    currentImages[Math.min(activePhotoIndex, currentImages.length - 1)] ??
    currentImages[0];
  const frontCardKey = frontProfile
    ? `front:${frontProfile.id}:${frontSlot.shellId}`
    : "front:empty";
  const secondCardKey = secondProfile
    ? `second:${secondProfile.id}:${secondSlot.shellId}`
    : "second:empty";
  const frontImageKey = frontProfile
    ? `${frontProfile.id}:${Math.min(activePhotoIndex, Math.max(currentImages.length - 1, 0))}`
    : "front-image:empty";
  const secondImageKey = secondProfile
    ? `${secondProfile.id}:0`
    : "second-image:empty";
  const pronounLabel = frontProfile
    ? getPronounLabel(frontProfile.pronouns, language)
    : "";
  const genderIdentityLabel = frontProfile
    ? getGenderIdentityLabel(frontProfile.genderIdentity, t)
    : "";
  const zodiacLabel = getZodiacSignLabel(
    getZodiacSignFromIsoDate(frontProfile?.dateOfBirth ?? ""),
    t
  );
  const ageWithSign = frontProfile
    ? zodiacLabel
      ? `${frontProfile.age} · ${zodiacLabel}`
      : String(frontProfile.age)
    : "";
  const hasActiveFilters = !filtersEqual(activeFilters, defaultFilters);
  const canApplyFilters = !filtersEqual(draftFilters, activeFilters);
  const hasDeckProfiles = Boolean(frontProfile);
  const isOfflineDeckExhausted =
    !hasDeckProfiles && hasMoreServerProfiles && isOffline;
  const isOnlineDeckExhausted =
    !hasDeckProfiles && unseenCount === 0 && hasCatalogMatches;
  const isSeenDeckExhausted = false;
  const baseGenderOptions = useMemo(
    () => [
      { value: "male" as const, label: t("Hombre", "Male") },
      { value: "female" as const, label: t("Mujer", "Female") },
      { value: "non_binary" as const, label: t("No binario", "Non-binary") },
      { value: "fluid" as const, label: t("Fluidx", "Fluid") },
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
  const insightLookup = useMemo(() => {
    const map = new Map<string, { es: string; en: string }>();
    [...feedProfiles, ...(lastLikedProfile ? [lastLikedProfile] : [])].forEach((profile) => {
      profile.insightTags.forEach((tag) => {
        map.set(tag.en, tag);
      });
    });
    return map;
  }, [feedProfiles, lastLikedProfile]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const { bottomObstructionHeight: filterBottomObstruction } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: 16,
    extraKeyboardSpacing:
      Platform.OS === "ios" ? KEYBOARD_SURFACE_GAP.ios : KEYBOARD_SURFACE_GAP.android,
    enabled: isFilterVisible,
  });
  const filterActionsInset = insets.bottom + 112;
  const shouldFreezeReadinessWrites =
    traceFocused && DISCOVERY_ISOLATION_MODE === "A" && isDeckAnimating;
  const shouldDeferDeckRebuild =
    traceFocused && DISCOVERY_ISOLATION_MODE === "B" && isDeckAnimating;
  const shouldSuppressVisualChurn =
    traceFocused && DISCOVERY_ISOLATION_MODE === "C" && isDeckAnimating;
  const shouldUseStableSlotImageKeys = DISCOVERY_ISOLATION_MODE === "D";

  useEffect(() => {
    let cancelled = false;

    if (!user?.id || !frontProfile) {
      setFrontCachedImages([]);
      setFrontCachedProfileId(null);
      setFrontImageLoading(false);
      if (user?.id) {
        void clearDiscoveryFrontCardCache(user.id);
      }
      return;
    }

    if (frontCachedProfileId === frontProfile.id && frontCachedImages.length > 0) {
      return;
    }

    setFrontImageLoading(true);

    void (async () => {
      await clearDiscoveryFrontCardCache(user.id).catch(() => {});
      const cached = await cacheDiscoveryFrontCardImages(
        user.id,
        frontProfile.id,
        frontProfile.images
      );
      if (cancelled) {
        return;
      }
      setFrontCachedProfileId(frontProfile.id);
      setFrontCachedImages(cached);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    frontCachedImages.length,
    frontCachedProfileId,
    frontProfile,
    user?.id,
  ]);

  useEffect(() => {
    if (!frontProfile || !currentImage) {
      setFrontImageLoading(false);
      return;
    }

    setFrontImageLoading(true);
  }, [currentImage, frontProfile?.id]);

  const getTraceSnapshot = useCallback(
    () => ({
      frontId: frontProfile?.id ?? null,
      secondId: secondProfile?.id ?? null,
      thirdId: thirdProfile?.id ?? null,
      frontCardKey,
      secondCardKey,
      frontImageKey,
      secondImageKey,
      frontIndex: deck.frontIndex,
      queueCursor: deck.queueCursor,
      loadedCount,
      frontReady: frontSlot.primaryReady,
      secondReady: secondSlot.primaryReady,
      frontExtrasReady: frontSlot.extraPhotosReady,
      activePhotoIndex,
      isDeckAnimating,
      isInfoVisible,
    }),
    [
      activePhotoIndex,
      deck.frontIndex,
      deck.queueCursor,
      frontSlot,
      frontCardKey,
      frontImageKey,
      isDeckAnimating,
      isInfoVisible,
      loadedCount,
      secondSlot,
      secondCardKey,
      secondImageKey,
    ]
  );

  const logLayoutChange = useCallback(
    (target: "card_stack" | "front_card", next: TraceLayout) => {
      const previous = previousLayoutRef.current[target];
      if (previous && previous.width === next.width && previous.height === next.height) {
        return;
      }

      previousLayoutRef.current[target] = next;
      trace("layout_change", {
        target,
        width: next.width,
        height: next.height,
        changedDuringAnimation: isDeckAnimating,
      });

      if (isDeckAnimating) {
        debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} layout_change_during_animation`, {
          screenSessionId: screenSessionIdRef.current,
          swipeSessionId: swipeSessionIdRef.current,
          target,
          width: next.width,
          height: next.height,
        });
      }
    },
    [isDeckAnimating, trace]
  );
  const lastSyncLabel = useMemo(() => {
    if (!lastServerSyncAt) {
      return null;
    }

    const date = new Date(lastServerSyncAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    try {
      return date.toLocaleString(language === "es" ? "es-ES" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return date.toISOString();
    }
  }, [language, lastServerSyncAt]);

  useEffect(() => {
    trace("filters_changed", {
      activeFilters,
    });
  }, [activeFilters, trace]);

  useEffect(() => {
    trace("source_profiles_changed", {
      sourceProfilesLength: sourceProfiles.length,
    });
  }, [sourceProfiles.length, trace]);

  useEffect(() => {
    trace("filtered_profiles_changed", {
      filteredProfilesLength: filteredProfiles.length,
    });
  }, [filteredProfiles.length, trace]);

  useEffect(() => {
    trace("loaded_count_changed", {
      loadedCount,
    });
  }, [loadedCount, trace]);

  useEffect(() => {
    trace("network_state_changed", {
      isOffline,
      isConnected: netInfo.isConnected,
      isInternetReachable: netInfo.isInternetReachable,
    });
  }, [isOffline, netInfo.isConnected, netInfo.isInternetReachable, trace]);

  useEffect(() => {
    trace("render_identity_changed", {
      frontCardKey,
      secondCardKey,
      frontImageKey,
      secondImageKey,
    });
  }, [frontCardKey, secondCardKey, frontImageKey, secondImageKey, trace]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    if (!discoveryVerboseDebugEnabled) {
      return;
    }

    debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} mount`, {
      screenSessionId: screenSessionIdRef.current,
      pathname,
      isolationMode: DISCOVERY_ISOLATION_MODE,
    });

    return () => {
      debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} unmount`, {
        screenSessionId: screenSessionIdRef.current,
        pathname,
      });
    };
  }, [pathname]);

  useEffect(() => {
    if (!discoveryVerboseDebugEnabled) {
      return;
    }

    debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} focus_change`, {
      screenSessionId: screenSessionIdRef.current,
      focused: traceFocused,
      pathname,
    });
  }, [pathname, traceFocused]);

  useEffect(() => {
    if (!traceFocused) {
      return;
    }

    const nextSnapshot = getTraceSnapshot();
    const previousSnapshot = previousTraceSnapshotRef.current;
    if (!previousSnapshot) {
      previousTraceSnapshotRef.current = nextSnapshot;
      trace("snapshot_init", nextSnapshot);
      return;
    }

    const changedKeys = (Object.keys(nextSnapshot) as Array<keyof typeof nextSnapshot>).filter(
      (key) => previousSnapshot[key] !== nextSnapshot[key]
    );
    if (!changedKeys.length) {
      return;
    }

    previousTraceSnapshotRef.current = nextSnapshot;
    if (isDeckAnimating) {
      trace("state_change_during_animation", {
        changedKeys,
        snapshot: nextSnapshot,
      });
    }
  }, [getTraceSnapshot, isDeckAnimating, trace, traceFocused]);

  useEffect(() => {
    if (!popularUpdateBanner) {
      return;
    }

    const timeout = setTimeout(() => {
      setPopularUpdateBanner(null);
    }, 4200);

    return () => clearTimeout(timeout);
  }, [popularUpdateBanner]);

  const buildPopularUpdateMessage = useCallback(
    (
      changedCategories: {
        category: "physical" | "personality" | "family" | "expectations" | "language" | "studies";
        nextValueKey: string;
      }[]
    ) => {
      const visible = changedCategories.slice(0, 2).map((item) => {
        const categoryLabel =
          item.category === "physical"
            ? t("Físicas", "Physical")
            : item.category === "personality"
              ? t("Personalidad", "Personality")
              : item.category === "family"
                ? t("Familia", "Family")
                : item.category === "expectations"
                  ? t("Expectativas", "Expectations")
                  : item.category === "language"
                    ? t("Idioma", "Language")
                    : t("Estudios", "Studies");

        const valueLabel = formatPopularAttributeValue(
          item.category,
          item.nextValueKey,
          {
            t,
            language,
            insightLookup,
            emptyLabel: t("Sin definir", "Not set"),
          }
        );

        return `${categoryLabel}: ${valueLabel}`;
      });

      const extraCount = changedCategories.length - visible.length;

      return {
        title: t(
          "Tus preferencias se están perfilando",
          "Your preferences are becoming clearer"
        ),
        body:
          extraCount > 0
            ? `${visible.join(" · ")} +${extraCount}`
            : visible.join(" · "),
      };
    },
    [insightLookup, language, t]
  );

  React.useEffect(() => {
    setDraftFilters(activeFilters);
  }, [activeFilters]);

  React.useEffect(() => {
    trace("deck_rebuild_requested", {
      sourceProfilesLength: sourceProfiles.length,
      loadedCount,
      deferred: shouldDeferDeckRebuild,
    });

    if (shouldDeferDeckRebuild) {
      deferredDeckRebuildRef.current = true;
      return;
    }

    const currentFrontProfileId =
      getDeckSlotByRole(deckRef.current, "front").profile?.id ?? null;
    const nextStartIndex = getAnchoredDeckStartIndex(
      sourceProfiles,
      currentFrontProfileId
    );
    const nextLoadedCount = Math.min(
      sourceProfiles.length,
      Math.max(DISCOVERY_PAGE_SIZE, loadedCount, nextStartIndex + 3)
    );
    trace("deck_rebuild_start", {
      sourceProfilesLength: sourceProfiles.length,
      nextLoadedCount,
      nextStartIndex,
      currentFrontProfileId,
    });
    setLoadedCount(nextLoadedCount);
    setDeck(buildDeckState(sourceProfiles.slice(0, nextLoadedCount), nextStartIndex));
    setActivePhotoIndex(0);
    setSwipeState("idle");
    setIsInfoVisible(false);
    setIsDeckAnimating(false);
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
    trace("deck_rebuild_end", {
      sourceProfilesLength: sourceProfiles.length,
      nextLoadedCount,
    });
  }, [
    deckProgress,
    flipAnim,
    loadedCount,
    position,
    swipeFeedbackX,
    shouldDeferDeckRebuild,
    sourceProfiles,
    sourceProfiles.length,
    trace,
  ]);

  React.useEffect(() => {
    if (
      !traceFocused ||
      DISCOVERY_ISOLATION_MODE !== "B" ||
      isDeckAnimating ||
      !deferredDeckRebuildRef.current
    ) {
      return;
    }

    deferredDeckRebuildRef.current = false;
    const currentFrontProfileId =
      getDeckSlotByRole(deckRef.current, "front").profile?.id ?? null;
    const nextStartIndex = getAnchoredDeckStartIndex(
      sourceProfiles,
      currentFrontProfileId
    );
    const nextLoadedCount = Math.min(
      sourceProfiles.length,
      Math.max(DISCOVERY_PAGE_SIZE, loadedCount, nextStartIndex + 3)
    );
    trace("deck_rebuild_deferred_commit", {
      sourceProfilesLength: sourceProfiles.length,
      nextLoadedCount,
      nextStartIndex,
      currentFrontProfileId,
    });
    setLoadedCount(nextLoadedCount);
    setDeck(buildDeckState(sourceProfiles.slice(0, nextLoadedCount), nextStartIndex));
    setActivePhotoIndex(0);
    setSwipeState("idle");
    setIsInfoVisible(false);
    setIsDeckAnimating(false);
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [
    deckProgress,
    flipAnim,
    isDeckAnimating,
    loadedCount,
    position,
    swipeFeedbackX,
    sourceProfiles,
    sourceProfiles.length,
    trace,
    traceFocused,
  ]);

  React.useEffect(() => {
    trace("loaded_count_guard_check", {
      loadedCount,
      sourceProfilesLength: sourceProfiles.length,
      frontIndex: deck.frontIndex,
      isOffline,
      hasFrontProfile: Boolean(frontProfile),
    });

    if (isOffline || loadedCount >= sourceProfiles.length || !frontProfile) {
      return;
    }

    const remainingLoadedProfiles = loadedCount - (deck.frontIndex + 1);
    if (remainingLoadedProfiles > 2) {
      return;
    }

    setLoadedCount((current) =>
      Math.min(sourceProfiles.length, current + DISCOVERY_PAGE_SIZE)
    );
  }, [deck.frontIndex, frontProfile, isOffline, loadedCount, sourceProfiles.length]);

  React.useEffect(() => {
    if (
      isOffline ||
      !hasMoreServerProfiles ||
      loadedCount < sourceProfiles.length ||
      sourceProfiles.length - (deck.frontIndex + 1) > 2
    ) {
      return;
    }

    void fetchNextDiscoveryWindow();
  }, [
    deck.frontIndex,
    fetchNextDiscoveryWindow,
    hasMoreServerProfiles,
    isOffline,
    loadedCount,
    sourceProfiles.length,
  ]);

  React.useEffect(() => {
    trace("loaded_count_recovery_check", {
      loadedCount,
      sourceProfilesLength: sourceProfiles.length,
      isOffline,
      hasDeckProfiles,
    });
    if (
      isOffline ||
      hasDeckProfiles ||
      loadedCount >= sourceProfiles.length ||
      !sourceProfiles.length
    ) {
      return;
    }

    setLoadedCount((current) =>
      Math.min(sourceProfiles.length, current + DISCOVERY_PAGE_SIZE)
    );
  }, [hasDeckProfiles, isOffline, loadedCount, sourceProfiles.length, sourceProfiles]);

  React.useEffect(() => {
    if (!filteredProfiles.length) {
      return;
    }

    trace("warm_deck_start", {
      frontId: frontProfile?.id ?? null,
      secondId: secondProfile?.id ?? null,
      thirdId: thirdProfile?.id ?? null,
    });
    void warmDiscoveryDeck([
      frontProfile,
      secondProfile,
      thirdProfile,
    ]).then(() => {
      trace("warm_deck_finish", {
        frontId: frontProfile?.id ?? null,
        secondId: secondProfile?.id ?? null,
        thirdId: thirdProfile?.id ?? null,
        skippedDuringAnimation: shouldFreezeReadinessWrites,
      });
      if (shouldFreezeReadinessWrites) {
        return;
      }
      setDeck((currentDeck) => {
        const currentFront = getDeckSlotByRole(currentDeck, "front");
        const currentSecond = getDeckSlotByRole(currentDeck, "second");
        let nextDeck = currentDeck;

        if (currentFront.profile) {
          nextDeck = updateDeckSlot(nextDeck, currentFront.shellId, (slot) => ({
            ...slot,
            primaryReady: isPrimaryImageReady(slot.profile),
          }));
        }

        if (currentSecond.profile) {
          nextDeck = updateDeckSlot(nextDeck, currentSecond.shellId, (slot) => ({
            ...slot,
            primaryReady: isPrimaryImageReady(slot.profile),
          }));
        }

        return nextDeck;
      });
      setPreloadRevision((value) => value + 1);
    });
  }, [
    filteredProfiles,
    frontProfile,
    secondProfile,
    thirdProfile,
    shouldFreezeReadinessWrites,
    trace,
  ]);

  React.useEffect(() => {
    if (!frontProfile || frontSlot.extraPhotosReady) {
      return;
    }

    let cancelled = false;

    trace("warm_front_extras_start", {
      frontId: frontProfile.id,
      imageCount: frontProfile.images.length,
    });
    void warmDiscoveryFrontExtras(frontProfile).then(() => {
      if (cancelled) {
        return;
      }

      trace("warm_front_extras_finish", {
        frontId: frontProfile.id,
        skippedDuringAnimation: shouldFreezeReadinessWrites || shouldSuppressVisualChurn,
      });
      if (shouldFreezeReadinessWrites || shouldSuppressVisualChurn) {
        return;
      }

      setDeck((currentDeck) => {
        const currentFront = getDeckSlotByRole(currentDeck, "front");
        if (currentFront.profile?.id !== frontProfile.id) {
          return currentDeck;
        }

        const nextReady = areFrontExtrasReady(frontProfile);
        if (currentFront.extraPhotosReady === nextReady) {
          return currentDeck;
        }

        return updateDeckSlot(currentDeck, currentFront.shellId, (slot) => ({
          ...slot,
          extraPhotosReady: nextReady,
        }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    frontProfile,
    frontSlot.extraPhotosReady,
    shouldFreezeReadinessWrites,
    shouldSuppressVisualChurn,
    trace,
  ]);

  const resetPosition = useCallback(() => {
    position.setValue({ x: 0, y: 0 });
    Animated.timing(swipeFeedbackX, {
      toValue: 0,
      duration: SWIPE_FEEDBACK_RESET_DURATION,
      useNativeDriver: false,
    }).start();
  }, [position, swipeFeedbackX]);

  const setInfoVisible = useCallback((nextVisible: boolean) => {
    if (shouldSuppressVisualChurn) {
      trace("info_visibility_suppressed", {
        nextVisible,
      });
      return;
    }

    trace("info_visibility_change", {
      nextVisible,
    });
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
  }, [flipAnim, shouldSuppressVisualChurn, trace]);

  const toggleInfo = () => {
    Haptics.selectionAsync().catch(() => {});
    setInfoVisible(!isInfoVisible);
  };

  const resetCardState = useCallback(() => {
    trace("reset_card_state", getTraceSnapshot());
    setSwipeState("idle");
    setIsDeckAnimating(false);
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
    setActivePhotoIndex(0);
    setIsInfoVisible(false);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
    swipeSessionIdRef.current = null;
    swipeDirectionRef.current = null;
    thresholdLoggedRef.current = false;
  }, [deckProgress, flipAnim, getTraceSnapshot, position, swipeFeedbackX, trace]);

  useEffect(() => {
    if (!pendingNoopReconcile) {
      return;
    }

    resetCardState();
    setPendingDecisionProfileId(null);
    debugDiscoveryLog("swipe_noop_reconciled", {
      requestId: pendingNoopReconcile.requestId,
      direction: pendingNoopReconcile.direction,
      targetProfileId: pendingNoopReconcile.targetProfileId,
      fetchedAt: discoveryFeed.supply?.fetchedAt ?? null,
      nextFrontProfileId: getDeckSlotByRole(deckRef.current, "front").profile?.id ?? null,
    });
    setPendingNoopReconcile(null);
  }, [discoveryFeed.supply?.fetchedAt, pendingNoopReconcile, resetCardState]);

  const settleCardVisualState = useCallback(() => {
    setSwipeState("idle");
    setIsDeckAnimating(false);
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
    setActivePhotoIndex(0);
    setIsInfoVisible(false);
    flipAnim.setValue(0);
    backScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [deckProgress, flipAnim, position, swipeFeedbackX]);

  const restoreDeckAfterDecisionFailure = useCallback(
    (previousDeck: DeckState) => {
      settleCardVisualState();
      deckRef.current = previousDeck;
      setDeck(previousDeck);
      swipeSessionIdRef.current = null;
      swipeDirectionRef.current = null;
      thresholdLoggedRef.current = false;
    },
    [settleCardVisualState]
  );

  const markSlotReady = useCallback((slotName: DeckSlotName, profileId: number) => {
    trace("slot_ready_mark", {
      slotName,
      profileId,
      skippedDuringAnimation: shouldFreezeReadinessWrites,
    });
    if (shouldFreezeReadinessWrites) {
      return;
    }

    setDeck((currentDeck) => {
      const slot = getDeckSlotByRole(currentDeck, slotName);
      if (!slot.profile || slot.profile.id !== profileId || slot.primaryReady) {
        return currentDeck;
      }

      return updateDeckSlot(currentDeck, slot.shellId, (currentSlot) => ({
        ...currentSlot,
        primaryReady: true,
      }));
    });
  }, [shouldFreezeReadinessWrites, trace]);

  const advanceDeck = useCallback(() => {
    const currentDeck = deckRef.current;
    const nextDeck = advanceDeckState(currentDeck, filteredProfiles);
    const currentFront = getDeckSlotByRole(currentDeck, "front");
    const currentSecond = getDeckSlotByRole(currentDeck, "second");
    const currentThird = getDeckSlotByRole(currentDeck, "third");
    const nextFront = getDeckSlotByRole(nextDeck, "front");
    const nextSecond = getDeckSlotByRole(nextDeck, "second");
    const nextThird = getDeckSlotByRole(nextDeck, "third");
    trace("advance_deck_before", {
      current: {
        frontId: currentFront.profile?.id ?? null,
        secondId: currentSecond.profile?.id ?? null,
        thirdId: currentThird.profile?.id ?? null,
      },
      next: {
        frontId: nextFront.profile?.id ?? null,
        secondId: nextSecond.profile?.id ?? null,
        thirdId: nextThird.profile?.id ?? null,
      },
    });
    settleCardVisualState();
    trace("promotion_committed", {
      promotedFrontId: nextFront.profile?.id ?? null,
      previousFrontId: currentFront.profile?.id ?? null,
      swipeDirection: swipeDirectionRef.current,
    });
    deckRef.current = nextDeck;
    setDeck(nextDeck);
    trace("advance_deck_after", {
      nextFrontId: nextFront.profile?.id ?? null,
      nextSecondId: nextSecond.profile?.id ?? null,
      nextThirdId: nextThird.profile?.id ?? null,
    });
    swipeSessionIdRef.current = null;
    swipeDirectionRef.current = null;
    thresholdLoggedRef.current = false;
  }, [filteredProfiles, settleCardVisualState, trace]);

  const syncFrontExtraPhotoState = useCallback((profile: DiscoverProfile) => {
    const nextReady = areFrontExtrasReady(profile);
    setDeck((currentDeck) => {
      const currentFront = getDeckSlotByRole(currentDeck, "front");
      if (currentFront.profile?.id !== profile.id) {
        return currentDeck;
      }
      if (currentFront.extraPhotosReady === nextReady) {
        return currentDeck;
      }
      return updateDeckSlot(currentDeck, currentFront.shellId, (slot) => ({
        ...slot,
        extraPhotosReady: nextReady,
      }));
    });
  }, []);

  const stepPhoto = useCallback((direction: "prev" | "next") => {
    if (shouldSuppressVisualChurn) {
      trace("photo_step_suppressed", {
        direction,
      });
      return;
    }

    if (!frontProfile || currentImages.length <= 1) {
      return;
    }

    const nextIndex =
      direction === "next"
        ? Math.min(activePhotoIndex + 1, currentImages.length - 1)
        : Math.max(activePhotoIndex - 1, 0);

    if (nextIndex === activePhotoIndex) {
      return;
    }

    Haptics.selectionAsync().catch(() => {});

    const nextUri = frontProfile.images[nextIndex];
    trace("photo_step", {
      direction,
      currentIndex: activePhotoIndex,
      nextIndex,
      nextUri,
    });
    if (!nextUri || isDiscoveryImageWarm(nextUri)) {
      setActivePhotoIndex(nextIndex);
      syncFrontExtraPhotoState(frontProfile);
      return;
    }

    const frontProfileId = frontProfile.id;
    void warmDiscoveryProfileImages(frontProfile, 1, nextIndex).then(() => {
      syncFrontExtraPhotoState(frontProfile);
      if (
        getDeckSlotByRole(deckRef.current, "front").profile?.id === frontProfileId &&
        isDiscoveryImageWarm(nextUri)
      ) {
        setActivePhotoIndex(nextIndex);
      }
    });
  }, [
    activePhotoIndex,
    currentImages.length,
    frontProfile,
    shouldSuppressVisualChurn,
    syncFrontExtraPhotoState,
    trace,
  ]);

  const toggleBaseGender = (value: BaseGender) => {
    setDraftFilters((current) => {
      const nextSelected = current.selectedGenders.includes(value)
        ? current.selectedGenders.filter((item) => item !== value)
        : [...current.selectedGenders, value];

      return {
        ...current,
        selectedGenders: normalizeSelectedGenders(nextSelected),
      };
    });
  };

  const toggleTherianMode = (mode: Exclude<TherianMode, "exclude">) => {
    setDraftFilters((current) => ({
      ...current,
      therianMode: current.therianMode === mode ? "exclude" : mode,
    }));
  };

  const openFilters = () => {
    setDraftFilters({
      ...activeFilters,
      selectedGenders: [...activeFilters.selectedGenders],
    });
    setIsFilterVisible(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const closeFilters = () => {
    Keyboard.dismiss();
    setIsFilterVisible(false);
  };

  const applyFilters = () => {
    Keyboard.dismiss();
    void saveDiscoveryFilters({
      ...draftFilters,
      selectedGenders: [...draftFilters.selectedGenders],
    });
    resetCardState();
    setIsFilterVisible(false);
  };

  const clearFilters = () => {
    Keyboard.dismiss();
    setDraftFilters({
      ...defaultFilters,
      selectedGenders: [...defaultFilters.selectedGenders],
    });
    void saveDiscoveryFilters({
      ...defaultFilters,
      selectedGenders: [...defaultFilters.selectedGenders],
    });
    resetCardState();
    setIsFilterVisible(false);
  };

  const handleRetryDiscovery = useCallback(() => {
    if (isOffline) {
      return;
    }

    void refreshDiscoveryCandidates().then((ok) => {
      if (!ok) {
        return;
      }
      resetCardState();
    });
  }, [isOffline, refreshDiscoveryCandidates, resetCardState]);

  const handleResetSeenProfiles = useCallback(() => {
    void refreshDiscoveryCandidates().then((ok) => {
      if (!ok) {
        return;
      }
      resetCardState();
    });
  }, [refreshDiscoveryCandidates, resetCardState]);

  const animateButtonSwipeFeedback = useCallback(
    (direction: SwipeDirection, onComplete: () => void) => {
      const target = direction === "right" ? SWIPE_FEEDBACK_DISTANCE : -SWIPE_FEEDBACK_DISTANCE;
      swipeFeedbackX.setValue(0);
      Animated.sequence([
        Animated.timing(swipeFeedbackX, {
          toValue: target,
          duration: SWIPE_FEEDBACK_BUTTON_DURATION,
          useNativeDriver: false,
        }),
        Animated.delay(SWIPE_FEEDBACK_COMMIT_HOLD_DURATION),
      ]).start(({ finished }) => {
        if (!finished) {
          resetCardState();
          return;
        }
        onComplete();
      });
    },
    [resetCardState, swipeFeedbackX]
  );

  const holdGestureSwipeFeedback = useCallback(
    (onComplete: () => void) => {
      Animated.delay(SWIPE_FEEDBACK_COMMIT_HOLD_DURATION).start(({ finished }) => {
        if (!finished) {
          resetCardState();
          return;
        }
        onComplete();
      });
    },
    [resetCardState]
  );

  const commitDiscoverySwipe = useCallback(
    (direction: SwipeDirection, origin: SwipeCommitOrigin = "button") => {
      if (!frontProfile || isDeckAnimating || hasPendingDecision) {
        return false;
      }
      if (!secondReady) {
        swipeDirectionRef.current = direction;
        trace("swipe_blocked", {
          swipeDirection: direction,
          reason: "second_not_ready",
        });
        resetPosition();
        setSwipeState("idle");
        return false;
      }

      swipeDirectionRef.current = direction;
      trace("swipe_animation_start", {
        swipeDirection: direction,
        frontId: frontProfile.id,
        secondId: secondProfile?.id ?? null,
      });
      const profile = frontProfile;
      const previousDeck = deckRef.current;
      const requestId = createTraceId(
        `${direction === "right" ? "discovery_like" : "discovery_pass"}_${profile.id}`
      );
      const requestDecision = direction === "right" ? likeProfile : passProfile;
      setIsDeckAnimating(true);
      Haptics.impactAsync(
        direction === "right"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});

      const commitSwipe = () => {
        setPendingDecisionProfileId(profile.id);
        setPendingNoopReconcile(null);
        debugDiscoveryLog("swipe_commit", {
          requestId,
          direction,
          targetProfileId: profile.id,
          screenSessionId: screenSessionIdRef.current,
          pendingDecisionProfileId: profile.id,
        });
        trace("swipe_animation_end", {
          swipeDirection: direction,
          frontId: profile.id,
        });
        advanceDeck();
        void (async () => {
          const result = await requestDecision(profile, { requestId });
          if (!result) {
            setPendingDecisionProfileId(null);
            debugDiscoveryWarn("swipe_restore_after_failure", {
              requestId,
              direction,
              targetProfileId: profile.id,
            });
            restoreDeckAfterDecisionFailure(previousDeck);
            return;
          }
          if (!result.decisionApplied) {
            debugDiscoveryLog("swipe_reconcile_after_noop", {
              requestId,
              direction,
              targetProfileId: profile.id,
              decisionRejectedReason: result.decisionRejectedReason ?? null,
            });
            setPendingNoopReconcile({
              requestId,
              direction,
              targetProfileId: profile.id,
            });
            return;
          }

          recordDiscoverySwipe(direction, {
            requestId,
            targetProfileId: profile.id,
          });
          if (direction === "right") {
            setLastLikedProfile(profile);
          }
          setPendingDecisionProfileId(null);
          debugDiscoveryLog("swipe_applied", {
            requestId,
            direction,
            targetProfileId: profile.id,
          });

          if (
            direction === "right" &&
            result.shouldShowDiscoveryUpdate &&
            result.changedCategories.length
          ) {
            const message = buildPopularUpdateMessage(result.changedCategories);
            setPopularUpdateBanner({
              id: Date.now(),
              title: message.title,
              body: message.body,
            });
            setShowInsight(true);
          }
        })();
      };

      if (origin === "button") {
        animateButtonSwipeFeedback(direction, commitSwipe);
      } else {
        holdGestureSwipeFeedback(commitSwipe);
      }
      return true;
    },
    [
      advanceDeck,
      animateButtonSwipeFeedback,
      buildPopularUpdateMessage,
      frontProfile,
      hasPendingDecision,
      holdGestureSwipeFeedback,
      isDeckAnimating,
      likeProfile,
      passProfile,
      recordDiscoverySwipe,
      resetPosition,
      restoreDeckAfterDecisionFailure,
      secondReady,
      secondProfile?.id,
      trace,
    ]
  );

  const swipeRight = useCallback(
    (origin: SwipeCommitOrigin = "button") => commitDiscoverySwipe("right", origin),
    [commitDiscoverySwipe]
  );

  const swipeLeft = useCallback(
    (origin: SwipeCommitOrigin = "button") => commitDiscoverySwipe("left", origin),
    [commitDiscoverySwipe]
  );

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
        onPanResponderGrant: () => {
          swipeSessionIdRef.current = createTraceId("swipe");
          swipeDirectionRef.current = null;
          thresholdLoggedRef.current = false;
          swipeFeedbackX.setValue(0);
          trace("gesture_accepted", getTraceSnapshot());
        },
        onPanResponderMove: (_, gesture) => {
          const horizontalIntent = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
          if (horizontalIntent) {
            swipeFeedbackX.setValue(
              clampNumber(gesture.dx, -SWIPE_FEEDBACK_DISTANCE, SWIPE_FEEDBACK_DISTANCE)
            );
            const nextDirection: SwipeDirection | null =
              gesture.dx > 0 ? "right" : gesture.dx < 0 ? "left" : null;
            if (nextDirection) {
              swipeDirectionRef.current = nextDirection;
            }
            if (!thresholdLoggedRef.current && Math.abs(gesture.dx) >= SWIPE_THRESHOLD) {
              thresholdLoggedRef.current = true;
              trace("gesture_threshold_crossed", {
                swipeDirection: swipeDirectionRef.current,
                dx: gesture.dx,
                dy: gesture.dy,
              });
            }
            if (gesture.dx > 40) setSwipeState("like");
            else if (gesture.dx < -40) setSwipeState("dislike");
            else setSwipeState("idle");
            return;
          }

          if (!isInfoVisible && gesture.dy < 0) {
            swipeFeedbackX.setValue(0);
            position.setValue({ x: 0, y: gesture.dy * 0.4 });
            setSwipeState("idle");
          }
        },
        onPanResponderRelease: (_, gesture) => {
          trace("gesture_release", {
            swipeDirection: swipeDirectionRef.current,
            dx: gesture.dx,
            dy: gesture.dy,
          });
          const horizontalIntent = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
          if (horizontalIntent) {
            if (gesture.dx > SWIPE_THRESHOLD) {
              if (!swipeRight("gesture")) {
                resetPosition();
                setSwipeState("idle");
                swipeSessionIdRef.current = null;
                swipeDirectionRef.current = null;
                thresholdLoggedRef.current = false;
              }
            } else if (gesture.dx < -SWIPE_THRESHOLD) {
              if (!swipeLeft("gesture")) {
                resetPosition();
                setSwipeState("idle");
                swipeSessionIdRef.current = null;
                swipeDirectionRef.current = null;
                thresholdLoggedRef.current = false;
              }
            } else {
              resetPosition();
              setSwipeState("idle");
              swipeSessionIdRef.current = null;
              swipeDirectionRef.current = null;
              thresholdLoggedRef.current = false;
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
            swipeSessionIdRef.current = null;
            swipeDirectionRef.current = null;
            thresholdLoggedRef.current = false;
            return;
          }

          resetPosition();
          setSwipeState("idle");
          swipeSessionIdRef.current = null;
          swipeDirectionRef.current = null;
          thresholdLoggedRef.current = false;
        },
        onPanResponderTerminate: () => {
          trace("gesture_terminated", {
            swipeDirection: swipeDirectionRef.current,
          });
          resetPosition();
          setSwipeState("idle");
          swipeSessionIdRef.current = null;
          swipeDirectionRef.current = null;
          thresholdLoggedRef.current = false;
        },
      }),
    [
      getTraceSnapshot,
      isInfoVisible,
      resetPosition,
      setInfoVisible,
      swipeFeedbackX,
      swipeLeft,
      swipeRight,
      trace,
    ]
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
            <Feather
              name="sliders"
              size={18}
              color={hasActiveFilters ? Colors.like : Colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {popularUpdateBanner ? (
        <View style={styles.popularUpdateWrap}>
          <View style={styles.popularUpdateCard}>
            <View style={styles.popularUpdateIcon}>
              <Feather name="trending-up" size={15} color={Colors.primaryLight} />
            </View>
            <View style={styles.popularUpdateBody}>
              <Text style={styles.popularUpdateTitle}>
                {popularUpdateBanner.title}
              </Text>
              <Text style={styles.popularUpdateText}>
                {popularUpdateBanner.body}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {isOffline && hasDeckProfiles ? (
        <View style={styles.offlineBannerWrap}>
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={14} color={Colors.info} />
            <View style={styles.offlineBannerBody}>
              <Text style={styles.offlineBannerTitle}>
                {t("Modo sin conexión", "Offline mode")}
              </Text>
              <Text style={styles.offlineBannerText}>
                {lastSyncLabel
                  ? t(
                      `Seguimos con perfiles guardados. Última sincronización: ${lastSyncLabel}`,
                      `Still using cached profiles. Last sync: ${lastSyncLabel}`
                    )
                  : t(
                      "Seguimos con perfiles guardados hasta que vuelva la conexión.",
                      "Still using cached profiles until the connection returns."
                    )}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasDeckProfiles && frontProfile ? (
        <>
          <View
            style={styles.cardStack}
            onLayout={(event) => {
              const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
              logLayoutChange("card_stack", {
                width: nextWidth,
                height: nextHeight,
              });
            }}
          >
            <Animated.View
              key={thirdShellId}
              pointerEvents="none"
              style={[
                styles.cardBase,
                cardFrameStyle,
                styles.cardThird,
                !thirdProfile && styles.cardSlotHidden,
                {
                  opacity: thirdProfile ? promotedThirdOpacity : 0,
                  transform: [
                    { scale: promotedThirdScale },
                    { translateY: promotedThirdTranslateY },
                  ],
                },
              ]}
            >
              {thirdProfile ? <View style={styles.cardThirdBackdrop} /> : null}
            </Animated.View>

            <Animated.View
              key={secondShellId}
              pointerEvents="none"
              style={[
                styles.cardBase,
                cardFrameStyle,
                styles.cardSecond,
                !secondProfile && styles.cardSlotHidden,
                {
                  opacity: secondProfile ? promotedSecondOpacity : 0,
                  transform: [
                    { scale: promotedSecondScale },
                    { translateY: promotedSecondTranslateY },
                  ],
                },
              ]}
            >
              {secondProfile ? (
                <>
                  <DiscoveryCardTrace
                    slot="second"
                    logicalId={secondProfile.id}
                    renderKey={secondCardKey}
                    enabled={traceFocused}
                    trace={trace}
                  />
                  <ExpoImage
                    source={{ uri: secondProfile.images[0] }}
                    recyclingKey={
                      shouldUseStableSlotImageKeys ? "second-slot" : secondImageKey
                    }
                    style={[
                      styles.cardImage,
                      !secondSlot.primaryReady && styles.cardImagePending,
                    ]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    onLoadStart={() => {
                      trace("image_load_start", {
                        slot: "second",
                        profileId: secondProfile.id,
                        imageKey: secondImageKey,
                        uri: secondProfile.images[0],
                      });
                    }}
                    onLoadEnd={() => {
                      trace("image_load_end", {
                        slot: "second",
                        profileId: secondProfile.id,
                        imageKey: secondImageKey,
                        uri: secondProfile.images[0],
                      });
                      markSlotReady("second", secondProfile.id);
                    }}
                    onError={() => {
                      trace("image_load_error", {
                        slot: "second",
                        profileId: secondProfile.id,
                        imageKey: secondImageKey,
                        uri: secondProfile.images[0],
                      });
                      markSlotReady("second", secondProfile.id);
                    }}
                  />
                </>
              ) : null}
            </Animated.View>

            <Animated.View
              key={frontShellId}
              {...panResponder.panHandlers}
              style={[
                styles.cardBase,
                cardFrameStyle,
                styles.cardInteractive,
                {
                  transform: [
                    { translateX: position.x },
                    { translateY: position.y },
                    { rotate },
                  ],
                },
              ]}
              onLayout={(event) => {
                const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
                logLayoutChange("front_card", {
                  width: nextWidth,
                  height: nextHeight,
                });
              }}
            >
              <DiscoveryCardTrace
                slot="front"
                logicalId={frontProfile.id}
                renderKey={frontCardKey}
                enabled={traceFocused}
                trace={trace}
              />
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
                <ExpoImage
                  source={{ uri: currentImage }}
                  recyclingKey={
                    shouldUseStableSlotImageKeys ? "front-slot" : frontImageKey
                  }
                  style={styles.cardImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                  onLoadStart={() => {
                    setFrontImageLoading(true);
                    trace("image_load_start", {
                      slot: "front",
                      profileId: frontProfile.id,
                      imageKey: frontImageKey,
                      uri: currentImage,
                    });
                  }}
                  onLoadEnd={() => {
                    setFrontImageLoading(false);
                    trace("image_load_end", {
                      slot: "front",
                      profileId: frontProfile.id,
                      imageKey: frontImageKey,
                      uri: currentImage,
                    });
                    markSlotReady("front", frontProfile.id);
                  }}
                  onError={() => {
                    setFrontImageLoading(false);
                    trace("image_load_error", {
                      slot: "front",
                      profileId: frontProfile.id,
                      imageKey: frontImageKey,
                      uri: currentImage,
                    });
                    markSlotReady("front", frontProfile.id);
                  }}
                />
                {frontImageLoading ? (
                  <View style={styles.frontCardLoadingOverlay}>
                    <ActivityIndicator color={Colors.primaryLight} />
                  </View>
                ) : null}

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
                    <Animated.View
                      style={{
                        transform: [
                          { scale: likeStampScale },
                          { translateY: likeStampTranslateY },
                        ],
                      }}
                    >
                      <View style={styles.likeStamp}>
                        <Feather name="heart" size={28} color="#fff" />
                        <Text style={styles.stampText}>{t("ME GUSTA", "LIKE")}</Text>
                      </View>
                    </Animated.View>
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
                    <Animated.View
                      style={{
                        transform: [
                          { scale: dislikeStampScale },
                          { translateY: dislikeStampTranslateY },
                        ],
                      }}
                    >
                      <View style={styles.dislikeStamp}>
                        <Feather name="x" size={28} color="#fff" />
                        <Text style={styles.stampText}>{t("PASAR", "PASS")}</Text>
                      </View>
                    </Animated.View>
                  </View>
                </Animated.View>

                <LinearGradient
                  colors={["transparent", "rgba(15,26,20,0.98)"]}
                  style={styles.cardGradient}
                >
                  {pronounLabel ? (
                    <Text style={styles.cardPronouns}>{pronounLabel}</Text>
                  ) : null}
                  <Text style={styles.cardName}>{frontProfile.name}</Text>
                  {genderIdentityLabel ? (
                    <Text style={styles.cardIdentity}>{genderIdentityLabel}</Text>
                  ) : null}
                  <Text style={styles.cardAgeSign}>{ageWithSign}</Text>
                  <View style={styles.cardRow}>
                    <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                    <Text style={styles.cardLocation}>{frontProfile.location}</Text>
                    <Text style={styles.cardDot}>·</Text>
                    <Text style={styles.cardOccupation}>
                      {t(frontProfile.occupation.es, frontProfile.occupation.en)}
                    </Text>
                  </View>

                  <View style={styles.interestsRow}>
                    {frontProfile.attributes.interests.slice(0, 3).map((interest) => (
                      <View
                        key={`${frontProfile.id}-${interest}`}
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
                          key={`${frontProfile.id}-photo-dot-${index}`}
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
                    {frontProfile.name}, {frontProfile.age}
                  </Text>
                  <Text style={styles.backMeta}>
                    {frontProfile.location} · {t(frontProfile.occupation.es, frontProfile.occupation.en)}
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
                      value={t(frontProfile.about.bio.es, frontProfile.about.bio.en)}
                    />
                    <AboutRow
                      icon="heart"
                      label={t("Metas de tu relación", "Relationship goals")}
                      value={getRelationshipGoalLabel(frontProfile.about.relationshipGoals, t)}
                    />
                    <AboutRow
                      icon="book-open"
                      label={t("Educación", "Education")}
                      value={getEducationLabel(frontProfile.about.education, t)}
                    />
                    <AboutRow
                      icon="users"
                      label={t("Hijxs", "Children")}
                      value={getChildrenPreferenceLabel(
                        frontProfile.about.childrenPreference,
                        t
                      )}
                    />
                    <AboutRow
                      icon="globe"
                      label={t("Idiomas", "Languages")}
                      value={
                        <View style={styles.flagImageRow}>
                          {frontProfile.about.languagesSpoken.map((value) => {
                            const uri = getLanguageFlagUri(value);
                            return uri ? (
                              <ExpoImage
                                key={`${frontProfile.id}-${value}`}
                                source={{ uri }}
                                style={styles.flagImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <View
                                key={`${frontProfile.id}-${value}`}
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
                          frontProfile.lifestyle.physicalActivity,
                          t
                        )}
                      />
                      <LifestyleTile
                        icon="coffee"
                        label={t("Bebida", "Drink")}
                        value={getAlcoholUseLabel(frontProfile.lifestyle.alcoholUse, t)}
                      />
                      <LifestyleTile
                        icon="wind"
                        label={t("Tabaco", "Smoke")}
                        value={getTobaccoUseLabel(frontProfile.lifestyle.tobaccoUse, t)}
                      />
                      <LifestyleTile
                        icon="flag"
                        label={t("Política", "Politics")}
                        value={getPoliticalInterestLabel(
                          frontProfile.lifestyle.politicalInterest,
                          t
                        )}
                      />
                      <LifestyleTile
                        icon="star"
                        label={t("Religión", "Religion")}
                        value={getReligionImportanceLabel(
                          frontProfile.lifestyle.religionImportance,
                          t
                        )}
                      />
                      <LifestyleTile
                        icon="moon"
                        label={t("Creencia", "Belief")}
                        value={getReligionLabel(frontProfile.lifestyle.religion, t)}
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
                      value={getBodyTypeLabel(frontProfile.physical.bodyType, t)}
                    />
                    <PhysicalRow
                      icon="maximize-2"
                      label={t("Altura", "Height")}
                      value={frontProfile.physical.height}
                    />
                    <PhysicalRow
                      icon="feather"
                      label={t("Color de cabello", "Hair color")}
                      value={getHairColorLabel(frontProfile.physical.hairColor, t)}
                    />
                    <PhysicalRow
                      icon="map"
                      label={t("Etnia", "Ethnicity")}
                      value={getEthnicityLabel(frontProfile.physical.ethnicity, t)}
                    />
                  </View>
                </ScrollView>
              </Animated.View>
            </Animated.View>
          </View>

          <View style={[styles.actions, { paddingBottom: bottomPad + 80 }]}>
            <Pressable
              onPress={() => swipeLeft("button")}
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
              onPress={() => swipeRight("button")}
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
      ) : isOfflineDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Feather name="wifi-off" size={24} color={Colors.info} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t(
                "Sin conexión para cargar más perfiles",
                "You are offline and we cannot load more profiles"
              )}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {lastSyncLabel
                ? t(
                    `Vuelve a conectarte o reintenta. Última sincronización: ${lastSyncLabel}.`,
                    `Reconnect or retry. Last sync: ${lastSyncLabel}.`
                  )
                : t(
                    "Vuelve a conectarte o reintenta para seguir descubriendo.",
                    "Reconnect or retry to keep discovering."
                  )}
            </Text>
            <Pressable
              onPress={handleRetryDiscovery}
              disabled={isOffline}
              style={({ pressed }) => [
                styles.emptyCardButton,
                isOffline && styles.emptyCardButtonDisabled,
                pressed && !isOffline && { opacity: 0.84 },
              ]}
            >
              <Text
                style={[
                  styles.emptyCardButtonText,
                  isOffline && styles.emptyCardButtonTextDisabled,
                ]}
              >
                {t("Reintentar", "Retry")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : isOnlineDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Feather name="check-circle" size={24} color={Colors.info} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t("No hay más perfiles por ahora", "No more profiles for now")}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {t(
                "Ya viste todos los perfiles disponibles con esta selección. Busca perfiles nuevos o limpia filtros para ampliar la búsqueda.",
                "You have seen all available profiles for this selection. Check for new profiles or clear filters to broaden the search."
              )}
            </Text>
            <View style={styles.emptyCardActions}>
              <Pressable
                onPress={handleResetSeenProfiles}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text style={styles.emptyCardButtonText}>
                  {t("Buscar nuevos perfiles", "Check for new profiles")}
                </Text>
              </Pressable>
              <Pressable
                onPress={clearFilters}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  styles.emptyCardButtonSecondary,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text
                  style={[
                    styles.emptyCardButtonText,
                    styles.emptyCardButtonTextSecondary,
                  ]}
                >
                  {t("Limpiar filtros", "Clear filters")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : isSeenDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Feather name="refresh-ccw" size={24} color={Colors.info} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t(
                "Ya viste todos los perfiles de este filtro",
                "You have already seen every profile in this filter"
              )}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {t(
                "Mantén este filtro y revisa si hay perfiles nuevos disponibles, o cambia los valores para descubrir gente nueva.",
                "Keep this filter and check for newly available profiles, or change the values to discover new people."
              )}
            </Text>
            <View style={styles.emptyCardActions}>
              <Pressable
                onPress={handleResetSeenProfiles}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text style={styles.emptyCardButtonText}>
                  {t("Buscar nuevos perfiles", "Check for new profiles")}
                </Text>
              </Pressable>
              <Pressable
                onPress={clearFilters}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  styles.emptyCardButtonSecondary,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text
                  style={[
                    styles.emptyCardButtonText,
                    styles.emptyCardButtonTextSecondary,
                  ]}
                >
                  {t("Limpiar filtros", "Clear filters")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
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
            <View style={styles.emptyCardActions}>
              <Pressable
                onPress={handleRetryDiscovery}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text style={styles.emptyCardButtonText}>
                  {t("Volver a cargar", "Reload")}
                </Text>
              </Pressable>
              <Pressable
                onPress={clearFilters}
                style={({ pressed }) => [
                  styles.emptyCardButton,
                  styles.emptyCardButtonInline,
                  styles.emptyCardButtonSecondary,
                  pressed && { opacity: 0.84 },
                ]}
              >
                <Text
                  style={[
                    styles.emptyCardButtonText,
                    styles.emptyCardButtonTextSecondary,
                  ]}
                >
                  {t("Limpiar filtros", "Clear filters")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={locationPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationPromptVisible(false)}
      >
        <View style={styles.locationPromptOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setLocationPromptVisible(false)}
          />
          <View style={styles.locationPromptCard}>
            <View style={styles.locationPromptIcon}>
              <Feather name="map-pin" size={18} color={Colors.primaryLight} />
            </View>
            <Text style={styles.locationPromptTitle}>
              {t("Activa tu ubicación", "Enable your location")}
            </Text>
            <Text style={styles.locationPromptCopy}>
              {locationPromptReason === "services_disabled"
                ? t(
                    "MatchA funciona mejor con el GPS activado. Enciéndelo para actualizar tu ciudad y mejorar discovery.",
                    "MatchA works better with GPS enabled. Turn it on to update your city and improve discovery."
                  )
                : t(
                    "MatchA funciona mejor con la ubicación activada. Permítela para actualizar tu ciudad y mejorar discovery.",
                    "MatchA works better with location enabled. Allow it to update your city and improve discovery."
                  )}
            </Text>
            <View style={styles.locationPromptActions}>
              <Pressable
                onPress={() => setLocationPromptVisible(false)}
                style={({ pressed }) => [
                  styles.locationPromptButton,
                  styles.locationPromptButtonSecondary,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text style={styles.locationPromptButtonSecondaryText}>
                  {t("Cerrar", "Close")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void (async () => {
                    const result = await refreshProfileLocation({
                      reason: "discover_entry",
                      force: true,
                    });
                    if (result.status === "updated" || result.status === "skipped_recent_sync") {
                      setLocationPromptVisible(false);
                      return;
                    }
                    if (
                      result.status === "permission_denied" ||
                      result.status === "services_disabled"
                    ) {
                      setLocationPromptReason(result.status);
                      await Linking.openSettings().catch(() => {});
                    }
                  })();
                }}
                style={({ pressed }) => [
                  styles.locationPromptButton,
                  styles.locationPromptButtonPrimary,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text style={styles.locationPromptButtonPrimaryText}>
                  {t("Activar", "Enable")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="fade"
        onRequestClose={closeFilters}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={closeFilters}
          />
          <KeyboardSheet
            style={styles.filterKeyboardSheet}
            contentStyle={styles.filterKeyboardContent}
            keyboardVerticalOffset={topPad + 6}
            bottomInset={0}
          >
            <View
              style={[
                styles.filterSheet,
                {
                  top: topPad + 6,
                  width: Math.min(width - 32, 340),
                  maxHeight: height - topPad - filterBottomObstruction - 24,
                },
              ]}
            >
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
                  onPress={closeFilters}
                  style={({ pressed }) => [styles.filterCloseBtn, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="x" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.filterSheetBody}
                contentContainerStyle={styles.filterSheetBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
              >
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>{t("Interés", "Interest")}</Text>
                  <View style={styles.filterCheckboxGroup}>
                    {baseGenderOptions.map((option) => (
                      <FilterCheckboxRow
                        key={option.value}
                        label={option.label}
                        selected={draftFilters.selectedGenders.includes(option.value)}
                        onPress={() => toggleBaseGender(option.value)}
                      />
                    ))}
                  </View>
                  <View style={styles.filterTherianGroup}>
                    <FilterCheckboxRow
                      label={t("Incluir Therians", "Include Therians")}
                      selected={draftFilters.therianMode === "include"}
                      onPress={() => toggleTherianMode("include")}
                      compact
                    />
                    <FilterCheckboxRow
                      label={t("Solo Therians", "Only Therians")}
                      selected={draftFilters.therianMode === "only"}
                      onPress={() => toggleTherianMode("only")}
                      compact
                    />
                  </View>
                </View>

                <AgeRangeFields
                  bounds={ageBounds}
                  valueMin={draftFilters.ageMin}
                  valueMax={draftFilters.ageMax}
                  onChange={(ageMin, ageMax) =>
                    setDraftFilters((current) => ({ ...current, ageMin, ageMax }))
                  }
                  t={t}
                />
              </ScrollView>

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
          </KeyboardSheet>
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
  popularUpdateWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  offlineBannerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(90,169,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.18)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  offlineBannerBody: {
    flex: 1,
    gap: 2,
  },
  offlineBannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  offlineBannerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  popularUpdateCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(82, 183, 136, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(82, 183, 136, 0.22)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  popularUpdateIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(82, 183, 136, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  popularUpdateBody: {
    flex: 1,
    gap: 2,
  },
  popularUpdateTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  popularUpdateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
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
    borderColor: Colors.like,
    backgroundColor: "rgba(82, 183, 136, 0.16)",
  },
  filterModalRoot: {
    flex: 1,
  },
  filterKeyboardSheet: {
    ...StyleSheet.absoluteFillObject,
  },
  filterKeyboardContent: {
    flex: 1,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,10,8,0.48)",
  },
  filterSheet: {
    position: "absolute",
    right: 16,
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
  filterSheetBody: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  filterSheetBodyContent: {
    gap: 16,
    paddingBottom: 8,
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
  filterCheckboxGroup: {
    gap: 10,
  },
  filterTherianGroup: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filterCheckboxRow: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterCheckboxRowSelected: {
    borderColor: Colors.like,
    backgroundColor: "rgba(82, 183, 136, 0.16)",
  },
  filterCheckboxRowCompact: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  filterCheckboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCheckboxBoxSelected: {
    borderColor: Colors.like,
    backgroundColor: Colors.like,
  },
  filterCheckboxBoxCompact: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  filterCheckboxLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  filterCheckboxLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  filterCheckboxLabelSelected: {
    color: Colors.primaryLight,
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
    backgroundColor: Colors.like,
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
  emptyCardActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  emptyCardButtonInline: {
    flex: 1,
    marginTop: 0,
  },
  emptyCardButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  emptyCardButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyCardButtonTextSecondary: {
    color: Colors.text,
  },
  emptyCardButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyCardButtonTextDisabled: {
    color: Colors.textMuted,
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
  frontCardLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,26,20,0.24)",
    zIndex: 2,
  },
  cardThirdBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.backgroundCard,
  },
  cardImagePending: {
    opacity: 0,
  },
  cardSlotHidden: {
    opacity: 0,
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
  cardIdentity: {
    marginTop: 3,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.ivoryDim,
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
  locationPromptOverlay: {
    flex: 1,
    backgroundColor: "rgba(5,10,8,0.56)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  locationPromptCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 22,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  locationPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.28)",
  },
  locationPromptTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  locationPromptCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  locationPromptActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  locationPromptButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  locationPromptButtonPrimary: {
    backgroundColor: Colors.like,
  },
  locationPromptButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationPromptButtonPrimaryText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  locationPromptButtonSecondaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
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
