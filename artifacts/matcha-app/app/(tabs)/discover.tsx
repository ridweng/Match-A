import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
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
  warmDiscoveryDeck,
  warmDiscoveryFrontExtras,
  warmDiscoveryProfileImages,
} from "@/utils/discoveryPreload";
import {
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

// ─── Animation timing constants ───────────────────────────────────────────────
// Button swipe: quick stamp reveal then smooth fly-off
const BUTTON_STAMP_DURATION = 60;   // ms — stamp appears instantly
const BUTTON_FLY_DURATION    = 220; // ms — card exits
// Gesture swipe: card continues momentum from finger release
const GESTURE_FLY_DURATION   = 240; // ms
// Gesture reset when below threshold
const SWIPE_FEEDBACK_RESET_DURATION = 180;
// How far the card travels horizontally to count as a committed swipe
const SWIPE_THRESHOLD         = 80;
// Max travel of the LIKE/PASS stamp overlay (drives opacity)
const SWIPE_FEEDBACK_DISTANCE = 150;
// Minimum gesture distance before we accept horizontal pan
const GESTURE_MIN_DX          = 12;
// Minimum drag before info-panel opens
const INFO_SWIPE_THRESHOLD    = 82;
// Insight sheet dismiss thresholds
const INSIGHT_SHEET_DISMISS_THRESHOLD = 96;
const INSIGHT_SHEET_DISMISS_VELOCITY  = 1.05;
const INSIGHT_SHEET_RESET_DURATION    = 180;

const IS_WEB = Platform.OS === "web";

const DISCOVERY_PAGE_SIZE        = 3;
const DISCOVERY_QUEUE_CACHE_SIZE = 3;
const DISCOVERY_TRACE_PREFIX     = "[discover]";
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

// ─── Types ────────────────────────────────────────────────────────────────────
type SlotId    = "slotA" | "slotB" | "slotC";
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
type SwipeState       = "idle" | "like" | "dislike";
type FeatherName      = React.ComponentProps<typeof Feather>["name"];
type AgeBounds        = { min: number; max: number };
type PopularUpdateBanner = { id: number; title: string; body: string };
type DiscoverEntry    = DiscoveryQueueSlot;
type SwipeDirection   = "left" | "right";
type SwipeCommitOrigin = "gesture" | "button";
type TraceLayout      = { width: number; height: number };
type DiscoverProfile  = DiscoveryFeedProfileResponse;
type DiscoveryQueueTracePayload = Parameters<
  ReturnType<typeof useApp>["recordDiscoveryQueueTrace"]
>[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createTraceId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ─── Slot helpers ─────────────────────────────────────────────────────────────
function makeSlotContent(profile: DiscoverProfile, phase: SlotPhase): SlotContent {
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
    front:  "slotA",
    second: "slotB",
    third:  "slotC",
    slotA: entries[0] ? makeSlotContent(entries[0].profile, "full")     : null,
    slotB: entries[1] ? makeSlotContent(entries[1].profile, "cover")    : null,
    slotC: entries[2] ? makeSlotContent(entries[2].profile, "metadata") : null,
  };
}

function rotateStableDeck(
  current: StableDeck,
  replacementProfile: DiscoverProfile | null,
): StableDeck {
  const recycled = current.front;
  return {
    front:  current.second,
    second: current.third,
    third:  recycled,
    slotA: current.slotA,
    slotB: current.slotB,
    slotC: current.slotC,
    [recycled]: replacementProfile
      ? makeSlotContent(replacementProfile, "metadata")
      : null,
  };
}

function getSlotContent(
  deck: StableDeck,
  role: "front" | "second" | "third",
): SlotContent | null {
  return deck[deck[role]];
}

function upgradeSlotToFull(deck: StableDeck, slotId: SlotId): StableDeck {
  const current = deck[slotId];
  if (!current || current.phase === "full") return deck;
  return { ...deck, [slotId]: makeSlotContent(current.profile, "full") };
}

function upgradeSlotToCover(deck: StableDeck, slotId: SlotId): StableDeck {
  const current = deck[slotId];
  if (!current || current.phase !== "metadata") return deck;
  return { ...deck, [slotId]: makeSlotContent(current.profile, "cover") };
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
const BASE_GENDERS: BaseGender[] = ["male", "female", "non_binary", "fluid"];

function normalizeSelectedGenders(values: BaseGender[]) {
  return BASE_GENDERS.filter((v) => values.includes(v));
}

function filtersEqual(a: DiscoveryFilters, b: DiscoveryFilters) {
  return (
    a.therianMode === b.therianMode &&
    a.selectedGenders.length === b.selectedGenders.length &&
    a.selectedGenders.every((v, i) => v === b.selectedGenders[i]) &&
    a.ageMin === b.ageMin &&
    a.ageMax === b.ageMax
  );
}

// ─── Language flags ───────────────────────────────────────────────────────────
const LANGUAGE_FLAG_CODES: Record<string, string> = {
  spanish: "es", english: "gb", portuguese: "pt", french: "fr",
  italian: "it", german: "de", dutch: "nl", catalan: "ad",
  galician: "es", basque: "es",
};
function getLanguageFlagUri(value: string) {
  const code = LANGUAGE_FLAG_CODES[value];
  return code ? `https://flagcdn.com/w40/${code}.png` : null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AboutRow({ icon, label, value }: { icon: FeatherName; label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIconWrap}>
        <Feather name={icon} size={16} color={Colors.info} />
      </View>
      <View style={styles.infoRowBody}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        {typeof value === "string" ? <Text style={styles.infoRowValue}>{value}</Text> : value}
      </View>
    </View>
  );
}

function PhysicalRow({ icon, label, value }: { icon: FeatherName; label: string; value: string }) {
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

function LifestyleTile({ icon, label, value }: { icon: FeatherName; label: string; value: string }) {
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

function FilterCheckboxRow({
  label, selected, onPress, compact = false,
}: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
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
      <View style={[styles.filterCheckboxBox, compact && styles.filterCheckboxBoxCompact, selected && styles.filterCheckboxBoxSelected]}>
        {selected ? <Feather name="check" size={13} color={Colors.ivory} /> : null}
      </View>
      <Text style={[styles.filterCheckboxLabel, compact && styles.filterCheckboxLabelCompact, selected && styles.filterCheckboxLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AgeRangeFields({
  bounds, valueMin, valueMax, onChange, t,
}: { bounds: AgeBounds; valueMin: number; valueMax: number; onChange: (min: number, max: number) => void; t: (es: string, en: string) => string }) {
  const [minText, setMinText] = useState(String(valueMin));
  const [maxText, setMaxText] = useState(String(valueMax));

  React.useEffect(() => { setMinText(String(valueMin)); }, [valueMin]);
  React.useEffect(() => { setMaxText(String(valueMax)); }, [valueMax]);

  const commitMin = React.useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setMinText(String(valueMin)); return; }
    const next = clampNumber(Number(digits), bounds.min, valueMax);
    setMinText(String(next));
    onChange(next, valueMax);
  }, [bounds.min, onChange, valueMax, valueMin]);

  const commitMax = React.useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setMaxText(String(valueMax)); return; }
    const next = clampNumber(Number(digits), valueMin, bounds.max);
    setMaxText(String(next));
    onChange(valueMin, next);
  }, [bounds.max, onChange, valueMax, valueMin]);

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{t("Rango de edad", "Age range")}</Text>
      <View style={styles.ageNumberRow}>
        <View style={styles.ageNumberField}>
          <Text style={styles.ageNumberLabel}>{t("Mínima", "Minimum")}</Text>
          <TextInput
            value={minText}
            onChangeText={(v) => { const d = v.replace(/\D/g,""); setMinText(d); if (d) { const n = Number(d); if (n >= bounds.min && n <= valueMax) onChange(n, valueMax); } }}
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
            onChangeText={(v) => { const d = v.replace(/\D/g,""); setMaxText(d); if (d) { const n = Number(d); if (n >= valueMin && n <= bounds.max) onChange(valueMin, n); } }}
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
      <Text style={styles.ageRangeHint}>{t("Solo números entre 18 y 100", "Numbers only between 18 and 100")}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const CARD_WIDTH  = width - 32;
  const CARD_HEIGHT = height * 0.62;
  const cardFrameStyle = useMemo(() => ({ width: CARD_WIDTH, height: CARD_HEIGHT }), [CARD_HEIGHT, CARD_WIDTH]);

  const {
    t, authStatus, hasAccessToken, user, isOnline,
    likeProfile, passProfile, goals, language,
    discoveryFeed, discoveryQueueRuntime, discoveryFilters,
    lastServerSyncAt, recordDiscoverySwipe, recordDiscoveryQueueTrace,
    refreshProfileLocation, refreshDiscoveryCandidates, resolvedAccessGate, saveDiscoveryFilters,
  } = useApp();

  const ageBounds = useMemo<AgeBounds>(() => ({ min: 18, max: 100 }), []);
  const defaultFilters = useMemo<DiscoveryFilters>(
    () => ({ selectedGenders: [], therianMode: "exclude", ageMin: 18, ageMax: 40 }),
    [],
  );
  const activeFilters = discoveryFilters ?? defaultFilters;

  // ─── UI state ───────────────────────────────────────────────────────────────
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [swipeState, setSwipeState]             = useState<SwipeState>("idle");
  const [showInsight, setShowInsight]           = useState(false);
  const [lastLikedProfile, setLastLikedProfile] = useState<DiscoverProfile | null>(null);
  const [popularUpdateBanner, setPopularUpdateBanner] = useState<PopularUpdateBanner | null>(null);
  const [isInfoVisible, setIsInfoVisible]       = useState(false);
  const [isFilterVisible, setIsFilterVisible]   = useState(false);
  const [draftFilters, setDraftFilters]         = useState<DiscoveryFilters>(activeFilters);
  const [isDeckAnimating, setIsDeckAnimating]   = useState(false);
  const [stableDeck, setStableDeck]             = useState<StableDeck>(() => buildStableDeck([]));
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [locationPromptReason, setLocationPromptReason]   = useState<"permission_denied" | "services_disabled" | "sync_failed" | null>(null);
  const [isLocationPromptBusy, setIsLocationPromptBusy]   = useState(false);
  const [isQueueLoading, setIsQueueLoading]     = useState(false);
  const [queueInvariantViolation, setQueueInvariantViolation] = useState<string | null>(null);

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const stableDeckRef                 = useRef<StableDeck>(stableDeck);
  const swipingRef                    = useRef(false);
  const optimisticFrontIdRef          = useRef<number | null>(null);
  // KEY: set to true when we've rotated the deck and need to reset anim values
  // useLayoutEffect watches stableDeck and resets position AFTER the new slot
  // roles have been committed to layout — eliminating the snap-back flicker.
  const settleAfterRotationRef        = useRef(false);
  const pendingLocationSettingsReturnRef = useRef(false);
  const screenSessionIdRef            = useRef(createTraceId("discover"));
  const swipeSessionIdRef             = useRef<string | null>(null);
  const swipeDirectionRef             = useRef<SwipeDirection | null>(null);
  const thresholdLoggedRef            = useRef(false);
  const previousLayoutRef             = useRef<Record<string, TraceLayout>>({});
  const previousTraceSnapshotRef      = useRef<Record<string, unknown> | null>(null);
  const expectedRenderQueueRef        = useRef<{ requestId: string | null; resultQueue: Array<string | number> } | null>(null);
  const backScrollRef                 = useRef<ScrollView | null>(null);
  const traceFocused = discoveryVerboseDebugEnabled && pathname.endsWith("/discover");

  useEffect(() => {
    if (!pathname.endsWith("/discover")) {
      return;
    }
    if (authStatus !== "authenticated") {
      router.replace("/login");
      return;
    }
    if (!resolvedAccessGate.canEnterDiscover) {
      debugDiscoveryWarn("[auth-gate] discover_entry_denied", {
        route: resolvedAccessGate.route,
        onboardingState: resolvedAccessGate.onboardingState,
        reason: resolvedAccessGate.reason,
        source: resolvedAccessGate.source,
      });
      router.replace(resolvedAccessGate.route);
    }
  }, [
    authStatus,
    pathname,
    resolvedAccessGate.canEnterDiscover,
    resolvedAccessGate.onboardingState,
    resolvedAccessGate.reason,
    resolvedAccessGate.route,
    resolvedAccessGate.source,
  ]);

  // ─── Animated values ─────────────────────────────────────────────────────────
  // position:       gesture tracking + button-swipe fly-out (JS thread, needed for PanResponder)
  // swipeFeedbackX: drives LIKE/PASS stamp opacity during gesture
  // deckProgress:   0 → 1 as front card leaves — drives second card "rising" animation
  // flipAnim:       info-panel flip (0=front face, 1=back face)
  // insightSheetTranslateY: drag-to-dismiss on insight modal
  const position              = useRef(new Animated.ValueXY()).current;
  const swipeFeedbackX        = useRef(new Animated.Value(0)).current;
  const deckProgress          = useRef(new Animated.Value(0)).current;
  const flipAnim              = useRef(new Animated.Value(0)).current;
  const insightSheetTranslateY = useRef(new Animated.Value(0)).current;
  const insightSheetClosingRef = useRef(false);

  const lastQueueViolationRef = useRef<string | null>(null);

  // ─── Derived animated interpolations ─────────────────────────────────────────
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-14deg", "0deg", "14deg"],
    extrapolate: "clamp",
  });

  // LIKE/PASS stamps
  const likeOpacity = swipeFeedbackX.interpolate({
    inputRange: [0, SWIPE_FEEDBACK_DISTANCE], outputRange: [0, 1], extrapolate: "clamp",
  });
  const dislikeOpacity = swipeFeedbackX.interpolate({
    inputRange: [-SWIPE_FEEDBACK_DISTANCE, 0], outputRange: [1, 0], extrapolate: "clamp",
  });
  const likeStampScale = likeOpacity.interpolate({
    inputRange: [0, 1], outputRange: [0.85, 1.05], extrapolate: "clamp",
  });
  const dislikeStampScale = dislikeOpacity.interpolate({
    inputRange: [0, 1], outputRange: [0.85, 1.05], extrapolate: "clamp",
  });
  const likeStampTranslateY = likeOpacity.interpolate({
    inputRange: [0, 1], outputRange: [12, 0], extrapolate: "clamp",
  });
  const dislikeStampTranslateY = dislikeOpacity.interpolate({
    inputRange: [0, 1], outputRange: [12, 0], extrapolate: "clamp",
  });

  // Info flip
  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.48, 0.52, 1], outputRange: [1, 1, 0, 0], extrapolate: "clamp" });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.48, 0.52, 1], outputRange: [0, 0, 1, 1], extrapolate: "clamp" });

  // Second card rises as front card leaves
  // At deckProgress=0: sitting behind front (scale 0.95, pushed down 16pt, slightly dim)
  // At deckProgress=1: fully promoted (scale 1.0, centered, full opacity)
  const secondCardScale = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [0.95, 1.0], extrapolate: "clamp",
  });
  const secondCardTranslateY = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [16, 0], extrapolate: "clamp",
  });
  const secondCardOpacity = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [0.82, 1.0], extrapolate: "clamp",
  });

  // Third card follows second card upward slightly
  const thirdCardScale = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [0.90, 0.95], extrapolate: "clamp",
  });
  const thirdCardTranslateY = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [32, 16], extrapolate: "clamp",
  });
  const thirdCardOpacity = deckProgress.interpolate({
    inputRange: [0, 1], outputRange: [0.55, 0.82], extrapolate: "clamp",
  });

  // ─── Derived state ───────────────────────────────────────────────────────────
  const isOffline         = !isOnline;
  const queueItems        = discoveryQueueRuntime.queue.items ?? [];
  const sourceEntries     = useMemo(() => queueItems, [queueItems]);
  const filteredEntries   = useMemo(() => sourceEntries, [sourceEntries]);
  const supply            = discoveryFeed.supply;
  const eligibleCount     = Number(supply?.eligibleCount) || 0;
  const unseenCount       = Number(supply?.unseenCount) || 0;
  const hasMoreServerProfiles = Boolean(discoveryFeed.hasMore);
  const hasCatalogMatches = eligibleCount > 0;

  const frontContent  = getSlotContent(stableDeck, "front");
  const secondContent = getSlotContent(stableDeck, "second");
  const thirdContent  = getSlotContent(stableDeck, "third");
  const frontProfile  = frontContent?.profile ?? null;
  const secondProfile = secondContent?.profile ?? null;
  const thirdProfile  = thirdContent?.profile ?? null;

  const logicalQueueIds = useMemo(
    () => getDiscoveryQueueIds(queueItems.slice(0, DISCOVERY_QUEUE_CACHE_SIZE)),
    [queueItems],
  );
  const renderedQueueIds = useMemo(
    () => [
      normalizeDiscoveryProfileId(frontProfile?.id ?? null),
      normalizeDiscoveryProfileId(secondProfile?.id ?? null),
      normalizeDiscoveryProfileId(thirdProfile?.id ?? null),
    ],
    [frontProfile?.id, secondProfile?.id, thirdProfile?.id],
  );

  const logicalActiveProfileId = logicalQueueIds[0] ?? null;
  const secondReady = !secondProfile || secondContent?.phase === "cover" || secondContent?.phase === "full";
  const hasPendingDecision = discoveryQueueRuntime.pendingDecision !== null;
  const runtimeInvariantViolation = discoveryQueueRuntime.invariantViolation;
  const effectiveQueueInvariantViolation = queueInvariantViolation ?? runtimeInvariantViolation ?? null;

  const currentImages = frontProfile?.images ?? [];
  const pronounLabel       = frontProfile ? getPronounLabel(frontProfile.pronouns, language) : "";
  const genderIdentityLabel = frontProfile ? getGenderIdentityLabel(frontProfile.genderIdentity, t) : "";
  const zodiacLabel = getZodiacSignLabel(getZodiacSignFromIsoDate(frontProfile?.dateOfBirth ?? ""), t);
  const ageWithSign = frontProfile
    ? zodiacLabel ? `${frontProfile.age} · ${zodiacLabel}` : String(frontProfile.age)
    : "";

  const hasActiveFilters  = !filtersEqual(activeFilters, defaultFilters);
  const canApplyFilters   = !filtersEqual(draftFilters, activeFilters);
  const hasDeckProfiles   = Boolean(frontProfile);
  const showQueueLoading  = (isQueueLoading || discoveryQueueRuntime.status === "hard_refreshing") && !hasDeckProfiles;
  const canInteract =
    !isOffline &&
    !isQueueLoading &&
    Boolean(frontProfile) &&
    discoveryIdsEqual(logicalActiveProfileId, frontProfile?.id ?? null);
  const canSubmitImmediately =
    !isQueueLoading &&
    discoveryQueueRuntime.status !== "hard_refreshing" &&
    !hasPendingDecision;

  const isOfflineDeckExhausted = !hasDeckProfiles && hasMoreServerProfiles && isOffline;
  const isOnlineDeckExhausted  = !hasDeckProfiles && unseenCount === 0 && hasCatalogMatches;
  const isSeenDeckExhausted    = false;

  const shouldFreezeReadinessWrites  = traceFocused && DISCOVERY_ISOLATION_MODE === "A" && isDeckAnimating;
  const shouldSuppressVisualChurn    = traceFocused && DISCOVERY_ISOLATION_MODE === "C" && isDeckAnimating;

  // ─── Trace helpers ───────────────────────────────────────────────────────────
  const trace = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      if (!traceFocused || !DISCOVERY_TRACE_EVENTS.has(event)) return;
      debugDiscoveryVerboseLog(`${DISCOVERY_TRACE_PREFIX} ${event}`, {
        screenSessionId: screenSessionIdRef.current,
        swipeSessionId: swipeSessionIdRef.current,
        ...payload,
      });
    },
    [traceFocused],
  );

  const logQueueTrace = useCallback(
    (payload: Omit<DiscoveryQueueTracePayload, "actorId" | "queueVersion" | "policyVersion" | "visibleQueue" | "renderedQueue" | "activeProfileId" | "canAct">) => {
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
    [canInteract, discoveryFeed.policyVersion, discoveryFeed.queueVersion, logicalQueueIds, recordDiscoveryQueueTrace, renderedQueueIds],
  );

  const logLayoutChange = useCallback(
    (target: "card_stack" | "front_card", next: TraceLayout) => {
      const previous = previousLayoutRef.current[target];
      if (previous && previous.width === next.width && previous.height === next.height) return;
      previousLayoutRef.current[target] = next;
      trace("layout_change", { target, width: next.width, height: next.height });
    },
    [trace],
  );

  const getTraceSnapshot = useCallback(
    () => ({
      frontId: frontProfile?.id ?? null,
      secondId: secondProfile?.id ?? null,
      thirdId: thirdProfile?.id ?? null,
      visibleQueueLength: renderedQueueIds.filter((v) => v !== null).length,
      queuedDecisionCount: discoveryQueueRuntime.queuedDecisionCount ?? 0,
      frontReady: frontContent?.phase === "full",
      secondReady,
      activePhotoIndex,
      isDeckAnimating,
      isInfoVisible,
    }),
    [activePhotoIndex, discoveryQueueRuntime.queuedDecisionCount, frontContent?.phase, isDeckAnimating, isInfoVisible, renderedQueueIds, secondReady, frontProfile?.id, secondProfile?.id, thirdProfile?.id],
  );

  // ─── Insight sheet ───────────────────────────────────────────────────────────
  const dismissInsightSheet = useCallback(
    (animated = true) => {
      if (insightSheetClosingRef.current) return;
      const finalize = () => {
        insightSheetClosingRef.current = false;
        insightSheetTranslateY.setValue(0);
        setShowInsight(false);
      };
      if (!animated) { finalize(); return; }
      insightSheetClosingRef.current = true;
      Animated.timing(insightSheetTranslateY, {
        toValue: Math.max(220, height * 0.32), duration: 190, useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) { insightSheetClosingRef.current = false; return; }
        finalize();
      });
    },
    [height, insightSheetTranslateY],
  );

  useEffect(() => {
    if (showInsight) {
      insightSheetClosingRef.current = false;
      insightSheetTranslateY.setValue(0);
    }
  }, [insightSheetTranslateY, showInsight]);

  const insightSheetPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > Math.abs(gs.dx) && gs.dy > 6,
      onPanResponderGrant: () => { insightSheetTranslateY.stopAnimation(); },
      onPanResponderMove: (_, gs) => {
        insightSheetTranslateY.setValue(gs.dy <= 0 ? 0 : gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > INSIGHT_SHEET_DISMISS_THRESHOLD || gs.vy > INSIGHT_SHEET_DISMISS_VELOCITY) {
          dismissInsightSheet(); return;
        }
        Animated.timing(insightSheetTranslateY, { toValue: 0, duration: INSIGHT_SHEET_RESET_DURATION, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.timing(insightSheetTranslateY, { toValue: 0, duration: INSIGHT_SHEET_RESET_DURATION, useNativeDriver: true }).start();
      },
    }),
    [dismissInsightSheet, insightSheetTranslateY],
  );

  // ─── Location prompt ─────────────────────────────────────────────────────────
  const dismissLocationPrompt = useCallback(() => {
    pendingLocationSettingsReturnRef.current = false;
    setIsLocationPromptBusy(false);
    setLocationPromptVisible(false);
    setLocationPromptReason(null);
  }, []);

  const retryLocationPromptFlow = useCallback(
    async (origin: "prompt_button" | "app_foreground") => {
      const requestId = createTraceId("discover_location");
      setIsLocationPromptBusy(true);
      const result = await refreshProfileLocation({ reason: "discover_entry", force: true, requestId });
      if (result.status === "updated") {
        setLocationPromptVisible(false);
        setLocationPromptReason(null);
        setIsLocationPromptBusy(false);
        pendingLocationSettingsReturnRef.current = false;
        const ok = await refreshDiscoveryCandidates();
        return { openedSettings: false, recovered: true };
      }
      if (result.status === "skipped_recent_sync") {
        setLocationPromptReason("sync_failed");
        setLocationPromptVisible(true);
        setIsLocationPromptBusy(false);
        return { openedSettings: false, recovered: false, shouldOpenSettings: false };
      }
      if (result.status === "permission_denied" || result.status === "services_disabled") {
        setLocationPromptReason(result.status);
        setLocationPromptVisible(true);
        setIsLocationPromptBusy(false);
        return { openedSettings: false, recovered: false, shouldOpenSettings: result.status === "services_disabled" || (result.status === "permission_denied" && result.canAskAgain === false) };
      }
      setLocationPromptReason("sync_failed");
      setLocationPromptVisible(true);
      setIsLocationPromptBusy(false);
      return { openedSettings: false, recovered: false, shouldOpenSettings: false };
    },
    [refreshDiscoveryCandidates, refreshProfileLocation, user?.id],
  );

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pathname.endsWith("/discover")) {
      pendingLocationSettingsReturnRef.current = false;
      setIsLocationPromptBusy(false);
      setLocationPromptVisible(false);
      return;
    }
    void (async () => {
      const result = await refreshProfileLocation({ reason: "discover_entry" });
      if (result.status === "permission_denied" || result.status === "services_disabled") {
        setLocationPromptReason(result.status);
        setLocationPromptVisible(true);
      }
    })();
  }, [pathname, refreshProfileLocation]);

  useEffect(() => {
    if (!pathname.endsWith("/discover") || !hasAccessToken) return;
    const hasValidCache = hasValidDiscoveryWindowCache(discoveryQueueRuntime);
    if (!hasValidCache) {
      setIsQueueLoading(true);
      void refreshDiscoveryCandidates().finally(() => { setIsQueueLoading(false); });
    }
  }, [pathname, hasAccessToken, discoveryQueueRuntime]);

  useEffect(() => {
    if (!pathname.endsWith("/discover")) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !pendingLocationSettingsReturnRef.current) return;
      void retryLocationPromptFlow("app_foreground");
    });
    return () => { sub.remove(); };
  }, [pathname, retryLocationPromptFlow]);

  useEffect(() => {
    if (!isQueueLoading) return;
    if (discoveryFeed.generatedAt || discoveryFeed.supply?.fetchedAt) setIsQueueLoading(false);
  }, [discoveryFeed.generatedAt, discoveryFeed.supply?.fetchedAt, isQueueLoading]);

  useEffect(() => {
    if (!popularUpdateBanner) return;
    const t = setTimeout(() => setPopularUpdateBanner(null), 4200);
    return () => clearTimeout(t);
  }, [popularUpdateBanner]);

  React.useEffect(() => { setDraftFilters(activeFilters); }, [activeFilters]);

  // ─── KEY: flicker-free position settle ──────────────────────────────────────
  // After a swipe, we set settleAfterRotationRef=true and call setStableDeck().
  // This useLayoutEffect fires synchronously after React commits the new stableDeck
  // layout (where the old front slot is now hidden as third). Only THEN do we
  // reset position to 0 — so the old card never snaps back to center visibly.
  useLayoutEffect(() => {
    if (!settleAfterRotationRef.current) return;
    settleAfterRotationRef.current = false;
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
  }, [stableDeck]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Source entries → stable deck ────────────────────────────────────────────
  useEffect(() => {
    if (sourceEntries.length === 0) return;

    const currentFrontId  = getSlotContent(stableDeckRef.current, "front")?.profileId ?? null;
    const currentSecondId = getSlotContent(stableDeckRef.current, "second")?.profileId ?? null;
    const newFrontId      = sourceEntries[0]?.id ?? null;
    const newSecondId     = sourceEntries[1]?.id ?? null;

    // Guard: optimistic rotation fired but sourceEntries hasn't caught up yet
    if (
      optimisticFrontIdRef.current !== null &&
      discoveryIdsEqual(currentFrontId, optimisticFrontIdRef.current) &&
      !discoveryIdsEqual(newFrontId, optimisticFrontIdRef.current)
    ) {
      return; // skip — still stale data
    }

    // sourceEntries caught up — clear lock
    if (
      optimisticFrontIdRef.current !== null &&
      discoveryIdsEqual(newFrontId, optimisticFrontIdRef.current)
    ) {
      optimisticFrontIdRef.current = null;
    }

    // Visible window stable — silently update only the third buffer slot
    if (
      currentFrontId !== null &&
      discoveryIdsEqual(currentFrontId, newFrontId) &&
      discoveryIdsEqual(currentSecondId, newSecondId)
    ) {
      const newThirdProfile = sourceEntries[2]?.profile ?? null;
      if (newThirdProfile) {
        setStableDeck((d) => {
          const slot = d.third;
          const cur  = d[slot];
          if (cur?.profileId === newThirdProfile.id) return d;
          const next = { ...d, [slot]: makeSlotContent(newThirdProfile, "metadata") };
          stableDeckRef.current = next;
          return next;
        });
      }
      return;
    }

    // Visible window changed — full rebuild (filter change, cold start, exhaustion)
    const nextDeck = buildStableDeck(sourceEntries);
    stableDeckRef.current = nextDeck;
    setStableDeck(nextDeck);
    setActivePhotoIndex(0);
    setSwipeState("idle");
    setIsInfoVisible(false);
    setIsDeckAnimating(false);
    position.setValue({ x: 0, y: 0 });
    swipeFeedbackX.setValue(0);
    deckProgress.setValue(0);
    flipAnim.setValue(0);
  }, [sourceEntries]); // ← sourceEntries ONLY

  // ─── Preload effects ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!filteredEntries.length) return;
    void warmDiscoveryDeck([frontProfile, secondProfile, thirdProfile]);
  }, [filteredEntries, frontProfile, secondProfile, thirdProfile]);

  React.useEffect(() => {
    if (!frontProfile || frontProfile.images.length <= 1) return;
    let cancelled = false;
    void warmDiscoveryFrontExtras(frontProfile).then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [frontProfile]);

  // ─── Queue invariant check ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDeckAnimating || isQueueLoading) return;
    if (!logicalQueueIds.length || renderedQueueIds[0] == null) { 
      lastQueueViolationRef.current = null;
      setQueueInvariantViolation(null);
      return; }
    if (!discoveryIdsEqual(logicalQueueIds[0], renderedQueueIds[0])) {
      const message = `Rendered head mismatch: logical=${logicalQueueIds[0]} rendered=${renderedQueueIds[0]}`;
      if (lastQueueViolationRef.current !== message) {   // ← guard
        lastQueueViolationRef.current = message;
        setQueueInvariantViolation(message);
        logQueueTrace({ event: "queue_invariant_violation", requestId: discoveryQueueRuntime.lastRequestId, note: message, source: "render" });
      }
      return;
    }

    setQueueInvariantViolation(null);
  }, [isDeckAnimating, isQueueLoading, logicalQueueIds, logQueueTrace, renderedQueueIds]);

  useEffect(() => {
    const expected = expectedRenderQueueRef.current;
    if (!expected || isDeckAnimating || isQueueLoading) return;
    const renderedHead = renderedQueueIds[0] ?? null;
    const expectedHead = expected.resultQueue[0] ?? null;
    const matches = (renderedHead === null && expectedHead === null) || discoveryIdsEqual(renderedHead, expectedHead);
    if (!matches) {
      const message = `Next committed render mismatch: expected ${expectedHead ?? "none"}, got ${renderedHead ?? "none"}`;
      setQueueInvariantViolation(message);
      logQueueTrace({ event: "queue_invariant_violation", requestId: expected.requestId, resultQueue: expected.resultQueue, note: message, source: "render" });
      return;
    }
    logQueueTrace({ event: "queue_render_committed", requestId: expected.requestId, replacementProfileId: discoveryQueueRuntime.lastReplacementProfileId, resultQueue: expected.resultQueue, source: "render" });
    expectedRenderQueueRef.current = null;
  }, [discoveryQueueRuntime.lastReplacementProfileId, isDeckAnimating, isQueueLoading, logQueueTrace, renderedQueueIds]);

  // ─── Misc helpers ─────────────────────────────────────────────────────────────
  const lastSyncLabel = useMemo(() => {
    if (!lastServerSyncAt) return null;
    const date = new Date(lastServerSyncAt);
    if (Number.isNaN(date.getTime())) return null;
    try { return date.toLocaleString(language === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return date.toISOString(); }
  }, [language, lastServerSyncAt]);

  const baseGenderOptions = useMemo(
    () => [
      { value: "male" as const,       label: t("Hombre", "Male") },
      { value: "female" as const,     label: t("Mujer", "Female") },
      { value: "non_binary" as const, label: t("No binario", "Non-binary") },
      { value: "fluid" as const,      label: t("Fluidx", "Fluid") },
    ],
    [t],
  );

  const relatedGoals = useMemo(
    () => lastLikedProfile
      ? lastLikedProfile.goalFeedback.map((gf) => {
          const goal = goals.find((g) => g.id === gf.goalId);
          return goal ? { goal, reason: gf.reason } : null;
        }).filter(Boolean)
      : [],
    [goals, lastLikedProfile],
  );

  const insightLookup = useMemo(() => {
    const map = new Map<string, { es: string; en: string }>();
    [...sourceEntries.map((e) => e.profile), ...(lastLikedProfile ? [lastLikedProfile] : [])].forEach((p) => {
      p.insightTags.forEach((tag) => map.set(tag.en, tag));
    });
    return map;
  }, [lastLikedProfile, sourceEntries]);

  const topPad    = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const { bottomObstructionHeight: filterBottomObstruction } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: 16,
    extraKeyboardSpacing: Platform.OS === "ios" ? KEYBOARD_SURFACE_GAP.ios : KEYBOARD_SURFACE_GAP.android,
    enabled: isFilterVisible,
  });

  const buildPopularUpdateMessage = useCallback(
    (changedCategories: { category: "physical" | "personality" | "family" | "expectations" | "language" | "studies"; nextValueKey: string }[]) => {
      const visible = changedCategories.slice(0, 2).map((item) => {
        const categoryLabel =
          item.category === "physical"      ? t("Físicas", "Physical")
          : item.category === "personality" ? t("Personalidad", "Personality")
          : item.category === "family"      ? t("Familia", "Family")
          : item.category === "expectations"? t("Expectativas", "Expectations")
          : item.category === "language"    ? t("Idioma", "Language")
          :                                   t("Estudios", "Studies");
        const valueLabel = formatPopularAttributeValue(item.category, item.nextValueKey, { t, language, insightLookup, emptyLabel: t("Sin definir", "Not set") });
        return `${categoryLabel}: ${valueLabel}`;
      });
      const extraCount = changedCategories.length - visible.length;
      return {
        title: t("Tus preferencias se están perfilando", "Your preferences are becoming clearer"),
        body: extraCount > 0 ? `${visible.join(" · ")} +${extraCount}` : visible.join(" · "),
      };
    },
    [insightLookup, language, t],
  );

  // ─── Card interaction helpers ────────────────────────────────────────────────
  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.timing(position, { toValue: { x: 0, y: 0 }, duration: SWIPE_FEEDBACK_RESET_DURATION, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(swipeFeedbackX, { toValue: 0, duration: SWIPE_FEEDBACK_RESET_DURATION, useNativeDriver: false }),
      Animated.timing(deckProgress, { toValue: 0, duration: SWIPE_FEEDBACK_RESET_DURATION, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [deckProgress, position, swipeFeedbackX]);

  // Hard reset — used when animation is interrupted/cancelled
  const resetCardState = useCallback(() => {
    swipingRef.current = false;
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
  }, [deckProgress, flipAnim, position, swipeFeedbackX]);

  const setInfoVisible = useCallback((nextVisible: boolean) => {
    if (shouldSuppressVisualChurn) return;
    setIsInfoVisible(nextVisible);
    if (nextVisible) backScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(flipAnim, { toValue: nextVisible ? 1 : 0, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [flipAnim, shouldSuppressVisualChurn]);

  const toggleInfo = () => {
    Haptics.selectionAsync().catch(() => {});
    setInfoVisible(!isInfoVisible);
  };

  // ─── Deck promotion (called after swipe animation completes) ─────────────────
  // Does NOT reset animated values — that is deferred to useLayoutEffect above,
  // which fires after React commits the new stableDeck (preventing snap-back flicker).
  const promoteDeckAfterDecision = useCallback(
    (
      optimisticEntries: DiscoverEntry[],
      options: { requestId: string; targetProfileId: number; replacementProfileId: number | null },
    ) => {
      swipingRef.current = false;
      const replacementProfile =
        optimisticEntries.length >= 3 ? optimisticEntries[2]?.profile ?? null : null;

      let promotedFrontId: number | null = null;

      setStableDeck((current) => {
        let next = rotateStableDeck(current, replacementProfile);
        next = upgradeSlotToFull(next, next.front);
        next = upgradeSlotToCover(next, next.second);
        next = upgradeSlotToCover(next, next.third);
        stableDeckRef.current = next;
        promotedFrontId = getSlotContent(next, "front")?.profileId ?? null;
        return next;
      });

      optimisticFrontIdRef.current = promotedFrontId;

      // Signal useLayoutEffect to reset position AFTER the above stableDeck
      // commit renders. This is what eliminates the snap-back flicker.
      settleAfterRotationRef.current = true;

      // Pure state resets (not animated values — those are handled by useLayoutEffect)
      setActivePhotoIndex(0);
      setSwipeState("idle");
      setIsDeckAnimating(false);
      setIsInfoVisible(false);
      flipAnim.setValue(0);
      backScrollRef.current?.scrollTo({ y: 0, animated: false });

      expectedRenderQueueRef.current = {
        requestId: options.requestId,
        resultQueue: optimisticEntries.slice(0, DISCOVERY_QUEUE_CACHE_SIZE).map((e) => e.id),
      };
    },
    [flipAnim],
  );

  // ─── Animation: card exits via button ─────────────────────────────────────────
  // Phase 1 (0–60ms):   stamp jumps to full opacity — feels snappy/responsive
  // Phase 2 (0–220ms):  card arcs off screen + second card rises simultaneously
  // The two phases run in parallel so the total duration is 220ms.
  const animateButtonSwipeFeedback = useCallback(
    (direction: SwipeDirection, onComplete: () => void) => {
      const isRight   = direction === "right";
      const stampX    = isRight ? SWIPE_FEEDBACK_DISTANCE : -SWIPE_FEEDBACK_DISTANCE;
      const flyX      = isRight ? width * 1.55 : -width * 1.55;
      const flyY      = -50; // slight upward arc — feels like lifting a card from a table

      // Snap stamp to full immediately (feels responsive before animation)
      swipeFeedbackX.setValue(stampX);

      Animated.parallel([
        // Card flies off with a natural arc
        Animated.timing(position, {
          toValue: { x: flyX, y: flyY },
          duration: BUTTON_FLY_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // ease-out — decelerates like real physics
          useNativeDriver: false,
        }),
        // Second card smoothly rises as the front card leaves
        Animated.timing(deckProgress, {
          toValue: 1,
          duration: BUTTON_FLY_DURATION,
          easing: Easing.bezier(0.0, 0.0, 0.2, 1), // fast-in, slow-out — settles naturally
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) { resetCardState(); return; }
        onComplete();
      });
    },
    [deckProgress, position, resetCardState, swipeFeedbackX, width],
  );

  // ─── Animation: card exits via gesture release ────────────────────────────────
  // The card is already partially off-screen from the gesture. We continue its
  // momentum to fly the rest of the way off.
  const holdGestureSwipeFeedback = useCallback(
    (onComplete: () => void) => {
      const isRight = swipeDirectionRef.current === "right";
      const flyX    = isRight ? width * 1.55 : -width * 1.55;
      const flyY    = -40;

      Animated.parallel([
        Animated.timing(position, {
          toValue: { x: flyX, y: flyY },
          duration: GESTURE_FLY_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
        Animated.timing(deckProgress, {
          toValue: 1,
          duration: GESTURE_FLY_DURATION,
          easing: Easing.bezier(0.0, 0.0, 0.2, 1),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) { resetCardState(); return; }
        onComplete();
      });
    },
    [deckProgress, position, resetCardState, width],
  );

  // ─── Photo stepping ───────────────────────────────────────────────────────────
  const stepPhoto = useCallback((direction: "prev" | "next") => {
    if (shouldSuppressVisualChurn) return;
    if (!frontProfile || currentImages.length <= 1) return;
    const nextIndex = direction === "next"
      ? Math.min(activePhotoIndex + 1, currentImages.length - 1)
      : Math.max(activePhotoIndex - 1, 0);
    if (nextIndex === activePhotoIndex) return;
    Haptics.selectionAsync().catch(() => {});
    const nextUri = frontProfile.images[nextIndex];
    if (!nextUri || isDiscoveryImageWarm(nextUri)) { setActivePhotoIndex(nextIndex); return; }
    const frontProfileId = frontProfile.id;
    void warmDiscoveryProfileImages(frontProfile, 1, nextIndex).then(() => {
      if (getSlotContent(stableDeckRef.current, "front")?.profileId === frontProfileId && isDiscoveryImageWarm(nextUri)) {
        setActivePhotoIndex(nextIndex);
      }
    });
  }, [activePhotoIndex, currentImages.length, frontProfile, shouldSuppressVisualChurn]);

  // ─── Filter actions ───────────────────────────────────────────────────────────
  const toggleBaseGender = (value: BaseGender) => {
    setDraftFilters((cur) => ({
      ...cur,
      selectedGenders: normalizeSelectedGenders(
        cur.selectedGenders.includes(value)
          ? cur.selectedGenders.filter((v) => v !== value)
          : [...cur.selectedGenders, value],
      ),
    }));
  };

  const toggleTherianMode = (mode: Exclude<TherianMode, "exclude">) => {
    setDraftFilters((cur) => ({ ...cur, therianMode: cur.therianMode === mode ? "exclude" : mode }));
  };

  const openFilters = () => {
    if (isOffline) return;
    setDraftFilters({ ...activeFilters, selectedGenders: [...activeFilters.selectedGenders] });
    setIsFilterVisible(true);
    Haptics.selectionAsync().catch(() => {});
  };
  const closeFilters = () => { Keyboard.dismiss(); setIsFilterVisible(false); };

  const applyFilters = () => {
    if (isOffline) return;
    Keyboard.dismiss();
    setIsQueueLoading(true);
    void (async () => {
      try {
        await saveDiscoveryFilters({ ...draftFilters, selectedGenders: [...draftFilters.selectedGenders] });
        resetCardState();
        setIsFilterVisible(false);
      } finally { setIsQueueLoading(false); }
    })();
  };

  const clearFilters = () => {
    if (isOffline) return;
    Keyboard.dismiss();
    setDraftFilters({ ...defaultFilters, selectedGenders: [...defaultFilters.selectedGenders] });
    setIsQueueLoading(true);
    void (async () => {
      try {
        await saveDiscoveryFilters({ ...defaultFilters, selectedGenders: [...defaultFilters.selectedGenders] });
        resetCardState();
        setIsFilterVisible(false);
      } finally { setIsQueueLoading(false); }
    })();
  };

  const handleRetryDiscovery = useCallback(() => {
    if (isOffline) return;
    setIsQueueLoading(true);
    void (async () => {
      try {
        const ok = await saveDiscoveryFilters({ ...activeFilters, selectedGenders: [...activeFilters.selectedGenders] });
        if (!ok) return;
        resetCardState();
      } finally { setIsQueueLoading(false); }
    })();
  }, [activeFilters, isOffline, resetCardState, saveDiscoveryFilters]);

  const handleResetSeenProfiles = useCallback(() => {
    void refreshDiscoveryCandidates().then((ok) => { if (!ok) return; resetCardState(); });
  }, [refreshDiscoveryCandidates, resetCardState]);

  // ─── Core swipe commit ────────────────────────────────────────────────────────
  const commitDiscoverySwipe = useCallback(
    (direction: SwipeDirection, origin: SwipeCommitOrigin = "button") => {
      const action: "like" | "pass" = direction === "right" ? "like" : "pass";
      const renderedFrontId  = normalizeDiscoveryProfileId(frontProfile?.id ?? null);
      const targetProfileId  = logicalActiveProfileId ?? renderedFrontId ?? null;

      logQueueTrace({
        event: "decision_tap", requestId: null, action, targetProfileId,
        logicalHeadId: logicalActiveProfileId, renderedFrontId, tapSource: origin,
        hasAccessToken, authStatus, isOffline, isDeckAnimating, hasPendingDecision, source: "render",
      });

      if (!frontProfile) { swipingRef.current = false; return false; }
      if (isDeckAnimating) { swipingRef.current = false; return false; }
      if (isOffline) { swipingRef.current = false; return false; }
      if (!canInteract) { swipingRef.current = false; return false; }
      if (logicalActiveProfileId === null || renderedFrontId === null) { swipingRef.current = false; return false; }

      swipeDirectionRef.current = direction;
      swipingRef.current = true;
      const profile         = frontProfile;
      const requestId       = createTraceId(`discovery_${action}_${logicalActiveProfileId}`);
      const requestDecision = direction === "right" ? likeProfile : passProfile;
      const queueVersion    = Number.isFinite(Number(discoveryFeed.queueVersion)) && Number(discoveryFeed.queueVersion) > 0
        ? Number(discoveryFeed.queueVersion) : null;
      const decisionContext = {
        requestId, action,
        targetProfileId: logicalActiveProfileId,
        expectedHeadId: logicalActiveProfileId,
        visibleProfileIds: logicalQueueIds.slice(0, DISCOVERY_PAGE_SIZE),
        queueVersion,
        policyVersion: discoveryFeed.policyVersion ?? null,
        renderedFrontId, tapSource: origin,
      };

      setIsDeckAnimating(true);
      Haptics.impactAsync(direction === "right" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const commitSwipe = () => {
        // Optimistic deck promotion — no API wait
        const optimisticEntries = sourceEntries.filter((e) => !discoveryIdsEqual(e.id, decisionContext.targetProfileId));
        promoteDeckAfterDecision(optimisticEntries, {
          requestId,
          targetProfileId: decisionContext.targetProfileId,
          replacementProfileId: null,
        });

        if (direction === "right") setLastLikedProfile(profile);

        recordDiscoverySwipe(direction, { requestId, targetProfileId: decisionContext.targetProfileId });

        // Background API call
        void (async () => {
          const result = await requestDecision(profile, { requestId, renderedFrontId, tapSource: origin, decisionContext });
          if (!result) return;
          if (result.decisionRejectedReason === "cursor_stale") { setIsQueueLoading(true); return; }
          if (result.replacementProfile?.images?.[0]) {
            void ExpoImage.prefetch(result.replacementProfile.images[0]);
          }
          if (result.replacementProfile) {
            void warmDiscoveryProfileImages(result.replacementProfile, 1, 0);
          }
          if (direction === "right" && result.shouldShowDiscoveryUpdate && result.changedCategories.length) {
            const message = buildPopularUpdateMessage(result.changedCategories);
            setPopularUpdateBanner({ id: Date.now(), title: message.title, body: message.body });
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
      animateButtonSwipeFeedback, buildPopularUpdateMessage, canInteract,
      discoveryFeed.policyVersion, discoveryFeed.queueVersion,
      frontProfile, hasAccessToken, authStatus, hasPendingDecision,
      holdGestureSwipeFeedback, isDeckAnimating, isOffline,
      likeProfile, logQueueTrace, logicalActiveProfileId, logicalQueueIds,
      passProfile, recordDiscoverySwipe, sourceEntries, promoteDeckAfterDecision,
    ],
  );

  const swipeRight = useCallback(
    (origin: SwipeCommitOrigin = "button") => {
      debugDiscoveryLog("swipe_right_called", {
        canInteract,
        frontProfile: frontProfile?.id,
        logicalActiveProfileId,
        isDeckAnimating,
      });
      return commitDiscoverySwipe("right", origin);
    },
    [commitDiscoverySwipe, canInteract, frontProfile?.id, logicalActiveProfileId, isDeckAnimating],
  );

  const swipeLeft = useCallback(
    (origin: SwipeCommitOrigin = "button") => {
      debugDiscoveryLog("swipe_left_called", {
        canInteract,
        frontProfile: frontProfile?.id,
        logicalActiveProfileId,
        isDeckAnimating,
      });
      return commitDiscoverySwipe("left", origin);
    },
    [commitDiscoverySwipe, canInteract, frontProfile?.id, logicalActiveProfileId, isDeckAnimating],
  );

  // ─── Pan responder ────────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!canInteract) return false;
        const horiz = Math.abs(gesture.dx) > GESTURE_MIN_DX && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        const infoSwipe = !isInfoVisible && gesture.dy < -GESTURE_MIN_DX && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return horiz || infoSwipe;
      },
      onPanResponderGrant: () => {
        swipeSessionIdRef.current = createTraceId("swipe");
        swipeDirectionRef.current = null;
        thresholdLoggedRef.current = false;
        swipeFeedbackX.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        const horiz = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
        if (horiz) {
          position.setValue({ x: gesture.dx, y: gesture.dy * 0.15 }); // slight vertical follow
          swipeFeedbackX.setValue(clampNumber(gesture.dx, -SWIPE_FEEDBACK_DISTANCE, SWIPE_FEEDBACK_DISTANCE));

          // Drive deckProgress based on how far toward the threshold the card is
          const progress = Math.min(Math.abs(gesture.dx) / (SWIPE_THRESHOLD * 1.5), 1);
          deckProgress.setValue(progress * 0.4); // subtle — only shows partially during drag

          const nextDir: SwipeDirection | null = gesture.dx > 0 ? "right" : gesture.dx < 0 ? "left" : null;
          if (nextDir) swipeDirectionRef.current = nextDir;
          if (gesture.dx > 40) setSwipeState("like");
          else if (gesture.dx < -40) setSwipeState("dislike");
          else setSwipeState("idle");
          return;
        }
        if (!isInfoVisible && gesture.dy < 0) {
          position.setValue({ x: 0, y: gesture.dy * 0.4 });
          swipeFeedbackX.setValue(0);
          setSwipeState("idle");
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const horiz = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
        if (horiz) {
          if (gesture.dx > SWIPE_THRESHOLD) {
            if (!swipeRight("gesture")) { resetPosition(); setSwipeState("idle"); swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false; }
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            if (!swipeLeft("gesture")) { resetPosition(); setSwipeState("idle"); swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false; }
          } else {
            resetPosition(); setSwipeState("idle"); swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false;
          }
          return;
        }
        if (!isInfoVisible && gesture.dy < -INFO_SWIPE_THRESHOLD && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          Haptics.selectionAsync().catch(() => {});
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          setInfoVisible(true);
          swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false;
          return;
        }
        resetPosition(); setSwipeState("idle"); swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false;
      },
      onPanResponderTerminate: () => {
        resetPosition(); setSwipeState("idle"); swipeSessionIdRef.current = null; swipeDirectionRef.current = null; thresholdLoggedRef.current = false;
      },
    }),
    [canInteract, isInfoVisible, resetPosition, setInfoVisible, swipeFeedbackX, swipeLeft, swipeRight, deckProgress],
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t("Descubrir", "Discover")}</Text>
          <Text style={styles.headerSub}>{t("Aprende de cada perfil", "Learn from every profile")}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={openFilters}
            disabled={isOffline}
            style={({ pressed }) => [styles.filterBtn, hasActiveFilters && styles.filterBtnActive, isOffline && styles.emptyCardButtonDisabled, pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] }]}
          >
            <Feather name="sliders" size={18} color={hasActiveFilters ? Colors.like : Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Card stack */}
      {hasDeckProfiles && frontProfile ? (
        <>
          <View
            style={styles.cardStack}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              logLayoutChange("card_stack", { width: w, height: h });
            }}
          >
            {(["slotA", "slotB", "slotC"] as SlotId[]).map((slotId) => {
              const content  = stableDeck[slotId];
              const isFront  = stableDeck.front  === slotId;
              const isSecond = stableDeck.second === slotId;
              const isThird  = stableDeck.third  === slotId;
              const profile  = content?.profile ?? null;

              // Image URI for this slot
              const slotImageUri = isFront
                ? (currentImages[Math.min(activePhotoIndex, currentImages.length - 1)] ?? currentImages[0] ?? null)
                : isSecond
                  ? (content?.coverImageUri ?? null)
                  : null;

              return (
                <Animated.View
                  key={slotId}                           // ← permanent key — no remount
                  {...(isFront ? panResponder.panHandlers : {})}
                  pointerEvents={isFront ? "box-none" : "none"}
                  style={[
                    styles.cardBase,
                    cardFrameStyle,
                    !profile && styles.cardSlotHidden,

                    // Front: follows gesture + fly-out
                    isFront && [
                      styles.cardFrontShadow,
                      {
                        zIndex: 3,
                        transform: [
                          { translateX: position.x },
                          { translateY: position.y },
                          { rotate },
                        ],
                      },
                    ],

                    // Second: rises as front card leaves (driven by deckProgress)
                    isSecond && {
                      zIndex: 2,
                      opacity: profile ? secondCardOpacity : 0,
                      transform: [
                        { scale: secondCardScale },
                        { translateY: secondCardTranslateY },
                      ],
                    },

                    // Third: follows second card slightly
                    isThird && {
                      zIndex: 1,
                      opacity: profile ? thirdCardOpacity : 0,
                      transform: [
                        { scale: thirdCardScale },
                        { translateY: thirdCardTranslateY },
                      ],
                    },
                  ]}
                >
                  {/* ── THIRD: solid backdrop ──────────────────────────────── */}
                  {isThird && profile ? (
                    <>
                      <View style={styles.cardThirdBackdrop} />
                      {content?.coverImageUri ? (
                        <ExpoImage
                          source={{ uri: content.coverImageUri }}
                          recyclingKey={slotId}
                          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          pointerEvents="none"
                        />
                      ) : null}
                    </>
                  ) : null}

                  {/* ── SECOND: cover image + metadata overlay ─────────────── */}
                  {isSecond && profile ? (
                    <>
                      {slotImageUri ? (
                        <ExpoImage
                          source={{ uri: slotImageUri }}
                          recyclingKey={slotId}           // ← stable GPU texture per slot
                          style={styles.cardImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={120}
                        />
                      ) : null}
                      <LinearGradient
                        colors={["transparent", "rgba(15,26,20,0.98)"]}
                        style={styles.cardGradient}
                        pointerEvents="none"
                      >
                        {profile.pronouns ? <Text style={styles.cardPronouns}>{getPronounLabel(profile.pronouns, language)}</Text> : null}
                        <Text style={styles.cardName}>{profile.name}</Text>
                        {profile.genderIdentity ? <Text style={styles.cardIdentity}>{getGenderIdentityLabel(profile.genderIdentity, t)}</Text> : null}
                        <Text style={styles.cardAgeSign}>{(() => { const z = getZodiacSignLabel(getZodiacSignFromIsoDate(profile.dateOfBirth ?? ""), t); return z ? `${profile.age} · ${z}` : String(profile.age); })()}</Text>
                        <View style={styles.cardRow}>
                          <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                          <Text style={styles.cardLocation}>{profile.location}</Text>
                          <Text style={styles.cardDot}>·</Text>
                          <Text style={styles.cardOccupation}>{t(profile.occupation.es, profile.occupation.en)}</Text>
                        </View>
                        <View style={styles.interestsRow}>
                          {profile.attributes.interests.slice(0, 3).map((interest) => (
                            <View key={`${slotId}-${profile.id}-${interest}`} style={styles.interestChip}>
                              <Text style={styles.interestChipText}>{interest}</Text>
                            </View>
                          ))}
                        </View>
                        {profile.images.length > 1 ? (
                        <View style={styles.photoDotsRow}>
                          {profile.images.map((_, index) => (
                            <View key={`${slotId}-${profile.id}-dot-${index}`} style={styles.photoDot} />
                          ))}
                        </View>
                      ) : null}
                      </LinearGradient>
                    </>
                  ) : null}

                  {/* ── FRONT: interactive card with flip ─────────────────── */}
                  {isFront && profile ? (
                    <>
                      {/* LIKE/PASS stamp overlays */}
                      <Animated.View pointerEvents="none" style={[styles.likeOverlay, { opacity: likeOpacity }]}>
                        <LinearGradient colors={["transparent", Colors.likeOverlay]} style={StyleSheet.absoluteFillObject} />
                        <View style={styles.stampContainer}>
                          <Animated.View style={{ transform: [{ scale: likeStampScale }, { translateY: likeStampTranslateY }] }}>
                            <View style={styles.likeStamp}>
                              <Feather name="heart" size={28} color="#fff" />
                              <Text style={styles.stampText}>{t("ME GUSTA", "LIKE")}</Text>
                            </View>
                          </Animated.View>
                        </View>
                      </Animated.View>

                      <Animated.View pointerEvents="none" style={[styles.dislikeOverlay, { opacity: dislikeOpacity }]}>
                        <LinearGradient colors={["transparent", Colors.dislikeOverlay]} style={StyleSheet.absoluteFillObject} />
                        <View style={styles.stampContainer}>
                          <Animated.View style={{ transform: [{ scale: dislikeStampScale }, { translateY: dislikeStampTranslateY }] }}>
                            <View style={styles.dislikeStamp}>
                              <Feather name="x" size={28} color="#fff" />
                              <Text style={styles.stampText}>{t("PASAR", "PASS")}</Text>
                            </View>
                          </Animated.View>
                        </View>
                      </Animated.View>

                      {/* Front face — image + overlays */}
                      <Animated.View
                        pointerEvents={isInfoVisible ? "none" : "auto"}
                        style={[
                          styles.cardFace,
                          styles.cardFaceFront,
                          IS_WEB
                            ? { opacity: frontOpacity, zIndex: isInfoVisible ? 1 : 3 }
                            : { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
                        ]}
                      >
                        {slotImageUri ? (
                          <ExpoImage
                            source={{ uri: slotImageUri }}
                            recyclingKey={slotId}         // ← same recyclingKey as slot
                            style={styles.cardImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={120}
                          />
                        ) : null}

                        <View style={styles.photoTapLayer} pointerEvents="box-none">
                          <Pressable onPress={() => stepPhoto("prev")} style={styles.photoTapZone} />
                          <Pressable onPress={() => stepPhoto("next")} style={styles.photoTapZone} />
                        </View>

                        <LinearGradient colors={["transparent", "rgba(15,26,20,0.98)"]} style={styles.cardGradient}>
                          {pronounLabel ? <Text style={styles.cardPronouns}>{pronounLabel}</Text> : null}
                          <Text style={styles.cardName}>{profile.name}</Text>
                          {genderIdentityLabel ? <Text style={styles.cardIdentity}>{genderIdentityLabel}</Text> : null}
                          <Text style={styles.cardAgeSign}>{ageWithSign}</Text>
                          <View style={styles.cardRow}>
                            <Feather name="map-pin" size={13} color={Colors.primaryLight} />
                            <Text style={styles.cardLocation}>{profile.location}</Text>
                            <Text style={styles.cardDot}>·</Text>
                            <Text style={styles.cardOccupation}>{t(profile.occupation.es, profile.occupation.en)}</Text>
                          </View>
                          <View style={styles.interestsRow}>
                            {profile.attributes.interests.slice(0, 3).map((interest) => (
                              <View key={`${profile.id}-${interest}`} style={styles.interestChip}>
                                <Text style={styles.interestChipText}>{interest}</Text>
                              </View>
                            ))}
                          </View>
                          {currentImages.length > 1 ? (
                            <View style={styles.photoDotsRow}>
                              {currentImages.map((_, index) => (
                                <View key={`${profile.id}-dot-${index}`} style={[styles.photoDot, index === activePhotoIndex && styles.photoDotActive]} />
                              ))}
                            </View>
                          ) : null}
                        </LinearGradient>
                      </Animated.View>

                      {/* Back face — info panel */}
                      <Animated.View
                        pointerEvents={isInfoVisible ? "auto" : "none"}
                        style={[
                          styles.cardFace,
                          styles.cardFaceBack,
                          IS_WEB
                            ? { opacity: backOpacity, zIndex: isInfoVisible ? 3 : 1 }
                            : { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
                        ]}
                      >
                        <View style={styles.backHeader}>
                          <View style={styles.backInfoBadge}>
                            <Feather name="info" size={14} color={Colors.info} />
                          </View>
                          <Text style={styles.backName}>{profile.name}, {profile.age}</Text>
                          <Text style={styles.backMeta}>{profile.location} · {t(profile.occupation.es, profile.occupation.en)}</Text>
                        </View>
                        <ScrollView ref={backScrollRef} style={styles.backScroll} contentContainerStyle={styles.backScrollContent} showsVerticalScrollIndicator={false}>
                          <View style={styles.backSection}>
                            <Text style={styles.backSectionTitle}>{t("Sobre mí", "About me")}</Text>
                            <AboutRow icon="message-circle" label={t("Sobre mí", "About me")} value={t(profile.about.bio.es, profile.about.bio.en)} />
                            <AboutRow icon="heart" label={t("Metas de tu relación", "Relationship goals")} value={getRelationshipGoalLabel(profile.about.relationshipGoals, t)} />
                            <AboutRow icon="book-open" label={t("Educación", "Education")} value={getEducationLabel(profile.about.education, t)} />
                            <AboutRow icon="users" label={t("Hijxs", "Children")} value={getChildrenPreferenceLabel(profile.about.childrenPreference, t)} />
                            <AboutRow icon="globe" label={t("Idiomas", "Languages")} value={
                              <View style={styles.flagImageRow}>
                                {profile.about.languagesSpoken.map((value) => {
                                  const uri = getLanguageFlagUri(value);
                                  return uri
                                    ? <ExpoImage key={`${profile.id}-${value}`} source={{ uri }} style={styles.flagImage} contentFit="cover" cachePolicy="memory-disk" />
                                    : <View key={`${profile.id}-${value}`} style={styles.flagFallback}><Feather name="globe" size={14} color={Colors.info} /></View>;
                                })}
                              </View>
                            } />
                          </View>
                          <View style={styles.backSection}>
                            <Text style={styles.backSectionTitle}>{t("Estilo de vida", "Life Style")}</Text>
                            <View style={styles.lifestyleGrid}>
                              <LifestyleTile icon="activity" label={t("Actividad física", "Activity")} value={getPhysicalActivityLabel(profile.lifestyle.physicalActivity, t)} />
                              <LifestyleTile icon="coffee"   label={t("Bebida", "Drink")}             value={getAlcoholUseLabel(profile.lifestyle.alcoholUse, t)} />
                              <LifestyleTile icon="wind"     label={t("Tabaco", "Smoke")}             value={getTobaccoUseLabel(profile.lifestyle.tobaccoUse, t)} />
                              <LifestyleTile icon="flag"     label={t("Política", "Politics")}        value={getPoliticalInterestLabel(profile.lifestyle.politicalInterest, t)} />
                              <LifestyleTile icon="star"     label={t("Religión", "Religion")}        value={getReligionImportanceLabel(profile.lifestyle.religionImportance, t)} />
                              <LifestyleTile icon="moon"     label={t("Creencia", "Belief")}          value={getReligionLabel(profile.lifestyle.religion, t)} />
                            </View>
                          </View>
                          <View style={styles.backSection}>
                            <Text style={styles.backSectionTitle}>{t("Atributos físicos", "Physical attributes")}</Text>
                            <PhysicalRow icon="user"       label={t("Tipo de cuerpo", "Body type")}    value={getBodyTypeLabel(profile.physical.bodyType, t)} />
                            <PhysicalRow icon="maximize-2" label={t("Altura", "Height")}               value={profile.physical.height} />
                            <PhysicalRow icon="feather"    label={t("Color de cabello", "Hair color")} value={getHairColorLabel(profile.physical.hairColor, t)} />
                            <PhysicalRow icon="map"        label={t("Etnia", "Ethnicity")}             value={getEthnicityLabel(profile.physical.ethnicity, t)} />
                          </View>
                        </ScrollView>
                      </Animated.View>
                    </>
                  ) : null}
                </Animated.View>
              );
            })}
          </View>

          {secondContent?.coverImageUri ? (
            <View
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <ExpoImage
                source={{ uri: secondContent.coverImageUri }}
                recyclingKey={`preload-${stableDeck.second}`}
                style={{ width: 1, height: 1, opacity: 0 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={[styles.actions, { paddingBottom: bottomPad + 80 }]}>
            <Pressable
              onPress={() => { if (!canInteract || swipingRef.current) return; swipeLeft("button"); }}
              disabled={!canInteract}
              testID="discover-pass-button"
              style={({ pressed }) => [styles.actionBtn, styles.dislikeBtn, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}
            >
              <Feather name="x" size={26} color={canInteract ? Colors.dislike : Colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={toggleInfo}
              testID="discover-info-button"
              style={({ pressed }) => [styles.actionBtnSm, styles.infoBtn, isInfoVisible && styles.infoBtnActive, { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Feather name="info" size={20} color={Colors.info} />
            </Pressable>

            <Pressable
              onPress={() => { if (!canInteract || swipingRef.current) return; swipeRight("button"); }}
              disabled={!canInteract}
              testID="discover-like-button"
              style={({ pressed }) => [styles.actionBtn, styles.likeBtn, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}
            >
              <Feather name="heart" size={26} color={canInteract ? Colors.like : Colors.textMuted} />
            </Pressable>
          </View>
        </>

      ) : showQueueLoading ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}><ActivityIndicator color={Colors.primaryLight} /></View>
            <Text style={styles.emptyCardTitle}>{t("Cargando discovery", "Loading discovery")}</Text>
            <Text style={styles.emptyCardCopy}>{t("Estamos preparando una nueva cola con tus filtros actuales.", "We are preparing a new queue with your current filters.")}</Text>
          </View>
        </View>

      ) : isOfflineDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}><Feather name="wifi-off" size={24} color={Colors.info} /></View>
            <Text style={styles.emptyCardTitle}>{t("No podemos cargar más perfiles ahora", "We cannot load more profiles right now")}</Text>
            <Text style={styles.emptyCardCopy}>{lastSyncLabel ? t(`Última sincronización: ${lastSyncLabel}.`, `Last sync: ${lastSyncLabel}.`) : t("Vuelve a conectarte para continuar.", "Reconnect to continue.")}</Text>
            <Pressable onPress={handleRetryDiscovery} disabled={isOffline} style={({ pressed }) => [styles.emptyCardButton, isOffline && styles.emptyCardButtonDisabled, pressed && !isOffline && { opacity: 0.84 }]}>
              <Text style={[styles.emptyCardButtonText, isOffline && styles.emptyCardButtonTextDisabled]}>{t("Reintentar", "Retry")}</Text>
            </Pressable>
          </View>
        </View>

      ) : isOnlineDeckExhausted ? (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}><Feather name="check-circle" size={24} color={Colors.info} /></View>
            <Text style={styles.emptyCardTitle}>{t("No hay más perfiles por ahora", "No more profiles for now")}</Text>
            <Text style={styles.emptyCardCopy}>{t("Ya viste todos los perfiles disponibles con esta selección.", "You have seen all available profiles for this selection.")}</Text>
            <View style={styles.emptyCardActions}>
              <Pressable onPress={handleResetSeenProfiles} style={({ pressed }) => [styles.emptyCardButton, styles.emptyCardButtonInline, pressed && { opacity: 0.84 }]}>
                <Text style={styles.emptyCardButtonText}>{t("Buscar nuevos perfiles", "Check for new profiles")}</Text>
              </Pressable>
              <Pressable onPress={clearFilters} style={({ pressed }) => [styles.emptyCardButton, styles.emptyCardButtonInline, styles.emptyCardButtonSecondary, pressed && { opacity: 0.84 }]}>
                <Text style={[styles.emptyCardButtonText, styles.emptyCardButtonTextSecondary]}>{t("Limpiar filtros", "Clear filters")}</Text>
              </Pressable>
            </View>
          </View>
        </View>

      ) : (
        <View style={styles.cardStack}>
          <View style={[styles.cardBase, cardFrameStyle, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}><Feather name="sliders" size={24} color={Colors.info} /></View>
            <Text style={styles.emptyCardTitle}>{t("Cambia los valores del filtro", "Change your filter values")}</Text>
            <Text style={styles.emptyCardCopy}>{t("No encontramos perfiles con esa combinación.", "We could not find profiles with that combination.")}</Text>
            <View style={styles.emptyCardActions}>
              <Pressable onPress={handleRetryDiscovery} style={({ pressed }) => [styles.emptyCardButton, styles.emptyCardButtonInline, pressed && { opacity: 0.84 }]}>
                <Text style={styles.emptyCardButtonText}>{t("Volver a cargar", "Reload")}</Text>
              </Pressable>
              <Pressable onPress={clearFilters} style={({ pressed }) => [styles.emptyCardButton, styles.emptyCardButtonInline, styles.emptyCardButtonSecondary, pressed && { opacity: 0.84 }]}>
                <Text style={[styles.emptyCardButtonText, styles.emptyCardButtonTextSecondary]}>{t("Limpiar filtros", "Clear filters")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Location prompt modal */}
      <Modal visible={locationPromptVisible} transparent animationType="none" onRequestClose={dismissLocationPrompt}>
        <View style={styles.locationPromptOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismissLocationPrompt} />
          <View style={styles.locationPromptCard}>
            <View style={styles.locationPromptIcon}><Feather name="map-pin" size={18} color={Colors.primaryLight} /></View>
            <Text style={styles.locationPromptTitle}>{t("Activa tu ubicación", "Enable your location")}</Text>
            <Text style={styles.locationPromptCopy}>
              {locationPromptReason === "services_disabled"
                ? t("MatchA funciona mejor con el GPS activado.", "MatchA works better with GPS enabled.")
                : locationPromptReason === "sync_failed"
                  ? t("No pudimos actualizar tu ciudad todavía.", "We could not update your city yet.")
                  : t("MatchA funciona mejor con la ubicación activada.", "MatchA works better with location enabled.")}
            </Text>
            <View style={styles.locationPromptActions}>
              <Pressable onPress={dismissLocationPrompt} style={({ pressed }) => [styles.locationPromptButton, styles.locationPromptButtonSecondary, isLocationPromptBusy && styles.emptyCardButtonDisabled, pressed && { opacity: 0.82 }]} disabled={isLocationPromptBusy}>
                <Text style={styles.locationPromptButtonSecondaryText}>{t("Cerrar", "Close")}</Text>
              </Pressable>
              <Pressable
                onPress={() => { void (async () => { const outcome = await retryLocationPromptFlow("prompt_button"); if (!outcome.recovered && outcome.shouldOpenSettings) { pendingLocationSettingsReturnRef.current = true; await Linking.openSettings().catch(() => {}); } else { pendingLocationSettingsReturnRef.current = false; } })(); }}
                style={({ pressed }) => [styles.locationPromptButton, styles.locationPromptButtonPrimary, isLocationPromptBusy && styles.emptyCardButtonDisabled, pressed && { opacity: 0.82 }]}
                disabled={isLocationPromptBusy}
              >
                {isLocationPromptBusy
                  ? <ActivityIndicator size="small" color={Colors.ivory} />
                  : <Text style={styles.locationPromptButtonPrimaryText}>{t("Activar", "Enable")}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter modal */}
      <Modal visible={isFilterVisible} transparent animationType="fade" onRequestClose={closeFilters}>
        <View style={styles.filterModalRoot}>
          <Pressable style={styles.filterBackdrop} onPress={closeFilters} />
          <KeyboardSheet style={styles.filterKeyboardSheet} contentStyle={styles.filterKeyboardContent} keyboardVerticalOffset={topPad + 6} bottomInset={0}>
            <View style={[styles.filterSheet, { top: topPad + 6, width: Math.min(width - 32, 340), maxHeight: height - topPad - filterBottomObstruction - 24 }]}>
              <View style={styles.filterSheetHeader}>
                <View>
                  <Text style={styles.filterSheetTitle}>{t("Filtros", "Filters")}</Text>
                  <Text style={styles.filterSheetSub}>{t("Ajusta interés y rango de edad", "Adjust interest and age range")}</Text>
                </View>
                <Pressable onPress={closeFilters} style={({ pressed }) => [styles.filterCloseBtn, pressed && { opacity: 0.7 }]}>
                  <Feather name="x" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={styles.filterSheetBody} contentContainerStyle={styles.filterSheetBodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>{t("Interés", "Interest")}</Text>
                  <View style={styles.filterCheckboxGroup}>
                    {baseGenderOptions.map((opt) => <FilterCheckboxRow key={opt.value} label={opt.label} selected={draftFilters.selectedGenders.includes(opt.value)} onPress={() => toggleBaseGender(opt.value)} />)}
                  </View>
                  <View style={styles.filterTherianGroup}>
                    <FilterCheckboxRow label={t("Incluir Therians", "Include Therians")} selected={draftFilters.therianMode === "include"} onPress={() => toggleTherianMode("include")} compact />
                    <FilterCheckboxRow label={t("Solo Therians", "Only Therians")} selected={draftFilters.therianMode === "only"} onPress={() => toggleTherianMode("only")} compact />
                  </View>
                </View>
                <AgeRangeFields bounds={ageBounds} valueMin={draftFilters.ageMin} valueMax={draftFilters.ageMax} onChange={(ageMin, ageMax) => setDraftFilters((cur) => ({ ...cur, ageMin, ageMax }))} t={t} />
              </ScrollView>
              <View style={styles.filterFooter}>
                <Pressable onPress={clearFilters} disabled={isOffline} style={({ pressed }) => [styles.filterFooterBtn, styles.filterFooterBtnSecondary, isOffline && styles.emptyCardButtonDisabled, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.filterFooterBtnSecondaryText}>{t("Limpiar", "Clear")}</Text>
                </Pressable>
                <Pressable onPress={applyFilters} disabled={!canApplyFilters || isOffline} style={({ pressed }) => [styles.filterFooterBtn, canApplyFilters && !isOffline ? styles.filterFooterBtnPrimary : styles.filterFooterBtnPrimaryDisabled, pressed && canApplyFilters && !isOffline && { opacity: 0.84 }]}>
                  <Text style={[styles.filterFooterBtnPrimaryText, (!canApplyFilters || isOffline) && styles.filterFooterBtnPrimaryTextDisabled]}>{t("Aplicar", "Apply")}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardSheet>
        </View>
      </Modal>

      {/* Insight modal */}
      <Modal visible={showInsight} transparent animationType="fade" onRequestClose={() => dismissInsightSheet(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => dismissInsightSheet()} />
          <Animated.View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 18, 36), transform: [{ translateY: insightSheetTranslateY }] }]}>
            <View style={styles.modalDragHeader} {...insightSheetPanResponder.panHandlers}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}><Feather name="zap" size={22} color={Colors.primaryLight} /></View>
                <Text style={styles.modalTitle}>{t("Insight de mejora", "Improvement Insight")}</Text>
                <Text style={styles.modalSub}>{t(`Basado en ${lastLikedProfile?.name ?? ""}, estas metas pueden aumentar tu atractivo`, `Based on ${lastLikedProfile?.name ?? ""}, these goals may boost your appeal`)}</Text>
              </View>
            </View>
            <ScrollView style={styles.insightScroll} contentContainerStyle={styles.insightScrollContent} showsVerticalScrollIndicator={false}>
              {relatedGoals.map((item: any, index: number) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightItemLeft}>
                    <Feather name="target" size={16} color={Colors.primaryLight} />
                    <View style={styles.insightItemContent}>
                      <Text style={styles.insightGoalTitle}>{t(item.goal.titleEs, item.goal.titleEn)}</Text>
                      <Text style={styles.insightReason}>{t(item.reason.es, item.reason.en)}</Text>
                    </View>
                  </View>
                  <View style={styles.insightProgress}><Text style={styles.insightProgressText}>{item.goal.progress}%</Text></View>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => dismissInsightSheet()} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>{t("Continuar explorando", "Keep exploring")}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle:  { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.text, letterSpacing: -0.8 },
  headerSub:    { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },

  filterBtn:       { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  filterBtnActive: { borderColor: Colors.like, backgroundColor: "rgba(82, 183, 136, 0.16)" },

  cardStack: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cardBase:  { borderRadius: 20, overflow: "hidden", position: "absolute", backgroundColor: Colors.backgroundCard },

  cardFrontShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },

  cardThirdBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.backgroundCard },
  cardSlotHidden:    { opacity: 0 },

  cardFace:      { ...StyleSheet.absoluteFillObject, backfaceVisibility: IS_WEB ? "visible" : "hidden" },
  cardFaceFront: { backgroundColor: Colors.backgroundCard },
  cardFaceBack:  { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border },

  cardImage: { width: "100%", height: "100%", position: "absolute" },

  photoTapLayer: { ...StyleSheet.absoluteFillObject, zIndex: 4, flexDirection: "row" },
  photoTapZone:  { flex: 1 },

  likeOverlay:    { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  dislikeOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  stampContainer: { position: "absolute", top: 40, left: 0, right: 0, alignItems: "center" },
  likeStamp:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.like,    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  dislikeStamp: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.dislike, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  stampText:    { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", letterSpacing: 1 },

  cardGradient: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 86, zIndex: 3 },
  cardName:     { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text, letterSpacing: -0.5 },
  cardIdentity: { marginTop: 3, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.ivoryDim },
  cardPronouns: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.ivoryDim, marginBottom: 4 },
  cardAgeSign:  { marginTop: 4, fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.primaryLight },
  cardRow:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  cardLocation:  { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  cardDot:       { color: Colors.textMuted, fontSize: 13 },
  cardOccupation:{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },

  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  interestChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(82,183,136,0.2)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(82,183,136,0.35)" },
  interestChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primaryLight },

  photoDotsRow:   { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 },
  photoDot:       { width: 7, height: 7, borderRadius: 999, backgroundColor: "rgba(245,243,238,0.28)" },
  photoDotActive: { width: 18, backgroundColor: Colors.text },

  backHeader:   { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backInfoBadge:{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.infoOverlay, borderWidth: 1, borderColor: "rgba(90,169,255,0.35)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  backName:     { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text, letterSpacing: -0.4 },
  backMeta:     { marginTop: 4, fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  backScroll:   { flex: 1 },
  backScrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 20 },
  backSection:      { gap: 12 },
  backSectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, letterSpacing: -0.3 },

  infoRow:       { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoRowIconWrap:{ width: 34, height: 34, borderRadius: 12, backgroundColor: Colors.infoOverlay, borderWidth: 1, borderColor: "rgba(90,169,255,0.35)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  infoRowBody:   { flex: 1, gap: 2 },
  infoRowLabel:  { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  infoRowValue:  { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, lineHeight: 20 },

  flagImageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 2 },
  flagImage:    { width: 26, height: 18, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderLight, backgroundColor: Colors.backgroundElevated },
  flagFallback: { width: 26, height: 18, borderRadius: 4, backgroundColor: Colors.infoOverlay, borderWidth: 1, borderColor: "rgba(90,169,255,0.28)", alignItems: "center", justifyContent: "center" },

  lifestyleGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  lifestyleTile:    { width: "31%", minHeight: 118, borderRadius: 16, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 12, alignItems: "center", justifyContent: "flex-start" },
  lifestyleIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.infoOverlay, borderWidth: 1, borderColor: "rgba(90,169,255,0.35)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  lifestyleTileLabel:{ fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center", marginBottom: 6 },
  lifestyleTileValue:{ fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text, textAlign: "center", lineHeight: 17 },

  physicalRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  physicalIconWrap:{ width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(82,183,136,0.12)", borderWidth: 1, borderColor: "rgba(82,183,136,0.28)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  physicalBody:   { flex: 1, gap: 2 },

  actions:    { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20, paddingTop: 16, paddingHorizontal: 20 },
  actionBtn:  { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  dislikeBtn: { backgroundColor: Colors.backgroundCard, borderColor: Colors.dislike },
  likeBtn:    { backgroundColor: Colors.backgroundCard, borderColor: Colors.like },
  actionBtnSm:{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.backgroundCard, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  infoBtn:    { borderColor: "rgba(90,169,255,0.38)", backgroundColor: Colors.infoOverlay },
  infoBtnActive:{ borderColor: Colors.info, backgroundColor: "rgba(90,169,255,0.24)" },

  emptyCard:        { position: "relative", paddingHorizontal: 28, paddingVertical: 34, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  emptyCardIconWrap:{ width: 58, height: 58, borderRadius: 20, backgroundColor: Colors.infoOverlay, borderWidth: 1, borderColor: "rgba(90,169,255,0.35)", alignItems: "center", justifyContent: "center" },
  emptyCardTitle:   { marginTop: 18, fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text, textAlign: "center", letterSpacing: -0.5 },
  emptyCardCopy:    { marginTop: 8, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  emptyCardButton:  { marginTop: 22, minHeight: 46, paddingHorizontal: 18, borderRadius: 16, backgroundColor: Colors.info, alignItems: "center", justifyContent: "center" },
  emptyCardActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 22 },
  emptyCardButtonInline:   { flex: 1, marginTop: 0 },
  emptyCardButtonText:     { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  emptyCardButtonSecondary:{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  emptyCardButtonTextSecondary: { color: Colors.text },
  emptyCardButtonDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  emptyCardButtonTextDisabled:  { color: Colors.textMuted },

  locationPromptOverlay: { flex: 1, backgroundColor: "rgba(5,10,8,0.56)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  locationPromptCard:    { width: "100%", maxWidth: 360, borderRadius: 24, padding: 22, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  locationPromptIcon:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(82,183,136,0.14)", borderWidth: 1, borderColor: "rgba(82,183,136,0.28)" },
  locationPromptTitle:   { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, letterSpacing: -0.4 },
  locationPromptCopy:    { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  locationPromptActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  locationPromptButton:  { flex: 1, minHeight: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  locationPromptButtonPrimary:        { backgroundColor: Colors.like },
  locationPromptButtonSecondary:      { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  locationPromptButtonPrimaryText:    { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  locationPromptButtonSecondaryText:  { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },

  filterModalRoot:    { flex: 1 },
  filterKeyboardSheet:{ ...StyleSheet.absoluteFillObject },
  filterKeyboardContent: { flex: 1 },
  filterBackdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,10,8,0.48)" },
  filterSheet:        { position: "absolute", right: 16, borderRadius: 24, padding: 18, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 18, gap: 16 },
  filterSheetHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  filterSheetBody:    { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  filterSheetBodyContent: { gap: 16, paddingBottom: 8 },
  filterSheetTitle:   { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, letterSpacing: -0.4 },
  filterSheetSub:     { marginTop: 4, fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  filterCloseBtn:     { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterField:        { gap: 8 },
  filterLabel:        { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.7 },
  filterCheckboxGroup:{ gap: 10 },
  filterTherianGroup: { flexDirection: "row", alignItems: "stretch", gap: 8, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  filterCheckboxRow:  { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  filterCheckboxRowSelected: { borderColor: Colors.like, backgroundColor: "rgba(82, 183, 136, 0.16)" },
  filterCheckboxRowCompact:  { flex: 1, minHeight: 44, paddingHorizontal: 12, gap: 8 },
  filterCheckboxBox:  { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  filterCheckboxBoxSelected: { borderColor: Colors.like, backgroundColor: Colors.like },
  filterCheckboxBoxCompact:  { width: 18, height: 18, borderRadius: 5 },
  filterCheckboxLabel:{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  filterCheckboxLabelCompact:  { fontSize: 12, lineHeight: 16 },
  filterCheckboxLabelSelected: { color: Colors.primaryLight },
  filterFooter:       { flexDirection: "row", gap: 10, marginTop: 4 },
  filterFooterBtn:    { flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  filterFooterBtnSecondary:       { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterFooterBtnPrimary:         { backgroundColor: Colors.like },
  filterFooterBtnPrimaryDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterFooterBtnSecondaryText:   { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  filterFooterBtnPrimaryText:     { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  filterFooterBtnPrimaryTextDisabled: { color: Colors.textMuted },

  ageNumberRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ageNumberField: { flex: 1, gap: 6 },
  ageNumberLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary },
  ageNumberInput: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: 14, fontFamily: "Inter_500Medium", fontSize: 16, color: Colors.text },
  ageRangeHint:   { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textMuted },

  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet:      { width: "100%", backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.border, alignSelf: "stretch" },
  modalDragHeader: { alignItems: "center", width: "100%", paddingTop: 2, paddingBottom: 6 },
  modalHandle:     { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader:     { alignItems: "center", gap: 8, marginBottom: 18, width: "100%" },
  modalIconWrap:   { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(82,183,136,0.15)", borderWidth: 1, borderColor: "rgba(82,183,136,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalTitle:      { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, letterSpacing: -0.5, textAlign: "center" },
  modalSub:        { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 18, maxWidth: 300 },
  insightScroll:        { maxHeight: 280 },
  insightScrollContent: { paddingBottom: 6 },
  insightItem:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  insightItemLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  insightItemContent: { flex: 1, alignSelf: "stretch" },
  insightGoalTitle:{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, marginBottom: 2 },
  insightReason:   { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  insightProgress: { backgroundColor: Colors.backgroundElevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  insightProgressText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.primaryLight },
  modalClose:      { marginTop: 20, backgroundColor: Colors.primaryLight, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  modalCloseText:  { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textInverted },
});
