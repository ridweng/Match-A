import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
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
import {
  buildDiscoveryQueueSlot,
  hasValidDiscoveryWindowCache,
  useApp,
  type DiscoveryQueueSlot,
} from "@/context/AppContext";
import { getZodiacSignFromIsoDate, getZodiacSignLabel } from "@/utils/dateOfBirth";
import {
  isDiscoveryImageWarm,
  isDiscoveryProfileWarm,
  warmDiscoveryDeck,
  warmDiscoveryFrontExtras,
  warmDiscoveryProfileImages,
} from "@/utils/discoveryPreload";
import {
  applyDecisionToQueue,
  assertDiscoveryQueueInvariants,
  discoveryIdsEqual,
  getDiscoveryQueueIds,
  normalizeDiscoveryProfileId,
} from "@/utils/discoveryQueue";
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

const SWIPE_OUT_DURATION = 280;
const SWIPE_THRESHOLD = 80;
const SWIPE_FEEDBACK_DISTANCE = 150;
const SWIPE_FEEDBACK_BUTTON_DURATION = 210;
const SWIPE_FEEDBACK_COMMIT_HOLD_DURATION = 0;
const SWIPE_FEEDBACK_RESET_DURATION = 180;
const INFO_SWIPE_THRESHOLD = 82;
const INSIGHT_SHEET_DISMISS_THRESHOLD = 96;
const INSIGHT_SHEET_DISMISS_VELOCITY = 1.05;
const INSIGHT_SHEET_RESET_DURATION = 180;
const IS_WEB = Platform.OS === "web";
// Deck shows 3, but we keep a 4th "tail" entry around so the third card can
// instantly promote without waiting for network/image downloads.
const DISCOVERY_PAGE_SIZE = 3;
const DISCOVERY_QUEUE_CACHE_SIZE = 3;
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

type SlotId = "slotA" | "slotB" | "slotC";
type SlotPhase = "full" | "cover" | "metadata";
type SlotContent = {
  profileId: number;
  publicId: string;
  profile: DiscoverProfile;
  phase: SlotPhase;
  images: string[];
  coverImageUri: string | null;
};
type StableDeck = {
  front: SlotId; second: SlotId; third: SlotId;
  slotA: SlotContent | null;
  slotB: SlotContent | null;
  slotC: SlotContent | null;
};

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
type DiscoverEntry = DiscoveryQueueSlot;
type SwipeDirection = "left" | "right";
type SwipeCommitOrigin = "gesture" | "button";
type TraceLayout = {
  width: number;
  height: number;
};
type DiscoverProfile = DiscoveryFeedProfileResponse;
type RenderState = "idle" | "gesture_active" | "promotion_committing" | "hard_invalidating";
type HardInvalidationReason =
  | "init"
  | "filters"
  | "cursor_stale"
  | "policy_invalidated"
  | "queue_invalidated"
  | "explicit_reset";
type FrozenFrontPayload = {
  slotId: SlotId;
  profile: DiscoverProfile;
  displayedImageUri: string | null;
  activePhotoIndex: number;
  isInfoVisible: boolean;
  images: string[];
};
type DiscoveryQueueTracePayload = Parameters<
  ReturnType<typeof useApp>["recordDiscoveryQueueTrace"]
>[0];

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

function makeSlotContent(
  profile: DiscoverProfile,
  phase: SlotPhase
): SlotContent {
  const coverImageUri = profile.images[0] ?? null;
  const images =
    phase === "full"
      ? profile.images
      : phase === "cover" && coverImageUri
        ? [coverImageUri]
        : [];
  return {
    profileId: profile.id,
    publicId: (profile as any).publicId ?? String(profile.id),
    profile,
    phase,
    images,
    coverImageUri,
  };
}

function buildStableDeck(entries: DiscoverEntry[]): StableDeck {
  return {
    front: "slotA",
    second: "slotB",
    third: "slotC",
    slotA: entries[0] ? makeSlotContent(entries[0].profile, "full") : null,
    slotB: entries[1] ? makeSlotContent(entries[1].profile, "cover") : null,
    slotC: entries[2] ? makeSlotContent(entries[2].profile, "metadata") : null,
  };
}

// Rotates roles. The Animated.View keys never change.
// The recycled front slot gets the replacement profile.
function rotateStableDeck(
  current: StableDeck,
  replacementProfile: DiscoverProfile | null
): StableDeck {
  const recycled = current.front; // this slot gets new content
  return {
    front: current.second,
    second: current.third,
    third: recycled,
    slotA: current.slotA,
    slotB: current.slotB,
    slotC: current.slotC,
    // Overwrite only the recycled slot
    [recycled]: replacementProfile
      ? makeSlotContent(replacementProfile, "metadata")
      : null,
  };
}

function getSlotContent(
  stableDeck: StableDeck,
  role: "front" | "second" | "third"
): SlotContent | null {
  return stableDeck[stableDeck[role]];
}

// When the second slot promotes to front, upgrade its phase to "full"
function upgradeSlotToFull(stableDeck: StableDeck, slotId: SlotId): StableDeck {
  const current = stableDeck[slotId];
  if (!current || current.phase === "full") return stableDeck;
  return {
    ...stableDeck,
    [slotId]: makeSlotContent(current.profile, "full"),
  };
}

// When the third slot promotes to second, upgrade its phase to "cover"
function upgradeSlotToCover(stableDeck: StableDeck, slotId: SlotId): StableDeck {
  const current = stableDeck[slotId];
  if (!current || current.phase !== "metadata") return stableDeck;
  return {
    ...stableDeck,
    [slotId]: makeSlotContent(current.profile, "cover"),
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
    authStatus,
    hasAccessToken,
    user,
    isOnline,
    likeProfile,
    passProfile,
    goals,
    language,
    discoveryFeed,
    discoveryQueueRuntime,
    discoveryFilters,
    lastServerSyncAt,
    recordDiscoverySwipe,
    recordDiscoveryQueueTrace,
    refreshProfileLocation,
    refreshDiscoveryCandidates,
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
  const [stableDeck, setStableDeck] = useState<StableDeck>(() => buildStableDeck([]));
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderLineageToken, setRenderLineageToken] = useState(0);
  const [hardInvalidationReason, setHardInvalidationReason] =
    useState<HardInvalidationReason | null>(null);
  const [frozenFrontPayload, setFrozenFrontPayload] = useState<FrozenFrontPayload | null>(null);
  const stableDeckRef = useRef<StableDeck>(stableDeck);
  const swipingRef = useRef(false);
  const swipeStateRef = useRef<SwipeState>("idle");
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [locationPromptReason, setLocationPromptReason] = useState<
    "permission_denied" | "services_disabled" | "sync_failed" | null
  >(null);
  const [isLocationPromptBusy, setIsLocationPromptBusy] = useState(false);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const pendingLocationSettingsReturnRef = useRef(false);
  const screenSessionIdRef = useRef(createTraceId("discover"));
  const swipeSessionIdRef = useRef<string | null>(null);
  const swipeDirectionRef = useRef<SwipeDirection | null>(null);
  const thresholdLoggedRef = useRef(false);
  const previousLayoutRef = useRef<Record<string, TraceLayout>>({});
  const previousTraceSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const deferredDeckRebuildRef = useRef(false);
  const expectedRenderQueueRef = useRef<{
    requestId: string | null;
    resultQueue: Array<string | number>;
  } | null>(null);
  const lastHydratedPolicyVersionRef = useRef<string | null>(null);
  const loggedHeadMismatchRef = useRef<string | null>(null);
  const loggedExpectedRenderResultRef = useRef<string | null>(null);
  const traceFocused = discoveryVerboseDebugEnabled && pathname.endsWith("/discover");

  const position = useRef(new Animated.ValueXY()).current;
  const swipeFeedbackX = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const deckProgress = useRef(new Animated.Value(0)).current;
  const insightSheetTranslateY = useRef(new Animated.Value(0)).current;
  const insightSheetClosingRef = useRef(false);
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
    swipeStateRef.current = swipeState;
  }, [swipeState]);

  const updateSwipeState = useCallback((next: SwipeState) => {
    if (swipeStateRef.current === next) {
      return;
    }
    swipeStateRef.current = next;
    setSwipeState(next);
  }, []);

  const dismissInsightSheet = useCallback(
    (animated = true) => {
      if (insightSheetClosingRef.current) {
        return;
      }

      const finalize = () => {
        insightSheetClosingRef.current = false;
        insightSheetTranslateY.setValue(0);
        setShowInsight(false);
      };

      if (!animated) {
        finalize();
        return;
      }

      insightSheetClosingRef.current = true;
      Animated.timing(insightSheetTranslateY, {
        toValue: Math.max(220, height * 0.32),
        duration: 190,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          insightSheetClosingRef.current = false;
          return;
        }
        finalize();
      });
    },
    [height, insightSheetTranslateY]
  );

  useEffect(() => {
    if (showInsight) {
      insightSheetClosingRef.current = false;
      insightSheetTranslateY.setValue(0);
    }
  }, [insightSheetTranslateY, showInsight]);

  const insightSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 6,
        onPanResponderGrant: () => {
          insightSheetTranslateY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy <= 0) {
            insightSheetTranslateY.setValue(0);
            return;
          }
          insightSheetTranslateY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dy > INSIGHT_SHEET_DISMISS_THRESHOLD ||
            gestureState.vy > INSIGHT_SHEET_DISMISS_VELOCITY
          ) {
            dismissInsightSheet();
            return;
          }

          Animated.timing(insightSheetTranslateY, {
            toValue: 0,
            duration: INSIGHT_SHEET_RESET_DURATION,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(insightSheetTranslateY, {
            toValue: 0,
            duration: INSIGHT_SHEET_RESET_DURATION,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismissInsightSheet, insightSheetTranslateY]
  );

  const dismissLocationPrompt = useCallback(() => {
    pendingLocationSettingsReturnRef.current = false;
    setIsLocationPromptBusy(false);
    setLocationPromptVisible(false);
    setLocationPromptReason(null);
    debugDiscoveryLog("prompt_closed_manual", {
      origin: "manual_dismiss",
    });
  }, []);

  useEffect(() => {
    if (!pathname.endsWith("/discover")) {
      pendingLocationSettingsReturnRef.current = false;
      setIsLocationPromptBusy(false);
      setLocationPromptVisible(false);
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

  // Authoritative 3-Card Window Rule:
  // MUST call GET /window if we don't have exactly 3 valid, distinct cards cached.
  // MAY skip GET /window ONLY if we have exactly 3 valid, distinct cards.
  useEffect(() => {
    if (!pathname.endsWith("/discover") || !hasAccessToken) {
      return;
    }
    
    const hasValidCache = hasValidDiscoveryWindowCache(discoveryQueueRuntime);
    
    if (!hasValidCache) {
      setIsQueueLoading(true);
      void refreshDiscoveryCandidates().finally(() => {
        setIsQueueLoading(false);
      });
    }
  }, [pathname, hasAccessToken, discoveryQueueRuntime]);

  const retryLocationPromptFlow = useCallback(
    async (origin: "prompt_button" | "app_foreground") => {
      const requestId = createTraceId("discover_location");
      debugDiscoveryLog("prompt_primary_pressed", {
        origin,
        requestId,
      });
      debugDiscoveryLog("permission_recheck_started", {
        origin,
        requestId,
      });
      debugDiscoveryLog("discover_location_sync_started", {
        origin,
        requestId,
      });
      setIsLocationPromptBusy(true);

      const result = await refreshProfileLocation({
        reason: "discover_entry",
        force: true,
        requestId,
      });

      debugDiscoveryLog("permission_recheck_result", {
        origin,
        requestId,
        status: result.status,
        code: result.code ?? null,
        message: result.message ?? null,
      });

      if (result.status === "updated") {
        debugDiscoveryLog("discover_location_sync_succeeded", {
          origin,
          requestId: result.requestId ?? requestId,
          status: result.status,
          nextLocation: result.nextLocation ?? null,
        });
        setLocationPromptVisible(false);
        setLocationPromptReason(null);
        setIsLocationPromptBusy(false);
        pendingLocationSettingsReturnRef.current = false;
        debugDiscoveryLog("prompt_closed_after_sync", {
          origin,
          requestId: result.requestId ?? requestId,
        });
        const ok = await refreshDiscoveryCandidates();
        debugDiscoveryLog("discovery_reload_after_location_sync", {
          origin,
          requestId: result.requestId ?? requestId,
          ok,
        });
        return { openedSettings: false, recovered: true };
      }

      if (result.status === "skipped_recent_sync") {
        debugDiscoveryWarn("discover_location_sync_failed", {
          origin,
          requestId: result.requestId ?? requestId,
          status: result.status,
          message: "forced prompt flow requires a fresh sync",
        });
        setLocationPromptReason("sync_failed");
        setLocationPromptVisible(true);
        setIsLocationPromptBusy(false);
        return { openedSettings: false, recovered: false, shouldOpenSettings: false };
      }

      if (
        result.status === "permission_denied" ||
        result.status === "services_disabled"
      ) {
        setLocationPromptReason(result.status);
        setLocationPromptVisible(true);
        setIsLocationPromptBusy(false);
        debugDiscoveryWarn("discover_location_sync_failed", {
          origin,
          requestId: result.requestId ?? requestId,
          status: result.status,
          canAskAgain: result.canAskAgain ?? null,
        });
        return {
          openedSettings: false,
          recovered: false,
          shouldOpenSettings:
            result.status === "services_disabled" ||
            (result.status === "permission_denied" && result.canAskAgain === false),
        };
      }

      setLocationPromptReason("sync_failed");
      setLocationPromptVisible(true);
      setIsLocationPromptBusy(false);
      debugDiscoveryWarn("discover_location_sync_failed", {
        origin,
        requestId: result.requestId ?? requestId,
        status: result.status,
        code: result.code ?? null,
        message: result.message ?? null,
      });
      return { openedSettings: false, recovered: false, shouldOpenSettings: false };
    },
    [refreshDiscoveryCandidates, refreshProfileLocation, user?.id]
  );

  useEffect(() => {
    if (!pathname.endsWith("/discover")) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !pendingLocationSettingsReturnRef.current) {
        return;
      }

      void retryLocationPromptFlow("app_foreground");
    });

    return () => {
      subscription.remove();
    };
  }, [pathname, retryLocationPromptFlow]);

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

  const isOffline = !isOnline;

  const queueItems = discoveryQueueRuntime.queue.items ?? [];
  const sourceEntries = useMemo(() => queueItems, [queueItems]);
  const filteredEntries = useMemo(() => sourceEntries, [sourceEntries]);
  const supply = discoveryFeed.supply;
  const eligibleCount = Number(supply?.eligibleCount) || 0;
  const unseenCount = Number(supply?.unseenCount) || 0;
  const refillThreshold = Math.max(1, Number(supply?.refillThreshold) || 2);
  const hasMoreServerProfiles = Boolean(discoveryFeed.hasMore);
  const hasFilterMatches = sourceEntries.length > 0;
  const hasCatalogMatches = eligibleCount > 0;
  const frontContent = getSlotContent(stableDeck, "front");
  const secondContent = getSlotContent(stableDeck, "second");
  const thirdContent = getSlotContent(stableDeck, "third");
  const frontEntry = frontContent
    ? buildDiscoveryQueueSlot(frontContent.profile, frontContent.phase)
    : null;
  const frontProfile = frontContent?.profile ?? null;
  const secondProfile = secondContent?.profile ?? null;
  const thirdProfile = thirdContent?.profile ?? null;
  const logicalQueueIds = useMemo(
    () => getDiscoveryQueueIds(queueItems.slice(0, DISCOVERY_QUEUE_CACHE_SIZE)),
    [queueItems]
  );
  const renderedQueueIds = useMemo(
    () => [
      normalizeDiscoveryProfileId(frontProfile?.id ?? null),
      normalizeDiscoveryProfileId(secondProfile?.id ?? null),
      normalizeDiscoveryProfileId(thirdProfile?.id ?? null),
    ],
    [frontProfile?.id, secondProfile?.id, thirdProfile?.id]
  );
  const logicalActiveProfileId = logicalQueueIds[0] ?? null;
  const secondReady =
    !secondProfile || secondContent?.phase === "cover" || secondContent?.phase === "full";
  const hasPendingDecision = discoveryQueueRuntime.pendingDecision !== null;
  const currentImages = frontProfile?.images ?? [];
  const currentImage =
    currentImages[Math.min(activePhotoIndex, currentImages.length - 1)] ??
    currentImages[0];
  const visibleFrontProfile = frozenFrontPayload?.profile ?? frontProfile;
  const visibleFrontImages = frozenFrontPayload?.images ?? currentImages;
  const visibleFrontActivePhotoIndex =
    frozenFrontPayload?.activePhotoIndex ?? activePhotoIndex;
  const visibleFrontImageUri = frozenFrontPayload?.displayedImageUri ?? currentImage ?? null;
  const visibleFrontInfoVisible = frozenFrontPayload?.isInfoVisible ?? isInfoVisible;
  const pronounLabel = visibleFrontProfile
    ? getPronounLabel(visibleFrontProfile.pronouns, language)
    : "";
  const genderIdentityLabel = visibleFrontProfile
    ? getGenderIdentityLabel(visibleFrontProfile.genderIdentity, t)
    : "";
  const zodiacLabel = getZodiacSignLabel(
    getZodiacSignFromIsoDate(visibleFrontProfile?.dateOfBirth ?? ""),
    t
  );
  const ageWithSign = visibleFrontProfile
    ? zodiacLabel
      ? `${visibleFrontProfile.age} · ${zodiacLabel}`
      : String(visibleFrontProfile.age)
    : "";
  const hasActiveFilters = !filtersEqual(activeFilters, defaultFilters);
  const canApplyFilters = !filtersEqual(draftFilters, activeFilters);
  const hasDeckProfiles = Boolean(frontProfile);
  const showQueueLoading =
    (isQueueLoading || discoveryQueueRuntime.status === "hard_refreshing") && !hasDeckProfiles;
  const canInteract =
    !isOffline &&
    !isQueueLoading &&
    renderState === "idle" &&
    Boolean(frontProfile) &&
    discoveryIdsEqual(logicalActiveProfileId, frontProfile?.id ?? null);
  const apiInFlight = discoveryQueueRuntime.pendingDecision !== null;
  const canSubmitImmediately =
    !isQueueLoading &&
    renderState === "idle" &&
    discoveryQueueRuntime.status !== "hard_refreshing" &&
    !hasPendingDecision;
  const logQueueTrace = useCallback(
    (
      payload: Omit<
        DiscoveryQueueTracePayload,
        | "actorId"
        | "queueVersion"
        | "policyVersion"
        | "visibleQueue"
        | "renderedQueue"
        | "activeProfileId"
        | "canAct"
      >
    ) => {
      recordDiscoveryQueueTrace({
        ...payload,
        queueVersion: discoveryFeed.queueVersion ?? null,
        policyVersion: discoveryFeed.policyVersion ?? null,
        visibleQueue: logicalQueueIds,
        renderedQueue: renderedQueueIds,
        activeProfileId: renderedQueueIds[0] ?? null,
        canAct: canInteract,
      });
    },
    [
      canInteract,
      discoveryFeed.policyVersion,
      discoveryFeed.queueVersion,
      logicalQueueIds,
      recordDiscoveryQueueTrace,
      renderedQueueIds,
    ]
  );
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
    [
      ...sourceEntries.map((entry) => entry.profile),
      ...(lastLikedProfile ? [lastLikedProfile] : []),
    ].forEach((profile) => {
      profile.insightTags.forEach((tag) => {
        map.set(tag.en, tag);
      });
    });
    return map;
  }, [lastLikedProfile, sourceEntries]);
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

  const getTraceSnapshot = useCallback(
    () => ({
      frontId: frontProfile?.id ?? null,
      secondId: secondProfile?.id ?? null,
      thirdId: thirdProfile?.id ?? null,
      frontCardKey: `front:${frontProfile?.id ?? "empty"}`,
      secondCardKey: `second:${secondProfile?.id ?? "empty"}`,
      frontImageKey: `${frontProfile?.id ?? "empty"}:${activePhotoIndex}`,
      secondImageKey: `${secondProfile?.id ?? "empty"}:0`,
      visibleQueueLength: renderedQueueIds.filter((value) => value !== null).length,
      queuedDecisionCount: discoveryQueueRuntime.queuedDecisionCount ?? 0,
      frontReady: frontContent?.phase === "full",
      secondReady,
      frontExtrasReady: frontContent?.phase === "full",
      activePhotoIndex,
      isDeckAnimating,
      isInfoVisible,
      renderState,
      renderLineageToken,
      frozenFrontId: frozenFrontPayload?.profile.id ?? null,
    }),
    [
      activePhotoIndex,
      discoveryQueueRuntime.queuedDecisionCount,
      frontContent?.phase,
      frozenFrontPayload?.profile.id,
      isDeckAnimating,
      isInfoVisible,
      renderLineageToken,
      renderState,
      renderedQueueIds,
      secondReady,
      frontProfile?.id,
      secondProfile?.id,
      thirdProfile?.id,
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
      sourceProfilesLength: sourceEntries.length,
    });
  }, [sourceEntries.length, trace]);

  useEffect(() => {
    trace("filtered_profiles_changed", {
      filteredProfilesLength: filteredEntries.length,
    });
  }, [filteredEntries.length, trace]);

  useEffect(() => {
    trace("network_state_changed", {
      isOffline,
      isConnected: isOnline,
      isInternetReachable: isOnline,
    });
  }, [isOffline, isOnline, trace]);

  useEffect(() => {
    trace("render_identity_changed", {
      frontCardKey: `front:${frontProfile?.id ?? "empty"}`,
      secondCardKey: `second:${secondProfile?.id ?? "empty"}`,
      frontImageKey: `${frontProfile?.id ?? "empty"}:${activePhotoIndex}`,
      secondImageKey: `${secondProfile?.id ?? "empty"}:0`,
    });
  }, [activePhotoIndex, frontProfile?.id, secondProfile?.id, trace]);

  useEffect(() => {
    if (
      isDeckAnimating ||
      isQueueLoading ||
      renderState !== "idle" ||
      frozenFrontPayload !== null
    ) {
      return;
    }

    const logicalHead = logicalQueueIds[0] ?? null;
    const renderedHead = renderedQueueIds[0] ?? null;

    if (logicalHead == null || renderedHead == null) {
      loggedHeadMismatchRef.current = null;
      return;
    }

    if (!discoveryIdsEqual(logicalHead, renderedHead)) {
      const message = `Rendered head mismatch: logical=${logicalHead} rendered=${renderedHead}`;
      const mismatchKey = `${logicalHead}:${renderedHead}`;
      if (loggedHeadMismatchRef.current === mismatchKey) {
        return;
      }
      loggedHeadMismatchRef.current = mismatchKey;
      logQueueTrace({
        event: "queue_invariant_violation",
        requestId: discoveryQueueRuntime.lastRequestId,
        note: message,
        source: "render",
      });
      return;
    }

    loggedHeadMismatchRef.current = null;
  }, [
    frozenFrontPayload,
    isDeckAnimating,
    isQueueLoading,
    logicalQueueIds,
    logQueueTrace,
    renderState,
    renderedQueueIds,
  ]);

  useEffect(() => {
    const expected = expectedRenderQueueRef.current;
    if (!expected || isDeckAnimating || isQueueLoading) {
      return;
    }

    const renderedHead = renderedQueueIds[0] ?? null;
    const expectedHead = expected.resultQueue[0] ?? null;
    const renderCommittedMatches =
      (renderedHead === null && expectedHead === null) ||
      discoveryIdsEqual(renderedHead, expectedHead);
    if (!renderCommittedMatches) {
      const message = `Next committed render mismatch: expected ${expectedHead ?? "none"}, got ${renderedHead ?? "none"}`;
      const mismatchKey = `${expected.requestId ?? "none"}:${expectedHead ?? "none"}:${renderedHead ?? "none"}:mismatch`;
      if (loggedExpectedRenderResultRef.current === mismatchKey) {
        return;
      }
      loggedExpectedRenderResultRef.current = mismatchKey;
      logQueueTrace({
        event: "queue_invariant_violation",
        requestId: expected.requestId,
        resultQueue: expected.resultQueue,
        note: message,
        source: "render",
      });
      expectedRenderQueueRef.current = null;
      return;
    }

    const commitKey = `${expected.requestId ?? "none"}:${expectedHead ?? "none"}:${renderedHead ?? "none"}:commit`;
    if (loggedExpectedRenderResultRef.current === commitKey) {
      expectedRenderQueueRef.current = null;
      return;
    }
    loggedExpectedRenderResultRef.current = commitKey;
    logQueueTrace({
      event: "queue_render_committed",
      requestId: expected.requestId,
      replacementProfileId: discoveryQueueRuntime.lastReplacementProfileId,
      resultQueue: expected.resultQueue,
      source: "render",
    });
    expectedRenderQueueRef.current = null;
  }, [
    discoveryQueueRuntime.lastReplacementProfileId,
    isDeckAnimating,
    isQueueLoading,
    logQueueTrace,
    renderedQueueIds,
  ]);

  useEffect(() => {
    if (!isQueueLoading) {
      return;
    }

    if (discoveryFeed.generatedAt || discoveryFeed.supply?.fetchedAt) {
      setIsQueueLoading(false);
    }
  }, [
    discoveryFeed.generatedAt,
    discoveryFeed.supply?.fetchedAt,
    isQueueLoading,
  ]);

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

  useEffect(() => {
    const nextVisibleWindow = sourceEntries.slice(0, DISCOVERY_QUEUE_CACHE_SIZE);
    const hasBackendInvalidation =
      Boolean((discoveryFeed as { queueInvalidated?: boolean }).queueInvalidated) ||
      Boolean((discoveryFeed as { queueInvalidationReason?: string | null }).queueInvalidationReason);
    const hasPolicyInvalidation =
      renderLineageToken > 0 &&
      lastHydratedPolicyVersionRef.current !== null &&
      discoveryFeed.policyVersion !== null &&
      discoveryFeed.policyVersion !== lastHydratedPolicyVersionRef.current;
    const derivedHardInvalidationReason =
      hardInvalidationReason ??
      (hasBackendInvalidation
        ? "queue_invalidated"
        : hasPolicyInvalidation
          ? "policy_invalidated"
          : renderLineageToken === 0
            ? "init"
            : null);

    if (!nextVisibleWindow.length) {
      if (derivedHardInvalidationReason) {
        setIsQueueLoading(true);
      }
      return;
    }

    if (!derivedHardInvalidationReason) {
      if (renderState === "gesture_active" || renderState === "promotion_committing") {
        debugDiscoveryLog("feed_reconciliation_ignored", {
          reason: "active_decision_flow",
          renderState,
          incomingVisibleQueue: getDiscoveryQueueIds(nextVisibleWindow),
        });
      }
      return;
    }

    if (renderState === "gesture_active" || renderState === "promotion_committing") {
      debugDiscoveryLog("full_rebuild_blocked_during_active_swipe", {
        reason: derivedHardInvalidationReason,
        renderState,
      });
      return;
    }

    const nextDeck = buildStableDeck(nextVisibleWindow);
    stableDeckRef.current = nextDeck;
    setStableDeck(nextDeck);
    setFrozenFrontPayload(null);
    setRenderState("idle");
    setHardInvalidationReason(null);
    setRenderLineageToken((current) => current + 1);
    lastHydratedPolicyVersionRef.current = discoveryFeed.policyVersion ?? null;
    swipingRef.current = false;
    updateSwipeState("idle");
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
    setIsQueueLoading(false);
    expectedRenderQueueRef.current = null;
    debugDiscoveryLog("hard_invalidation_applied", {
      reason: derivedHardInvalidationReason,
      visibleQueue: getDiscoveryQueueIds(nextVisibleWindow),
    });
  }, [
    discoveryFeed,
    deckProgress,
    flipAnim,
    hardInvalidationReason,
    position,
    renderLineageToken,
    renderState,
    sourceEntries,
    swipeFeedbackX,
  ]);

  React.useEffect(() => {
    if (!filteredEntries.length) {
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
    });
  }, [
    filteredEntries,
    frontProfile,
    secondProfile,
    thirdProfile,
    shouldFreezeReadinessWrites,
    trace,
  ]);

  React.useEffect(() => {
    if (!frontProfile || frontProfile.images.length <= 1) {
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
    });

    return () => {
      cancelled = true;
    };
  }, [
    frontProfile,
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

  const clearVisualMotionState = useCallback(
    (options?: { activePhotoIndex?: number; infoVisible?: boolean }) => {
      swipingRef.current = false;
      updateSwipeState("idle");
      setIsDeckAnimating(false);
      position.setValue({ x: 0, y: 0 });
      swipeFeedbackX.setValue(0);
      deckProgress.setValue(0);
      setActivePhotoIndex(options?.activePhotoIndex ?? 0);
      setIsInfoVisible(options?.infoVisible ?? false);
      flipAnim.setValue(options?.infoVisible ? 1 : 0);
      backScrollRef.current?.scrollTo({ y: 0, animated: false });
      swipeSessionIdRef.current = null;
      swipeDirectionRef.current = null;
      thresholdLoggedRef.current = false;
    },
    [deckProgress, flipAnim, position, swipeFeedbackX, updateSwipeState]
  );

  const requestHardInvalidation = useCallback(
    (reason: HardInvalidationReason) => {
      debugDiscoveryLog("hard_invalidation_started", {
        reason,
        renderLineageToken,
      });
      setRenderState("hard_invalidating");
      setHardInvalidationReason(reason);
      setFrozenFrontPayload(null);
      expectedRenderQueueRef.current = null;
      stableDeckRef.current = buildStableDeck([]);
      setStableDeck(stableDeckRef.current);
      clearVisualMotionState();
      setIsQueueLoading(true);
    },
    [clearVisualMotionState, renderLineageToken]
  );

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
    if (renderState !== "idle" || frozenFrontPayload) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setInfoVisible(!isInfoVisible);
  };

  const resetCardState = useCallback(() => {
    trace("reset_card_state", getTraceSnapshot());
    setFrozenFrontPayload(null);
    setRenderState("idle");
    clearVisualMotionState();
  }, [clearVisualMotionState, getTraceSnapshot, trace]);

  const settleCardVisualState = useCallback(() => {
    setFrozenFrontPayload(null);
    setRenderState("idle");
    clearVisualMotionState();
  }, [clearVisualMotionState]);

  const commitSlotPromotion = useCallback(
    (options: {
      requestId: string;
      replacementProfile: DiscoverProfile | null;
      replacementProfileId: number | null;
    }) => {
      setRenderState("promotion_committing");
      let nextVisibleQueue: number[] = [];

      setStableDeck((current) => {
        let next = rotateStableDeck(current, options.replacementProfile);
        next = upgradeSlotToFull(next, next.front);
        next = upgradeSlotToCover(next, next.second);
        stableDeckRef.current = next;
        nextVisibleQueue = getDiscoveryQueueIds(
          [getSlotContent(next, "front"), getSlotContent(next, "second"), getSlotContent(next, "third")]
            .map((content) => ({ id: content?.profileId ?? null }))
            .filter((item): item is { id: number } => item.id !== null)
        );
        return next;
      });

      expectedRenderQueueRef.current = {
        requestId: options.requestId,
        resultQueue: nextVisibleQueue,
      };
      setRenderLineageToken((current) => current + 1);
      setFrozenFrontPayload(null);
      clearVisualMotionState();
      setRenderState("idle");

      if (options.replacementProfile) {
        debugDiscoveryLog("replacement_inserted", {
          requestId: options.requestId,
          replacementProfileId: options.replacementProfileId,
          resultQueue: nextVisibleQueue,
        });
      } else {
        debugDiscoveryLog("replacement_missing_slot_collapsed", {
          requestId: options.requestId,
          resultQueue: nextVisibleQueue,
        });
      }

      logQueueTrace({
        event: "slot_promotion_committed",
        requestId: options.requestId,
        replacementProfileId: options.replacementProfileId,
        resultQueue: nextVisibleQueue,
        source: "render",
      });
    },
    [clearVisualMotionState, logQueueTrace]
  );

  const stepPhoto = useCallback((direction: "prev" | "next") => {
    if (renderState !== "idle" || frozenFrontPayload) {
      return;
    }
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
      return;
    }

    const frontProfileId = frontProfile.id;
    void warmDiscoveryProfileImages(frontProfile, 1, nextIndex).then(() => {
      if (
        getSlotContent(stableDeckRef.current, "front")?.profileId === frontProfileId &&
        isDiscoveryImageWarm(nextUri)
      ) {
        setActivePhotoIndex(nextIndex);
      }
    });
  }, [
    activePhotoIndex,
    currentImages.length,
    frozenFrontPayload,
    frontProfile,
    renderState,
    shouldSuppressVisualChurn,
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
    if (isOffline || renderState !== "idle") {
      return;
    }
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
    if (isOffline) {
      return;
    }
    Keyboard.dismiss();
    requestHardInvalidation("filters");
    void (async () => {
      const ok = await saveDiscoveryFilters({
        ...draftFilters,
        selectedGenders: [...draftFilters.selectedGenders],
      });
      if (!ok) {
        setIsQueueLoading(false);
        setRenderState("idle");
        setHardInvalidationReason(null);
        return;
      }
      setIsFilterVisible(false);
    })();
  };

  const clearFilters = () => {
    if (isOffline) {
      return;
    }
    Keyboard.dismiss();
    setDraftFilters({
      ...defaultFilters,
      selectedGenders: [...defaultFilters.selectedGenders],
    });
    requestHardInvalidation("filters");
    void (async () => {
      const ok = await saveDiscoveryFilters({
        ...defaultFilters,
        selectedGenders: [...defaultFilters.selectedGenders],
      });
      if (!ok) {
        setIsQueueLoading(false);
        setRenderState("idle");
        setHardInvalidationReason(null);
        return;
      }
      setIsFilterVisible(false);
    })();
  };

  const handleRetryDiscovery = useCallback(() => {
    if (isOffline) {
      console.log(`[discover] reload blocked while offline on ${process.env.EXPO_PUBLIC_AUTH_API_URL}`, {
        activeFilters,
      });
      return;
    }

    requestHardInvalidation("explicit_reset");
    void (async () => {
      console.log("[discover] reload pressed", {
        action: "reload_window_with_active_filters",
        activeFilters,
      });
      const ok = await saveDiscoveryFilters({
        ...activeFilters,
        selectedGenders: [...activeFilters.selectedGenders],
      });
      console.log("[discover] reload finished", {
        action: "reload_window_with_active_filters",
        activeFilters,
        ok,
      });
      if (!ok) {
        setIsQueueLoading(false);
        setRenderState("idle");
        setHardInvalidationReason(null);
      }
    })();
  }, [activeFilters, isOffline, requestHardInvalidation, saveDiscoveryFilters]);

  const handleResetSeenProfiles = useCallback(() => {
    requestHardInvalidation("explicit_reset");
    void refreshDiscoveryCandidates().then((ok) => {
      if (!ok) {
        setIsQueueLoading(false);
        setRenderState("idle");
        setHardInvalidationReason(null);
        return;
      }
    });
  }, [refreshDiscoveryCandidates, requestHardInvalidation]);

  const animateButtonSwipeFeedback = useCallback(
    (direction: SwipeDirection) =>
      new Promise<boolean>((resolve) => {
      const feedbackTarget = direction === "right" ? SWIPE_FEEDBACK_DISTANCE : -SWIPE_FEEDBACK_DISTANCE;
      const flyTarget = direction === "right" ? width * 1.5 : -width * 1.5;

      swipeFeedbackX.setValue(0);

      Animated.parallel([
        Animated.timing(swipeFeedbackX, {
          toValue: feedbackTarget,
          duration: SWIPE_FEEDBACK_BUTTON_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(position, {
          toValue: { x: flyTarget, y: 0 },
          duration: SWIPE_FEEDBACK_BUTTON_DURATION,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    }),
    [position, swipeFeedbackX, width],
  );

  const holdGestureSwipeFeedback = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
      const direction = swipeDirectionRef.current;
      const flyTarget = direction === "right" ? width * 1.5 : -width * 1.5;

      Animated.timing(position, {
        toValue: { x: flyTarget, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    }),
    [position, width],
  );

  const restoreFrontAfterFailedDecision = useCallback(
    (requestId: string, reason: string) => {
      const frozen = frozenFrontPayload;
      if (!frozen) {
        resetCardState();
        return;
      }

      debugDiscoveryWarn("front_restore_after_failed_decision", {
        requestId,
        reason,
        targetProfileId: frozen.profile.id,
      });

      position.x.stopAnimation((currentX) => {
        const shouldAnimateBack = Math.abs(currentX) > 16;
        const finalize = () => {
          setFrozenFrontPayload(null);
          setRenderState("idle");
          clearVisualMotionState({
            activePhotoIndex: frozen.activePhotoIndex,
            infoVisible: frozen.isInfoVisible,
          });
        };

        if (!shouldAnimateBack) {
          finalize();
          return;
        }

        Animated.parallel([
          Animated.timing(position, {
            toValue: { x: 0, y: 0 },
            duration: SWIPE_FEEDBACK_RESET_DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(swipeFeedbackX, {
            toValue: 0,
            duration: SWIPE_FEEDBACK_RESET_DURATION,
            useNativeDriver: false,
          }),
        ]).start(() => finalize());
      });
    },
    [clearVisualMotionState, frozenFrontPayload, position, resetCardState, swipeFeedbackX]
  );

  const commitDiscoverySwipe = useCallback(
    (direction: SwipeDirection, origin: SwipeCommitOrigin = "button") => {
      const action: "like" | "pass" = direction === "right" ? "like" : "pass";
      const renderedFrontId = normalizeDiscoveryProfileId(frontProfile?.id ?? null);
      const targetProfileId = logicalActiveProfileId ?? renderedFrontId ?? null;
      logQueueTrace({
        event: "decision_tap",
        requestId: null,
        action,
        targetProfileId,
        logicalHeadId: logicalActiveProfileId,
        renderedFrontId,
        tapSource: origin,
        hasAccessToken,
        authStatus,
        isOffline,
        isDeckAnimating,
        hasPendingDecision,
        source: "render",
      });
      if (!frontProfile) {
        swipingRef.current = false;
        logQueueTrace({
          event: "queue_action_blocked",
          requestId: null,
          action,
          targetProfileId: null,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId: null,
          decisionRejectedReason: "missing_front_profile",
          hasAccessToken,
          authStatus,
          isOffline,
          isDeckAnimating,
          hasPendingDecision,
          note: "Action blocked: no rendered front profile",
          source: "render",
        });
        return false;
      }
      if (isDeckAnimating || renderState !== "idle") {
        swipingRef.current = false;
        logQueueTrace({
          event: "queue_action_blocked",
          requestId: discoveryQueueRuntime.lastRequestId,
          action,
          targetProfileId,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId,
          decisionRejectedReason: "deck_animating",
          hasAccessToken,
          authStatus,
          isOffline,
          isDeckAnimating: true,
          hasPendingDecision,
          note: "Action blocked: active decision flow in progress",
          source: "render",
        });
        return false;
      }
      if (isOffline) {
        swipingRef.current = false;
        logQueueTrace({
          event: "queue_action_blocked",
          requestId: discoveryQueueRuntime.lastRequestId,
          action,
          targetProfileId,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId,
          decisionRejectedReason: "offline",
          hasAccessToken,
          authStatus,
          isOffline: true,
          isDeckAnimating,
          hasPendingDecision,
          note: "Action blocked: device is offline",
          source: "render",
        });
        return false;
      }
      if (!canInteract) {
        swipingRef.current = false;
        const isRenderHeadMismatch = !discoveryIdsEqual(logicalActiveProfileId, frontProfile.id);
        const message = isRenderHeadMismatch
          ? `Action blocked: logical head ${logicalActiveProfileId ?? "none"} does not match rendered front ${renderedFrontId ?? "none"}`
          : "Action blocked: discovery interaction prerequisites are not satisfied";
        logQueueTrace({
          event: "queue_action_blocked",
          requestId: discoveryQueueRuntime.lastRequestId,
          action,
          targetProfileId,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId,
          decisionRejectedReason: isRenderHeadMismatch ? "render_head_mismatch" : "cannot_act",
          hasAccessToken,
          authStatus,
          isOffline,
          isDeckAnimating,
          hasPendingDecision,
          note: message,
          source: "render",
        });
        return false;
      }
      if (logicalActiveProfileId === null || renderedFrontId === null) {
        swipingRef.current = false;
        const message = "Action blocked: tap snapshot is missing a normalized front/head id";
        logQueueTrace({
          event: "queue_action_blocked",
          requestId: discoveryQueueRuntime.lastRequestId,
          action,
          targetProfileId,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId,
          decisionRejectedReason: "malformed_snapshot",
          hasAccessToken,
          authStatus,
          isOffline,
          isDeckAnimating,
          hasPendingDecision,
          note: message,
          source: "render",
        });
        return false;
      }
      if (!secondReady) {
        debugDiscoveryWarn("second_card_not_ready_bypassed", {
          targetProfileId: logicalActiveProfileId,
          logicalHeadId: logicalActiveProfileId,
          renderedFrontId,
        });
      }

      swipeDirectionRef.current = direction;
      swipingRef.current = true;
      setRenderState("gesture_active");
      trace("swipe_start", {
        swipeDirection: direction,
        frontId: frontProfile.id,
        secondId: secondProfile?.id ?? null,
      });
      const profile = frontProfile;
      const requestId = createTraceId(`discovery_${action}_${logicalActiveProfileId}`);
      const requestDecision = direction === "right" ? likeProfile : passProfile;
      const queueVersion =
        Number.isFinite(Number(discoveryFeed.queueVersion)) &&
        Number(discoveryFeed.queueVersion) > 0
          ? Number(discoveryFeed.queueVersion)
          : null;
      const decisionContext = {
        requestId,
        action,
        targetProfileId: logicalActiveProfileId,
        expectedHeadId: logicalActiveProfileId,
        // Only send the *visible* deck to the server (backend schema maxes at 3).
        // We may keep an extra cached tail entry locally for instant promotion.
        visibleProfileIds: logicalQueueIds.slice(0, DISCOVERY_PAGE_SIZE),
        queueVersion,
        policyVersion: discoveryFeed.policyVersion ?? null,
        renderedFrontId,
        tapSource: origin,
      };
      const frozenPayload: FrozenFrontPayload = {
        slotId: stableDeck.front,
        profile,
        displayedImageUri: currentImage ?? null,
        activePhotoIndex,
        isInfoVisible,
        images: [...currentImages],
      };
      setFrozenFrontPayload(frozenPayload);
      setIsDeckAnimating(true);
      Haptics.impactAsync(
        direction === "right"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
      debugDiscoveryLog("decision_request_sent", {
        requestId,
        direction,
        targetProfileId: decisionContext.targetProfileId,
      });

      void (async () => {
        const resultPromise = requestDecision(profile, {
          requestId,
          renderedFrontId,
          tapSource: origin,
          decisionContext,
        });
        const animationFinished =
          origin === "button"
            ? await animateButtonSwipeFeedback(direction)
            : await holdGestureSwipeFeedback();

        if (!animationFinished) {
          restoreFrontAfterFailedDecision(requestId, "animation_interrupted");
          return;
        }

        trace("swipe_animation_end", {
          swipeDirection: direction,
          frontId: profile.id,
        });

        const result = await resultPromise;

        if (!result || !result.decisionApplied) {
          if (result?.decisionRejectedReason === "cursor_stale") {
            requestHardInvalidation("cursor_stale");
          } else {
            restoreFrontAfterFailedDecision(
              requestId,
              result?.decisionRejectedReason ?? "request_failed"
            );
          }
          return;
        }

        debugDiscoveryLog("decision_response_success", {
          requestId,
          direction,
          targetProfileId: decisionContext.targetProfileId,
          replacementProfileId: result.replacementProfile?.id ?? null,
        });

        if (direction === "right") {
          setLastLikedProfile(profile);
        }

        recordDiscoverySwipe(direction, {
          requestId,
          targetProfileId: decisionContext.targetProfileId,
        });

        commitSlotPromotion({
          requestId,
          replacementProfile: result.replacementProfile,
          replacementProfileId: result.replacementProfile?.id ?? null,
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
      })().catch((error: unknown) => {
        debugDiscoveryWarn("decision_response_failed", {
          requestId,
          direction,
          targetProfileId: decisionContext.targetProfileId,
          error: error instanceof Error ? error.message : String(error),
        });
        restoreFrontAfterFailedDecision(requestId, "request_failed");
      });
      return true;
    },
    [
      animateButtonSwipeFeedback,
      buildPopularUpdateMessage,
      canInteract,
      canSubmitImmediately,
      commitSlotPromotion,
      discoveryFeed.policyVersion,
      discoveryFeed.queueVersion,
      discoveryQueueRuntime.lastRequestId,
      frontProfile,
      currentImage,
      currentImages,
      hasAccessToken,
      authStatus,
      hasPendingDecision,
      holdGestureSwipeFeedback,
      isDeckAnimating,
      isOffline,
      isInfoVisible,
      likeProfile,
      logQueueTrace,
      logicalActiveProfileId,
      logicalQueueIds,
      passProfile,
      recordDiscoverySwipe,
      renderState,
      requestHardInvalidation,
      restoreFrontAfterFailedDecision,
      secondReady,
      secondProfile?.id,
      stableDeck.front,
      trace,
      activePhotoIndex,
    ]
  );

  const swipeRight = useCallback(
    (origin: SwipeCommitOrigin = "button") => {
      console.log("[swipe] swipeRight called", { canInteract, canSubmitImmediately, frontProfile: frontProfile?.id, logicalActiveProfileId, isDeckAnimating, hasPendingDecision, isQueueLoading, status: discoveryQueueRuntime.status });
      return commitDiscoverySwipe("right", origin);
    },
    [commitDiscoverySwipe, canInteract, canSubmitImmediately, frontProfile?.id, logicalActiveProfileId, isDeckAnimating, hasPendingDecision, isQueueLoading, discoveryQueueRuntime.status],
  );

  const swipeLeft = useCallback(
    (origin: SwipeCommitOrigin = "button") => {
      console.log("[swipe] swipeLeft called", { canInteract, canSubmitImmediately, frontProfile: frontProfile?.id, logicalActiveProfileId, isDeckAnimating, hasPendingDecision, isQueueLoading, status: discoveryQueueRuntime.status });
      return commitDiscoverySwipe("left", origin);
    },
    [commitDiscoverySwipe, canInteract, canSubmitImmediately, frontProfile?.id, logicalActiveProfileId, isDeckAnimating, hasPendingDecision, isQueueLoading, discoveryQueueRuntime.status],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!canInteract) {
            return false;
          }
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
            if (gesture.dx > 40) updateSwipeState("like");
            else if (gesture.dx < -40) updateSwipeState("dislike");
            else updateSwipeState("idle");
            return;
          }

          if (!isInfoVisible && gesture.dy < 0) {
            swipeFeedbackX.setValue(0);
            position.setValue({ x: 0, y: gesture.dy * 0.4 });
            updateSwipeState("idle");
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
                updateSwipeState("idle");
                swipeSessionIdRef.current = null;
                swipeDirectionRef.current = null;
                thresholdLoggedRef.current = false;
              }
            } else if (gesture.dx < -SWIPE_THRESHOLD) {
              if (!swipeLeft("gesture")) {
                resetPosition();
                updateSwipeState("idle");
                swipeSessionIdRef.current = null;
                swipeDirectionRef.current = null;
                thresholdLoggedRef.current = false;
              }
            } else {
              resetPosition();
              updateSwipeState("idle");
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
          updateSwipeState("idle");
          swipeSessionIdRef.current = null;
          swipeDirectionRef.current = null;
          thresholdLoggedRef.current = false;
        },
        onPanResponderTerminate: () => {
          trace("gesture_terminated", {
            swipeDirection: swipeDirectionRef.current,
          });
          resetPosition();
          updateSwipeState("idle");
          swipeSessionIdRef.current = null;
          swipeDirectionRef.current = null;
          thresholdLoggedRef.current = false;
        },
      }),
    [
      canInteract,
      getTraceSnapshot,
      isInfoVisible,
      resetPosition,
      setInfoVisible,
      swipeFeedbackX,
      swipeLeft,
      swipeRight,
      trace,
      updateSwipeState,
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
            disabled={isOffline}
            style={({ pressed }) => [
              styles.filterBtn,
              hasActiveFilters && styles.filterBtnActive,
              isOffline && styles.emptyCardButtonDisabled,
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

      {hasDeckProfiles && frontProfile ? (
        <>
          <View
            style={styles.cardStack}
            onLayout={(event) => {
              const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
              logLayoutChange("card_stack", { width: nextWidth, height: nextHeight });
            }}
          >
            {(["slotA", "slotB", "slotC"] as SlotId[]).map((slotId) => {
              const content = stableDeck[slotId];
              const isFront = stableDeck.front === slotId;
              const isSecond = stableDeck.second === slotId;
              const isThird = stableDeck.third === slotId;
              const profile = isFront
                ? (frozenFrontPayload?.profile ?? content?.profile ?? null)
                : content?.profile ?? null;
              const slotImageUri = isSecond
                ? (content?.coverImageUri ?? null)
                : isFront
                  ? visibleFrontImageUri
                  : null;

              return (
                <Animated.View
                  key={slotId}
                  {...(isFront ? panResponder.panHandlers : {})}
                  pointerEvents={isFront ? "box-none" : "none"}
                  style={[
                    styles.cardBase,
                    cardFrameStyle,
                    !profile && styles.cardSlotHidden,
                    isFront && [
                      styles.cardInteractive,
                      {
                        zIndex: 3,
                        transform: [
                          { translateX: position.x },
                          { translateY: position.y },
                          { rotate },
                        ],
                      },
                    ],
                    isSecond && [
                      styles.cardSecond,
                      {
                        zIndex: 2,
                        opacity: profile ? 0.85 : 0,
                      },
                    ],
                    isThird && [
                      styles.cardThird,
                      {
                        zIndex: 1,
                      },
                    ],
                  ]}
                >
                  {/* ── THIRD: plain backdrop only ─────────────────────────── */}
                  {isThird && profile ? (
                    <View style={styles.cardThirdBackdrop} />
                  ) : null}

                  {/* ── SECOND: image + metadata overlay ──────────────────── */}
                  {isSecond && profile ? (
                    <>
                      {slotImageUri ? (
                        <ExpoImage
                          source={{ uri: slotImageUri }}
                          recyclingKey={slotId}
                          style={styles.cardImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
                        />
                      ) : null}
                      <LinearGradient
                        colors={["transparent", "rgba(15,26,20,0.98)"]}
                        style={styles.cardGradient}
                        pointerEvents="none"
                      >
                        {profile.pronouns ? (
                          <Text style={styles.cardPronouns}>
                            {getPronounLabel(profile.pronouns, language)}
                          </Text>
                        ) : null}
                        <Text style={styles.cardName}>{profile.name}</Text>
                        {profile.genderIdentity ? (
                          <Text style={styles.cardIdentity}>
                            {getGenderIdentityLabel(profile.genderIdentity, t)}
                          </Text>
                        ) : null}
                        <Text style={styles.cardAgeSign}>
                          {(() => {
                            const z = getZodiacSignLabel(
                              getZodiacSignFromIsoDate(profile.dateOfBirth ?? ""), t
                            );
                            return z ? `${profile.age} · ${z}` : String(profile.age);
                          })()}
                        </Text>
                        <View style={styles.cardRow}>
                          <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                          <Text style={styles.cardLocation}>{profile.location}</Text>
                          <Text style={styles.cardDot}>·</Text>
                          <Text style={styles.cardOccupation}>
                            {t(profile.occupation.es, profile.occupation.en)}
                          </Text>
                        </View>
                        <View style={styles.interestsRow}>
                          {profile.attributes.interests.slice(0, 3).map((interest) => (
                            <View key={`${slotId}-${profile.id}-${interest}`} style={styles.interestChip}>
                              <Text style={styles.interestChipText}>{interest}</Text>
                            </View>
                          ))}
                        </View>
                      </LinearGradient>
                    </>
                  ) : null}

                  {/* ── FRONT: flip card with front face + back face ───────── */}
                  {isFront && profile ? (
                    <>
                      {/* stamp overlays sit behind the faces */}
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.likeOverlay, { opacity: likeOpacity }]}
                      >
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
                        pointerEvents="none"
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

                      {/* FRONT FACE — image lives here */}
                      <Animated.View
                        pointerEvents={visibleFrontInfoVisible ? "none" : "auto"}
                        style={[
                          styles.cardFace,
                          styles.cardFaceFront,
                          IS_WEB
                            ? { opacity: frontOpacity, zIndex: visibleFrontInfoVisible ? 1 : 3 }
                            : { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
                        ]}
                      >
                        {/* image — recyclingKey is stable per slot so ExpoImage never remounts */}
                        {slotImageUri ? (
                          <ExpoImage
                            source={{ uri: slotImageUri }}
                            recyclingKey={slotId}
                            style={styles.cardImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                          />
                        ) : null}

                        <View style={styles.photoTapLayer} pointerEvents="box-none">
                          <Pressable onPress={() => stepPhoto("prev")} style={styles.photoTapZone} />
                          <Pressable onPress={() => stepPhoto("next")} style={styles.photoTapZone} />
                        </View>

                        <LinearGradient
                          colors={["transparent", "rgba(15,26,20,0.98)"]}
                          style={styles.cardGradient}
                        >
                          {pronounLabel ? (
                            <Text style={styles.cardPronouns}>{pronounLabel}</Text>
                          ) : null}
                          <Text style={styles.cardName}>{profile.name}</Text>
                          {genderIdentityLabel ? (
                            <Text style={styles.cardIdentity}>{genderIdentityLabel}</Text>
                          ) : null}
                          <Text style={styles.cardAgeSign}>{ageWithSign}</Text>
                          <View style={styles.cardRow}>
                            <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                            <Text style={styles.cardLocation}>{profile.location}</Text>
                            <Text style={styles.cardDot}>·</Text>
                            <Text style={styles.cardOccupation}>
                              {t(profile.occupation.es, profile.occupation.en)}
                            </Text>
                          </View>
                          <View style={styles.interestsRow}>
                            {profile.attributes.interests.slice(0, 3).map((interest) => (
                              <View key={`${profile.id}-${interest}`} style={styles.interestChip}>
                                <Text style={styles.interestChipText}>{interest}</Text>
                              </View>
                            ))}
                          </View>
                          {visibleFrontImages.length > 1 ? (
                            <View style={styles.photoDotsRow}>
                              {visibleFrontImages.map((_, index) => (
                                <View
                                  key={`${profile.id}-dot-${index}`}
                                  style={[
                                    styles.photoDot,
                                    index === visibleFrontActivePhotoIndex &&
                                      styles.photoDotActive,
                                  ]}
                                />
                              ))}
                            </View>
                          ) : null}
                        </LinearGradient>
                      </Animated.View>

                      {/* BACK FACE — info panel */}
                      <Animated.View
                        pointerEvents={visibleFrontInfoVisible ? "auto" : "none"}
                        style={[
                          styles.cardFace,
                          styles.cardFaceBack,
                          IS_WEB
                            ? { opacity: backOpacity, zIndex: visibleFrontInfoVisible ? 3 : 1 }
                            : { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
                        ]}
                      >
                        <View style={styles.backHeader}>
                          <View style={styles.backInfoBadge}>
                            <Feather name="info" size={14} color={Colors.info} />
                          </View>
                          <Text style={styles.backName}>
                            {profile.name}, {profile.age}
                          </Text>
                          <Text style={styles.backMeta}>
                            {profile.location} · {t(profile.occupation.es, profile.occupation.en)}
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
                              value={t(profile.about.bio.es, profile.about.bio.en)}
                            />
                            <AboutRow
                              icon="heart"
                              label={t("Metas de tu relación", "Relationship goals")}
                              value={getRelationshipGoalLabel(profile.about.relationshipGoals, t)}
                            />
                            <AboutRow
                              icon="book-open"
                              label={t("Educación", "Education")}
                              value={getEducationLabel(profile.about.education, t)}
                            />
                            <AboutRow
                              icon="users"
                              label={t("Hijxs", "Children")}
                              value={getChildrenPreferenceLabel(profile.about.childrenPreference, t)}
                            />
                            <AboutRow
                              icon="globe"
                              label={t("Idiomas", "Languages")}
                              value={
                                <View style={styles.flagImageRow}>
                                  {profile.about.languagesSpoken.map((value) => {
                                    const uri = getLanguageFlagUri(value);
                                    return uri ? (
                                      <ExpoImage
                                        key={`${profile.id}-${value}`}
                                        source={{ uri }}
                                        style={styles.flagImage}
                                        contentFit="cover"
                                        cachePolicy="memory-disk"
                                      />
                                    ) : (
                                      <View key={`${profile.id}-${value}`} style={styles.flagFallback}>
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
                              <LifestyleTile icon="activity" label={t("Actividad física", "Activity")} value={getPhysicalActivityLabel(profile.lifestyle.physicalActivity, t)} />
                              <LifestyleTile icon="coffee" label={t("Bebida", "Drink")} value={getAlcoholUseLabel(profile.lifestyle.alcoholUse, t)} />
                              <LifestyleTile icon="wind" label={t("Tabaco", "Smoke")} value={getTobaccoUseLabel(profile.lifestyle.tobaccoUse, t)} />
                              <LifestyleTile icon="flag" label={t("Política", "Politics")} value={getPoliticalInterestLabel(profile.lifestyle.politicalInterest, t)} />
                              <LifestyleTile icon="star" label={t("Religión", "Religion")} value={getReligionImportanceLabel(profile.lifestyle.religionImportance, t)} />
                              <LifestyleTile icon="moon" label={t("Creencia", "Belief")} value={getReligionLabel(profile.lifestyle.religion, t)} />
                            </View>
                          </View>

                          <View style={styles.backSection}>
                            <Text style={styles.backSectionTitle}>
                              {t("Atributos físicos", "Physical attributes")}
                            </Text>
                            <PhysicalRow icon="user" label={t("Tipo de cuerpo", "Body type")} value={getBodyTypeLabel(profile.physical.bodyType, t)} />
                            <PhysicalRow icon="maximize-2" label={t("Altura", "Height")} value={profile.physical.height} />
                            <PhysicalRow icon="feather" label={t("Color de cabello", "Hair color")} value={getHairColorLabel(profile.physical.hairColor, t)} />
                            <PhysicalRow icon="map" label={t("Etnia", "Ethnicity")} value={getEthnicityLabel(profile.physical.ethnicity, t)} />
                          </View>
                        </ScrollView>
                      </Animated.View>
                    </>
                  ) : null}
                </Animated.View>
              );
            })}
          </View>
          <View style={[styles.actions, { paddingBottom: bottomPad + 80 }]}>
            <Pressable
              onPress={() => {
                if (!canInteract || swipingRef.current) return; // silent guard
                swipeLeft("button");
              }}
              disabled={!canInteract}
              testID="discover-pass-button"
              style={({ pressed }) => [
                styles.actionBtn,
                styles.dislikeBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
              ]}
            >
              <Feather
                name="x"
                size={26}
                color={canInteract ? Colors.dislike : Colors.textMuted}
              />
            </Pressable>

            <Pressable
              onPress={toggleInfo}
              testID="discover-info-button"
              disabled={renderState !== "idle" || !frontProfile}
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
              onPress={() => {
                if (!canInteract || swipingRef.current) return; // silent guard
                swipeRight("button");
              }}
              disabled={!canInteract}
              testID="discover-like-button"
              style={({ pressed }) => [
                styles.actionBtn,
                styles.likeBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
              ]}
            >
              <Feather
                name="heart"
                size={26}
                color={canInteract ? Colors.like : Colors.textMuted}
              />
            </Pressable>
          </View>

        </>
      ) : showQueueLoading ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <ActivityIndicator color={Colors.primaryLight} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t("Cargando discovery", "Loading discovery")}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {t(
                "Estamos preparando una nueva cola con tus filtros actuales.",
                "We are preparing a new queue with your current filters."
              )}
            </Text>
          </View>
        </View>
      ) : isOfflineDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Feather name="wifi-off" size={24} color={Colors.info} />
            </View>
            <Text style={styles.emptyCardTitle}>
              {t(
                "No podemos cargar más perfiles ahora",
                "We cannot load more profiles right now"
              )}
            </Text>
            <Text style={styles.emptyCardCopy}>
              {lastSyncLabel
                ? t(
                    `Vuelve a conectarte o reintenta cuando el servidor responda. Última sincronización: ${lastSyncLabel}.`,
                    `Reconnect or retry when the server responds again. Last sync: ${lastSyncLabel}.`
                  )
                : t(
                    "Vuelve a conectarte o reintenta cuando MatchA vuelva a estar disponible.",
                    "Reconnect or retry when MatchA is reachable again."
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
        animationType="none"
        onRequestClose={dismissLocationPrompt}
      >
        <View style={styles.locationPromptOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismissLocationPrompt} />
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
                : locationPromptReason === "sync_failed"
                  ? t(
                      "La ubicación ya parece activa, pero no pudimos actualizar tu ciudad todavía. Inténtalo de nuevo para sincronizarla y recargar discovery.",
                      "Location now seems enabled, but we still could not update your city. Try again to sync it and reload discovery."
                    )
                  : t(
                      "MatchA funciona mejor con la ubicación activada. Permítela para actualizar tu ciudad y mejorar discovery.",
                      "MatchA works better with location enabled. Allow it to update your city and improve discovery."
                    )}
            </Text>
            <View style={styles.locationPromptActions}>
              <Pressable
                onPress={dismissLocationPrompt}
                style={({ pressed }) => [
                  styles.locationPromptButton,
                  styles.locationPromptButtonSecondary,
                  isLocationPromptBusy && styles.emptyCardButtonDisabled,
                  pressed && { opacity: 0.82 },
                ]}
                disabled={isLocationPromptBusy}
              >
                <Text style={styles.locationPromptButtonSecondaryText}>
                  {t("Cerrar", "Close")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void (async () => {
                    const outcome = await retryLocationPromptFlow("prompt_button");
                    if (!outcome.recovered && outcome.shouldOpenSettings) {
                      pendingLocationSettingsReturnRef.current = true;
                      await Linking.openSettings().catch(() => {});
                    } else {
                      pendingLocationSettingsReturnRef.current = false;
                    }
                  })();
                }}
                style={({ pressed }) => [
                  styles.locationPromptButton,
                  styles.locationPromptButtonPrimary,
                  isLocationPromptBusy && styles.emptyCardButtonDisabled,
                  pressed && { opacity: 0.82 },
                ]}
                disabled={isLocationPromptBusy}
              >
                {isLocationPromptBusy ? (
                  <ActivityIndicator size="small" color={Colors.ivory} />
                ) : (
                  <Text style={styles.locationPromptButtonPrimaryText}>
                    {t("Activar", "Enable")}
                  </Text>
                )}
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
                  disabled={isOffline}
                  style={({ pressed }) => [
                    styles.filterFooterBtn,
                    styles.filterFooterBtnSecondary,
                    isOffline && styles.emptyCardButtonDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.filterFooterBtnSecondaryText}>
                    {t("Limpiar", "Clear")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={applyFilters}
                  disabled={!canApplyFilters || isOffline}
                  style={({ pressed }) => [
                    styles.filterFooterBtn,
                    canApplyFilters && !isOffline
                      ? styles.filterFooterBtnPrimary
                      : styles.filterFooterBtnPrimaryDisabled,
                    pressed && canApplyFilters && !isOffline && { opacity: 0.84 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterFooterBtnPrimaryText,
                      (!canApplyFilters || isOffline) &&
                        styles.filterFooterBtnPrimaryTextDisabled,
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
        animationType="fade"
        onRequestClose={() => dismissInsightSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => dismissInsightSheet()}
          />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                paddingBottom: Math.max(insets.bottom + 18, 36),
                transform: [{ translateY: insightSheetTranslateY }],
              },
            ]}
          >
            <View
              style={styles.modalDragHeader}
              {...insightSheetPanResponder.panHandlers}
            >
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
            </View>

            <ScrollView
              style={styles.insightScroll}
              contentContainerStyle={styles.insightScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {relatedGoals.map((item: any, index: number) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightItemLeft}>
                    <Feather name="target" size={16} color={Colors.primaryLight} />
                    <View style={styles.insightItemContent}>
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
              onPress={() => dismissInsightSheet()}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>
                {t("Continuar explorando", "Keep exploring")}
              </Text>
            </Pressable>
          </Animated.View>
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
    alignItems: "center",
    gap: 8,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,26,20,0.72)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.2)",
  },
  headerIcon: {
    width: 22,
    height: 22,
  },
  popularUpdateWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
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
  debugPanel: {
    marginTop: 18,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(111,168,255,0.22)",
    backgroundColor: "rgba(111,168,255,0.08)",
    gap: 6,
  },
  debugPanelTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.info,
  },
  debugPanelLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  debugPanelWarning: {
    color: Colors.dislike,
  },
  debugActionButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.34)",
  },
  debugActionButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.info,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  actionBtnDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  actionBtnOffline: {
    opacity: 0.55,
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
    width: "100%",
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: "stretch",
  },
  modalDragHeader: {
    alignItems: "center",
    width: "100%",
    paddingTop: 2,
    paddingBottom: 6,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
    width: "100%",
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
    textAlign: "center",
  },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 300,
  },
  insightScroll: {
    maxHeight: 280,
  },
  insightScrollContent: {
    paddingBottom: 6,
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
  insightItemContent: {
    flex: 1,
    alignSelf: "stretch",
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
