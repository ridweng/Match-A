import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Keyboard, Platform, type AppStateStatus } from "react-native";

import {
  acknowledgeGoalsUnlockSeen as acknowledgeGoalsUnlockSeenRequest,
  type AuthSessionResponse,
  type AuthCallbackPayload,
  type AuthUser,
  type DiscoveryFilters,
  type DiscoveryFeedResponse,
  type DiscoveryFeedProfileResponse,
  type DiscoveryLikeResponse,
  type DiscoveryPreferencesResponse,
  type OnboardingState,
  type ServerHealthCheckResult,
  type ViewerBootstrapResponse,
  type ProviderAvailability,
  type AuthProvider,
  checkServerHealth,
  checkVerificationStatus as authCheckVerificationStatus,
  completeGoal as completeGoalRequest,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_DISCOVERY_FILTERS,
  deleteAccount as deleteAccountRequest,
  deleteProfilePhoto as deleteProfilePhotoRequest,
  exchangeSocialHandoffCode,
  fetchProviderAvailability,
  getNextDiscoveryFeedWindow,
  getViewerBootstrap,
  isInvalidRefreshError,
  likeDiscoveryProfile,
  passDiscoveryProfile,
  refreshDiscoveryFeed,
  resetDiscoveryHistory as resetDiscoveryHistoryRequest,
  completeOnboarding as completeOnboardingRequest,
  mergeRemotePhotosWithLocal,
  reorderGoals as reorderGoalsRequest,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getMe,
  updateViewerProfile,
  updateMe,
  updateSettings,
  refreshSession,
  resendVerificationEmail as authResendVerificationEmail,
  signInWithProvider as authSignInWithProvider,
  toReadableAuthError,
  updateDiscoveryPreferences,
  uploadProfilePhoto as uploadProfilePhotoRequest,
  ApiError,
} from "@/services/auth";
import {
  deleteStoredProfilePhoto,
  ensureLocalProfilePhoto,
  getProfilePhotoBySortOrder,
  isStoredProfilePhoto,
  normalizeStoredProfilePhotos,
  type UserProfilePhoto,
} from "@/utils/profilePhotos";
import { normalizeIsoDateString } from "@/utils/dateOfBirth";
import {
  ATOMIC_PROFILE_FIELD_GROUPS,
  DEBOUNCED_PROFILE_FIELDS,
  EMPTY_CANONICAL_PROFILE,
  mapApiProfileToCanonicalProfile,
  mapCanonicalProfileToProfilePatch,
  normalizeCanonicalProfileField,
  PROFILE_FIELD_OWNERSHIP,
  reconcileCanonicalProfileFields,
  type AtomicProfileFieldGroup,
  type CanonicalProfile,
  type ProfileEditableField,
  type ProfileFieldSaveState,
} from "@/utils/profileCanonical";
import {
  createEmptyPopularAttributesByCategory,
  type PopularAttributeCategory,
  type PopularAttributeSnapshot,
} from "@/utils/popularAttributes";
import {
  clearMutationQueueForUser,
  enqueueMutation,
  getReplayableMutationsForUser,
  removeCompletedMutationsForUser,
  updateMutationQueueItem,
  type MutationQueueItem,
  type MutationQueueStatus,
} from "@/utils/mutationQueue";
import {
  debugDiscoveryLog,
  debugDiscoveryWarn,
  debugLog,
  debugWarn,
} from "@/utils/debug";
import { analytics, analyticsHeartbeatIntervalSeconds } from "@/utils/analytics";
import {
  applyDecisionToQueue,
  assertDiscoveryQueueInvariants,
  discoveryIdsEqual,
  getDiscoveryQueueIds,
  normalizeDiscoveryProfileId,
} from "@/utils/discoveryQueue";

export type { AuthUser };
export type { ProfileEditableField, ProfileFieldSaveState };

export type GoalCategory =
  | "physical"
  | "personality"
  | "family"
  | "expectations"
  | "language"
  | "studies";

export type Goal = {
  id: string;
  titleEs: string;
  titleEn: string;
  category: GoalCategory;
  order: number;
  completed: boolean;
  progress: number;
  nextActionEs: string;
  nextActionEn: string;
  impactEs: string;
  impactEn: string;
};

export type UserProfile = CanonicalProfile;

export type AccountProfile = UserProfile & {
  email: string;
};

export type HeightUnit = "metric" | "imperial";

type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "verification_pending";
type VerificationStatus = "idle" | "pending" | "checking" | "verified";
type AuthFormPrefill = {
  email: string;
  mode: "signin" | "signup";
};
type PendingPostLoginRoute = "onboarding";
type PostAuthRedirectRoute =
  | "/complete-profile"
  | "/onboarding"
  | "/(tabs)/discover";
type LocationSyncResultStatus =
  | "web"
  | "no_session"
  | "skipped_recent_sync"
  | "services_disabled"
  | "permission_denied"
  | "reverse_geocode_empty"
  | "normalized_location_empty"
  | "updated"
  | "failed";
type LocationSyncResult = {
  status: LocationSyncResultStatus;
  reason: string;
  userId: number | null;
  requestId?: string | null;
  nextLocation?: string | null;
  canAskAgain?: boolean;
  code?: string | null;
  message?: string | null;
};
type ServerHealthStatus = "unknown" | "checking" | "healthy" | "unhealthy";
type OnboardingAccessState = "unknown" | "incomplete" | "complete";
type AccessTruthSource = "backend_confirmed" | "offline_safe_cache" | "unknown_fallback";
type ResolvedAccessGate = {
  authState: "authenticated" | "unauthenticated";
  onboardingState: OnboardingAccessState;
  needsProfileCompletion: boolean;
  canEnterDiscover: boolean;
  route: "/login" | "/complete-profile" | "/onboarding" | "/(tabs)/discover";
  reason: string;
  source: AccessTruthSource | null;
};

type BiometricResult = { ok: boolean; code?: string };
type AccessGateState =
  | "booting"
  | "unauthenticated"
  | "authenticated_locked"
  | "unlocking"
  | "authenticated_unlocked"
  | "signing_out";
type LockTrigger = "cold_start" | "resume_from_background" | "manual_relock" | null;
type LockScreenPresence = {
  mounted: boolean;
  focused: boolean;
};
type DiscoveryViewPreferences = {
  selectedTab: "discover" | "filters";
  cardDensity: "comfortable" | "compact";
  reduceMotion: boolean;
};

const MIN_LOCK_INTERRUPTION_MS = 1500;
const PROMPT_REENTRY_COOLDOWN_MS = 1000;
const DISCOVERY_DECISION_QUEUE_VERSION_REQUIRED = false;
const SERVER_HEALTH_POLL_INTERVAL_MS = 15_000;
const SERVER_HEALTH_TIMEOUT_MS = 10_000;

const GOAL_CATEGORIES: GoalCategory[] = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

const DEFAULT_GOALS: Goal[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "physical",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Corre 20 min hoy sin parar",
    nextActionEn: "Run 20 min today without stopping",
    impactEs: "Más energía y mejor postura",
    impactEn: "More energy and better posture",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "personality",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Inicia una conversación con un extraño",
    nextActionEn: "Start a conversation with a stranger",
    impactEs: "Más atractivo en interacciones sociales",
    impactEn: "More attractive in social interactions",
  },
  {
    id: "3",
    titleEs: "Cuidado personal consistente",
    titleEn: "Consistent grooming routine",
    category: "physical",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Mantén un ritual simple de autocuidado esta semana",
    nextActionEn: "Keep a simple self-care ritual this week",
    impactEs: "Refuerza tu presencia y seguridad personal",
    impactEn: "Reinforces your presence and self-confidence",
  },
  {
    id: "4",
    titleEs: "Inteligencia emocional",
    titleEn: "Emotional intelligence",
    category: "personality",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Escucha activa en tu próxima conversación",
    nextActionEn: "Active listening in your next conversation",
    impactEs: "Conexiones más profundas y auténticas",
    impactEn: "Deeper and more authentic connections",
  },
  {
    id: "5",
    titleEs: "Postura corporal",
    titleEn: "Body posture",
    category: "physical",
    order: 1,
    completed: true,
    progress: 0,
    nextActionEs: "10 min de ejercicios de postura ahora",
    nextActionEn: "10 min posture exercises right now",
    impactEs: "Proyectas más confianza y presencia",
    impactEn: "Project more confidence and presence",
  },
  {
    id: "6",
    titleEs: "Habilidades de conversación",
    titleEn: "Conversation skills",
    category: "language",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Aprende 3 preguntas abiertas interesantes",
    nextActionEn: "Learn 3 interesting open-ended questions",
    impactEs: "Conversaciones más atractivas y fluidas",
    impactEn: "More engaging and fluid conversations",
  },
  {
    id: "7",
    titleEs: "Límites personales claros",
    titleEn: "Clear personal boundaries",
    category: "personality",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Define una situación donde quieras responder con más calma",
    nextActionEn: "Define one situation where you want to respond more calmly",
    impactEs: "Te ayuda a sentir más control y coherencia",
    impactEn: "Helps you feel more in control and aligned",
  },
  {
    id: "8",
    titleEs: "Visión familiar clara",
    titleEn: "Clear family vision",
    category: "family",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Escribe qué significa familia para ti hoy",
    nextActionEn: "Write down what family means to you today",
    impactEs: "Aclara tus prioridades a largo plazo",
    impactEn: "Clarifies your long-term priorities",
  },
  {
    id: "9",
    titleEs: "Conversación sobre hijxs",
    titleEn: "Children conversation",
    category: "family",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Prepara cómo hablarías de este tema con honestidad",
    nextActionEn: "Prepare how you would talk about this topic honestly",
    impactEs: "Reduce fricciones futuras y alinea expectativas",
    impactEn: "Reduces future friction and aligns expectations",
  },
  {
    id: "10",
    titleEs: "Ritmo de estabilidad",
    titleEn: "Pace of stability",
    category: "family",
    order: 2,
    completed: false,
    progress: 0,
    nextActionEs: "Piensa qué tipo de rutina compartida te hace sentir en paz",
    nextActionEn: "Think about what kind of shared routine gives you peace",
    impactEs: "Te acerca a vínculos más sostenibles",
    impactEn: "Moves you toward more sustainable bonds",
  },
  {
    id: "11",
    titleEs: "Claridad romántica",
    titleEn: "Relationship clarity",
    category: "expectations",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Resume en una frase lo que buscas construir",
    nextActionEn: "Summarize in one sentence what you want to build",
    impactEs: "Hace tu intención más visible y coherente",
    impactEn: "Makes your intention more visible and consistent",
  },
  {
    id: "12",
    titleEs: "No negociables sanos",
    titleEn: "Healthy non-negotiables",
    category: "expectations",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Anota los tres valores que no quieres comprometer",
    nextActionEn: "Write down the three values you do not want to compromise",
    impactEs: "Refuerza decisiones más conscientes",
    impactEn: "Supports more intentional decisions",
  },
  {
    id: "13",
    titleEs: "Ritmo consciente",
    titleEn: "Intentional pacing",
    category: "expectations",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Define el ritmo que se siente sano para ti al conocer a alguien",
    nextActionEn: "Define the pace that feels healthy for you when meeting someone",
    impactEs: "Genera más control emocional y claridad",
    impactEn: "Creates more emotional control and clarity",
  },
  {
    id: "14",
    titleEs: "Presentación natural",
    titleEn: "Natural self-introduction",
    category: "language",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Practica una introducción breve que suene auténtica",
    nextActionEn: "Practice a short introduction that sounds authentic",
    impactEs: "Te hace sonar más seguro desde el inicio",
    impactEn: "Makes you sound more confident from the start",
  },
  {
    id: "15",
    titleEs: "Escucha activa verbal",
    titleEn: "Verbal active listening",
    category: "language",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Prueba una frase de validación en tu próxima charla",
    nextActionEn: "Try one validation phrase in your next conversation",
    impactEs: "Aumenta conexión y reciprocidad",
    impactEn: "Improves connection and reciprocity",
  },
  {
    id: "16",
    titleEs: "Historia profesional clara",
    titleEn: "Clear learning story",
    category: "studies",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Resume tu recorrido de estudio o aprendizaje en dos líneas",
    nextActionEn: "Summarize your study or learning path in two lines",
    impactEs: "Hace tu perfil más nítido y memorable",
    impactEn: "Makes your profile sharper and more memorable",
  },
  {
    id: "17",
    titleEs: "Plan de crecimiento",
    titleEn: "Growth plan",
    category: "studies",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Elige una habilidad que quieras reforzar este mes",
    nextActionEn: "Choose one skill you want to strengthen this month",
    impactEs: "Transmite ambición tranquila y dirección",
    impactEn: "Signals calm ambition and direction",
  },
  {
    id: "18",
    titleEs: "Mostrar tu especialidad",
    titleEn: "Show your expertise",
    category: "studies",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Piensa cómo explicarías tu fortaleza principal con claridad",
    nextActionEn: "Think about how you would explain your main strength clearly",
    impactEs: "Te ayuda a destacar con naturalidad",
    impactEn: "Helps you stand out naturally",
  },
];

const DEFAULT_PROFILE: UserProfile = EMPTY_CANONICAL_PROFILE;
const DEFAULT_DISCOVERY_VIEW_PREFERENCES: DiscoveryViewPreferences = {
  selectedTab: "discover",
  cardDensity: "comfortable",
  reduceMotion: false,
};

function normalizeStoredProfile(input: Partial<UserProfile> | null | undefined): UserProfile {
  return mapApiProfileToCanonicalProfile(input);
}

function recalculateGoalProgress(goals: Goal[]): Goal[] {
  const progressByCategory = new Map<GoalCategory, number>();

  GOAL_CATEGORIES.forEach((category) => {
    const categoryGoals = goals.filter((goal) => goal.category === category);
    const completedCount = categoryGoals.filter((goal) => goal.completed).length;
    const progress = categoryGoals.length
      ? Math.round((completedCount / categoryGoals.length) * 100)
      : 0;
    progressByCategory.set(category, progress);
  });

  return goals.map((goal) => ({
    ...goal,
    progress: progressByCategory.get(goal.category) || 0,
  }));
}

function normalizeStoredGoals(input: Partial<Goal>[] | null | undefined): Goal[] {
  const savedGoals = Array.isArray(input) ? input : [];

  const looksCanonical =
    savedGoals.length > 0 &&
    savedGoals.every(
      (goal) =>
        typeof goal?.id === "string" &&
        typeof goal?.titleEs === "string" &&
        typeof goal?.titleEn === "string" &&
        typeof goal?.category === "string" &&
        typeof goal?.nextActionEs === "string" &&
        typeof goal?.nextActionEn === "string" &&
        typeof goal?.impactEs === "string" &&
        typeof goal?.impactEn === "string"
    );

  if (looksCanonical) {
    const ordered = GOAL_CATEGORIES.flatMap((category) =>
      savedGoals
        .filter((goal): goal is Goal => goal.category === category)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((goal, index) => ({
          ...goal,
          order: index,
          completed: Boolean(goal.completed),
        }))
    );

    return recalculateGoalProgress(ordered);
  }

  const savedGoalsById = new Map(
    savedGoals.map((goal) => [String(goal.id), goal] as const)
  );

  const merged = DEFAULT_GOALS.map((goal) => {
    const saved = savedGoalsById.get(goal.id);
    return {
      ...goal,
      order: typeof saved?.order === "number" ? saved.order : goal.order,
      completed:
        typeof saved?.completed === "boolean" ? saved.completed : goal.completed,
    };
  });

  const ordered = GOAL_CATEGORIES.flatMap((category) =>
    merged
      .filter((goal) => goal.category === category)
      .sort((a, b) => a.order - b.order)
      .map((goal, index) => ({
        ...goal,
        order: index,
      }))
  );

  return recalculateGoalProgress(ordered);
}

type AppContextType = {
  authStatus: AuthStatus;
  postAuthRedirectRoute: PostAuthRedirectRoute | null;
  clearPostAuthRedirectRoute: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<boolean>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    dateOfBirth: string;
  }) => Promise<boolean>;
  signInWithProvider: (
    provider: AuthProvider,
    mode: "signin" | "signup"
  ) => Promise<boolean>;
  user: AuthUser | null;
  authBusy: boolean;
  authError: string | null;
  hasAccessToken: boolean;
  isOnline: boolean;
  serverHealthStatus: ServerHealthStatus;
  lastServerHealthAt: string | null;
  lastServerHealthFailureReason: string | null;
  authFormPrefill: AuthFormPrefill | null;
  pendingVerificationEmail: string | null;
  verificationStatus: VerificationStatus;
  checkPendingVerificationStatus: () => Promise<"pending" | "verified" | null>;
  resendPendingVerificationEmail: () => Promise<boolean>;
  resetPendingVerificationState: () => void;
  handleAuthCallback: (payload: AuthCallbackPayload) => Promise<boolean>;
  clearAuthFeedback: () => void;
  providerAvailability: ProviderAvailability;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
  onboardingAccessState: OnboardingAccessState;
  resolvedAccessGate: ResolvedAccessGate;
  completeProfile: (data: { name: string; dateOfBirth: string }) => Promise<boolean>;
  onboardingResumeStep: number;
  setOnboardingResumeStep: (step: number) => Promise<void>;
  saveOnboardingDraft: (
    data: OnboardingDraftInput,
    options?: { step?: number; requestId?: string }
  ) => Promise<boolean>;
  finishOnboarding: (data: OnboardingDraftInput) => Promise<boolean>;
  accessState: AccessGateState;
  biometricLockRequired: boolean;
  biometricBusy: boolean;
  biometricsEnabled: boolean;
  bootstrapComplete: boolean;
  appReadyForBiometric: boolean;
  lockCycleId: number;
  deferredReplayPending: boolean;
  lastLockTrigger: LockTrigger;
  lastBiometricErrorCode: string | null;
  beginBiometricUnlock: (trigger?: LockTrigger) => Promise<BiometricResult>;
  setLockScreenPresence: (presence: LockScreenPresence) => void;
  forceLogoutForBiometricPolicy: (reason: string) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => Promise<BiometricResult>;
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => void;
  heightUnit: HeightUnit;
  setHeightUnit: (unit: HeightUnit) => void;
  saveSettings: (input: {
    name: string;
    dateOfBirth: string;
    profession: string;
    genderIdentity: string;
    pronouns: string;
    personality: string;
    language: "es" | "en";
    heightUnit: HeightUnit;
  }) => Promise<boolean>;
  settingsSaveState: ProfileFieldSaveState;
  deleteAccount: () => Promise<boolean>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  completeGoalTask: (id: string) => void;
  reorderGoalTasks: (
    category: GoalCategory,
    fromIndex: number,
    toIndex: number
  ) => void;
  sessionSwipeCounts: {
    likes: number;
    dislikes: number;
  };
  lifetimeDiscoveryCounts: {
    likes: number;
    passes: number;
  };
  discoveryThreshold: DiscoveryThresholdState;
  goalsUnlockState: GoalsUnlockState;
  goalsUnlockPromptVisible: boolean;
  recordDiscoverySwipe: (
    direction: "left" | "right",
    options?: { requestId?: string; targetProfileId?: number }
  ) => void;
  dismissGoalsUnlockPrompt: () => Promise<boolean>;
  popularAttributesByCategory: Record<
    PopularAttributeCategory,
    PopularAttributeSnapshot
  >;
  totalLikesCount: number;
  likedProfiles: number[];
  passedProfiles: number[];
  discoveryFeed: DiscoveryFeedResponse;
  discoveryQueueRuntime: DiscoveryQueueRuntime;
  discoveryFilters: DiscoveryFilters;
  discoveryViewPreferences: DiscoveryViewPreferences;
  lastServerSyncAt: string | null;
  sessionOfflineFallback: boolean;
  saveDiscoveryFilters: (filters: DiscoveryFilters) => Promise<boolean>;
  setDiscoveryViewPreferences: (
    updates: Partial<DiscoveryViewPreferences>
  ) => Promise<void>;
  likeProfile: (
    profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">,
    options?: DiscoveryDecisionOptions
  ) => Promise<DiscoveryLikeResponse | null>;
  passProfile: (
    profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">,
    options?: DiscoveryDecisionOptions
  ) => Promise<DiscoveryLikeResponse | null>;
  refreshDiscoveryCandidates: () => Promise<boolean>;
  fetchNextDiscoveryWindow: () => Promise<boolean>;
  resetDiscoveryHistory: () => Promise<boolean>;
  armDiscoveryCursorStaleSimulation: () => void;
  trackAnalyticsEvent: (
    eventName: string,
    payload?: {
      screenName?: string | null;
      areaName?: string | null;
      durationMs?: number | null;
      targetProfilePublicId?: string | null;
      targetProfileKind?: "user" | "dummy" | "synthetic" | "unknown" | null;
      targetProfileBatchKey?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ) => void;
  recordAnalyticsScreenTime: (input: {
    screenName: string;
    areaName?: string | null;
    startedAt: string;
    durationMs: number;
    endedBy: "blur" | "background" | "logout" | "app_close" | "navigation";
  }) => void;
  recordAnalyticsProfileCardTime: (input: {
    targetProfilePublicId: string;
    shownAt: string;
    visibleDurationMs: number;
    decision: "like" | "pass" | "none";
    openedInfo?: boolean;
    photosViewed?: number;
  }) => void;
  recordDiscoveryQueueTrace: (
    payload: Omit<DiscoveryQueueTraceLog, "actorId" | "traceSeq">
  ) => DiscoveryQueueTraceLog;
  profile: UserProfile;
  accountProfile: AccountProfile;
  profileSaveStates: Partial<Record<ProfileEditableField, ProfileFieldSaveState>>;
  saveProfileChanges: (
    patch: Partial<Omit<UserProfile, "age" | "photos">>
  ) => Promise<boolean>;
  updateProfileField: <K extends ProfileEditableField>(
    field: K,
    value: UserProfile[K]
  ) => void;
  setProfilePhoto: (index: number, uri: string) => Promise<UserProfilePhoto | null>;
  removeProfilePhoto: (index: number) => Promise<void>;
  refreshProfileLocation: (options?: {
    reason?: string;
    force?: boolean;
    requestId?: string;
  }) => Promise<LocationSyncResult>;
};

const AppContext = createContext<AppContextType | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const DISCOVERY_FILTERS_STORAGE_KEY = "discoveryFiltersByUser";
const DISCOVERY_VIEW_PREFERENCES_STORAGE_KEY = "discoveryViewPreferences";
const DISCOVERY_FEED_PAGE_STORAGE_PREFIX = "discoveryFeedPage:";
const LAST_AUTH_USER_ID_STORAGE_KEY = "lastAuthUserId";
const VIEWER_BOOTSTRAP_STORAGE_PREFIX = "viewerBootstrap:";
const ONBOARDING_GATE_STORAGE_PREFIX = "onboardingGate:";
const PENDING_POST_LOGIN_ROUTE_STORAGE_KEY = "pendingPostLoginRoute";
const ONBOARDING_RESUME_DRAFT_STORAGE_KEY = "onboardingResumeDraft";
const DISCOVERY_LOCATION_SYNC_STORAGE_PREFIX = "discoveryLocationSync:";
const DISCOVERY_QUEUE_TRACE_BUFFER_LIMIT = 50;
const DISCOVERY_QUEUE_CACHE_SIZE = 3;
const DISABLE_PERSISTED_DISCOVERY_QUEUE_RESTORE = __DEV__;

function createLocationSyncRequestId(prefix = "location_sync") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type DiscoveryFiltersCache = Record<string, DiscoveryFilters>;
type ViewerBootstrapCache = ViewerBootstrapResponse;
type PersistedOnboardingGateCache = {
  userId: number;
  onboardingState: OnboardingState;
  confirmedAt: string;
};
type ViewerBootstrapMetadata = Pick<
  ViewerBootstrapCache,
  "syncedAt" | "bootstrapGeneratedAt" | "viewerVersion" | "updatedAtByDomain"
>;
type DiscoveryThresholdState = DiscoveryPreferencesResponse["threshold"];
type GoalsUnlockState = DiscoveryPreferencesResponse["goalsUnlock"];
type LifetimeDiscoveryCounts = DiscoveryPreferencesResponse["lifetimeCounts"];
type DiscoveryFeedState = DiscoveryFeedResponse;

type ProfileTargetKey = ProfileEditableField | AtomicProfileFieldGroup;
type SettingsSavePayload = {
  profileFields: readonly ProfileEditableField[];
  profilePatch: Parameters<typeof updateViewerProfile>[1];
  settingsPatch: Parameters<typeof updateSettings>[1];
  mePatch: Parameters<typeof updateMe>[1];
  completed: {
    profile: boolean;
    settings: boolean;
    account: boolean;
  };
  resolvedProfile: Pick<
    UserProfile,
    "name" | "dateOfBirth" | "profession" | "genderIdentity" | "pronouns" | "personality"
  >;
  resolvedSettings: {
    language: "es" | "en";
    heightUnit: HeightUnit;
  };
};

type ProfileFieldQueuePayload = {
  fields: readonly ProfileEditableField[];
  patch: Parameters<typeof updateViewerProfile>[1];
  revision: number;
};

type ProfilePhotoUploadPayload = {
  slot: number;
  localUri: string;
};

type ProfilePhotoDeletePayload = {
  slot: number;
  profileImageId: number | null;
  localUri: string;
};

type OnboardingDraftInput = {
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  childrenPreference: string;
  languagesSpoken: string[];
  education: string;
  physicalActivity: string;
  bodyType: string;
  photos: UserProfilePhoto[];
};

type OnboardingResumeDraft = {
  email: string | null;
  profile: UserProfile;
  step: number;
  storedAt: string;
};

type DiscoveryDecisionAction = "like" | "pass";
type DiscoveryDecisionContext = {
  requestId: string;
  action: DiscoveryDecisionAction;
  targetProfileId: number;
  expectedHeadId: number;
  visibleProfileIds: number[];
  queueVersion: number | null;
  policyVersion: string | null;
  renderedFrontId: number | null;
  tapSource?: "button" | "gesture" | null;
};
type DiscoveryDecisionOptions = {
  requestId?: string;
  renderedFrontId?: number | null;
  tapSource?: "button" | "gesture";
  decisionContext?: DiscoveryDecisionContext;
};
type DiscoveryDecisionRequester = typeof likeDiscoveryProfile;
type DiscoveryQueuedDecision = {
  action: DiscoveryDecisionAction;
  requestDecision: DiscoveryDecisionRequester;
  profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">;
  decisionContext: DiscoveryDecisionContext;
  targetProfilePublicId: string | null;
  visibleProfilePublicIds: string[];
  shouldSimulateCursorStale: boolean;
  resolve: (result: DiscoveryLikeResponse | null) => void;
};
type DiscoveryQueueStatus =
  | "idle"
  | "decision_submitting"
  | "hard_refreshing"
  | "exhausted"
  | "error";
type DiscoveryPendingDecision = {
  requestId: string;
  action: DiscoveryDecisionAction;
  targetProfileId: number;
  submittedAt: string;
  timeoutAt: string;
} | null;
type DiscoveryDecisionSnapshot = {
  totalLikesCount: number;
  lifetimeLikes: number;
  lifetimePasses: number;
  thresholdTotalLikes: number;
  thresholdTotalPasses: number;
  unlockAvailable: boolean;
  unlockPending: boolean;
};
export type DiscoveryQueueSlotPhase = "full" | "cover" | "metadata";
export type DiscoveryQueueSlotMetadata = Omit<
  DiscoveryFeedProfileResponse,
  "images"
>;
export type DiscoveryQueueSlot = {
  phase: DiscoveryQueueSlotPhase;
  id: number;
  publicId: string;
  profile: DiscoveryFeedProfileResponse;
  metadata: DiscoveryQueueSlotMetadata;
  coverImage: string | null;
  images: string[];
};

type DiscoveryQueueTraceLog = {
  event: string;
  actorId: number | null;
  requestId: string | null;
  traceSeq: number;
  queueVersion: string | number | null;
  policyVersion: string | null;
  visibleQueue: Array<string | number>;
  renderedQueue?: Array<string | number | null>;
  activeProfileId: string | number | null;
  action?: DiscoveryDecisionAction | null;
  targetProfileId?: string | number | null;
  replacementProfileId?: string | number | null;
  resultQueue?: Array<string | number>;
  decisionRejectedReason?: string | null;
  canAct?: boolean;
  source?: "window" | "decision" | "hard_refresh" | "render";
  note?: string | null;
  errorCode?: string | null;
  logicalHeadId?: string | number | null;
  renderedFrontId?: string | number | null;
  hasAccessToken?: boolean;
  isOnline?: boolean;
  isOffline?: boolean;
  isDeckAnimating?: boolean;
  hasPendingDecision?: boolean;
  authStatus?: AuthStatus | null;
  isRefreshingToken?: boolean | null;
  sessionId?: string | null;
  accessTokenAgeMs?: number | null;
  tapSource?: "button" | "gesture" | null;
  path?: string | null;
  method?: string | null;
  timeoutMs?: number | null;
  cursorPresent?: boolean;
  hasCategoryValues?: boolean;
  presentedPosition?: number | null;
};
export type DiscoveryQueueRuntime = {
  queue: {
    items: DiscoveryQueueSlot[];
    queueVersion: string | number | null;
    policyVersion: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    source: "window" | "decision" | "hard_refresh";
    generatedAt: string | null;
    invalidationReason: string | null;
  };
  status: DiscoveryQueueStatus;
  pendingDecision: DiscoveryPendingDecision;
  queuedDecisionCount: number;
  lastRequestId: string | null;
  lastDecisionRejectedReason: string | null;
  lastReplacementProfileId: number | null;
  invariantViolation: string | null;
  traceSeq: number;
  traceBuffer: DiscoveryQueueTraceLog[];
};

function getViewerBootstrapStorageKey(userId: number) {
  return `${VIEWER_BOOTSTRAP_STORAGE_PREFIX}${userId}`;
}

function getOnboardingGateStorageKey(userId: number) {
  return `${ONBOARDING_GATE_STORAGE_PREFIX}${userId}`;
}

function normalizePersistedOnboardingGateCache(
  value: unknown
): PersistedOnboardingGateCache | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PersistedOnboardingGateCache>;
  if (!Number.isFinite(candidate.userId) || candidate.userId == null) {
    return null;
  }
  if (
    candidate.onboardingState !== "complete" &&
    candidate.onboardingState !== "incomplete"
  ) {
    return null;
  }
  return {
    userId: Number(candidate.userId),
    onboardingState: candidate.onboardingState,
    confirmedAt:
      typeof candidate.confirmedAt === "string" && candidate.confirmedAt.trim().length
        ? candidate.confirmedAt
        : new Date().toISOString(),
  };
}

function createDefaultBootstrapMetadata(): ViewerBootstrapMetadata {
  const now = new Date().toISOString();
  return {
    syncedAt: now,
    bootstrapGeneratedAt: now,
    viewerVersion: "viewer-bootstrap-v1",
    updatedAtByDomain: {
      user: now,
      profile: now,
      settings: now,
      onboarding: now,
      media: now,
      goals: now,
      discovery: now,
    },
  };
}

function createEmptyLifetimeDiscoveryCounts(): LifetimeDiscoveryCounts {
  return {
    likes: 0,
    passes: 0,
  };
}

function createEmptyDiscoveryThreshold(): DiscoveryThresholdState {
  return {
    likeThreshold: 30,
    totalLikes: 0,
    totalPasses: 0,
    likesUntilUnlock: 30,
    thresholdReached: false,
    thresholdReachedAt: null,
    lastDecisionEventAt: null,
    lastDecisionInteractionId: null,
  };
}

function createEmptyGoalsUnlockState(): GoalsUnlockState {
  return {
    available: false,
    justUnlocked: false,
    unlockMessagePending: false,
    goalsUnlockEventEmittedAt: null,
    goalsUnlockMessageSeenAt: null,
  };
}

function createEmptyDiscoveryFeed(): DiscoveryFeedState {
  return {
    queueVersion: 0,
    policyVersion: "",
    generatedAt: "",
    windowSize: 0,
    reserveCount: 0,
    queueInvalidated: false,
    queueInvalidationReason: null,
    profiles: [],
    nextCursor: null,
    hasMore: false,
    supply: {
      eligibleCount: 0,
      unseenCount: 0,
      decidedCount: 0,
      exhausted: false,
      fetchedAt: "",
    },
  };
}

function normalizeDiscoveryFeed(feed: DiscoveryFeedResponse): DiscoveryFeedResponse {
  const profiles = Array.isArray(feed.profiles)
    ? feed.profiles
        .slice(0, DISCOVERY_QUEUE_CACHE_SIZE)
        .map((profile) => {
          const normalizedProfileId = normalizeDiscoveryProfileId(profile.id);
          return normalizedProfileId === null ? profile : { ...profile, id: normalizedProfileId };
        })
    : [];
  return {
    ...feed,
    profiles,
    windowSize: profiles.length,
    reserveCount: Math.min(DISCOVERY_QUEUE_CACHE_SIZE, profiles.length),
  };
}

function deriveDiscoveryQueueStatus(
  feed: DiscoveryFeedResponse,
  options?: {
    pendingDecision?: DiscoveryPendingDecision;
    queuedDecisionCount?: number;
    forceStatus?: DiscoveryQueueStatus | null;
  }
): DiscoveryQueueStatus {
  if (options?.forceStatus) {
    return options.forceStatus;
  }
  if (options?.pendingDecision || (options?.queuedDecisionCount ?? 0) > 0) {
    return "decision_submitting";
  }
  if (!feed.profiles.length && !feed.hasMore) {
    return "exhausted";
  }
  return "idle";
}

function normalizeOnboardingStep(step: number | null | undefined) {
  if (step === 2 || step === 3) {
    return step;
  }
  return 1;
}

/**
 * Check if we have a valid authoritative 3-card discovery window cached.
 * If false, the app MUST call GET /window to get authoritative data.
 * 
 * Rule: Only skip GET /window if we have at least the 3 visible deck cards cached
 * (a 4th tail entry may be present for instant promotion).
 */
export function hasValidDiscoveryWindowCache(
  queueRuntime: DiscoveryQueueRuntime
): boolean {
  const items = queueRuntime.queue.items;
  
  // Must have at least 3 cards cached (the deck is always 3 visible slots).
  // We may keep a 4th "tail" entry around for instant promotion.
  if (!Array.isArray(items) || items.length < 3) {
    return false;
  }
  
  // All *visible* items must have valid IDs and profiles
  const ids = new Set<number>();
  for (const item of items.slice(0, 3)) {
    if (!item || !item.profile || !item.id) {
      return false;
    }
    
    // Check for duplicates
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
  }
  
  return true;
}

function resolvePostAuthRedirectRoute(input: {
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
}): PostAuthRedirectRoute {
  if (input.needsProfileCompletion) {
    return "/complete-profile";
  }
  if (!input.hasCompletedOnboarding) {
    return "/onboarding";
  }
  return "/(tabs)/discover";
}

function createDiscoveryDecisionRequestId(
  action: DiscoveryDecisionAction,
  targetProfileId: number
) {
  return `discovery_${action}_${targetProfileId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeDiscoveryQueueVersion(value: number | null | undefined) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

function normalizeDiscoveryPublicId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized.length ? normalized : null;
}

function resolveVisibleProfilePublicIds(
  profiles: DiscoveryFeedProfileResponse[],
  visibleProfileIds: number[]
) {
  const publicIdByNumericId = new Map<number, string>();

  profiles.forEach((profile) => {
    const normalizedId = normalizeDiscoveryProfileId(profile.id);
    const normalizedPublicId = normalizeDiscoveryPublicId(profile.publicId);
    if (normalizedId !== null && normalizedPublicId) {
      publicIdByNumericId.set(normalizedId, normalizedPublicId);
    }
  });

  return visibleProfileIds
    .map((profileId) => publicIdByNumericId.get(profileId) ?? null)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function validateDiscoveryDecisionContext(
  context: DiscoveryDecisionContext | null | undefined,
  expectedAction: DiscoveryDecisionAction
):
  | { ok: true; value: DiscoveryDecisionContext }
  | { ok: false; note: string } {
  if (!context) {
    return { ok: false, note: "missing_snapshot" };
  }

  const requestId =
    typeof context.requestId === "string" ? context.requestId.trim() : "";
  if (!requestId) {
    return { ok: false, note: "missing_request_id" };
  }

  if (context.action !== "like" && context.action !== "pass") {
    return { ok: false, note: "invalid_action" };
  }

  if (context.action !== expectedAction) {
    return { ok: false, note: "action_mismatch" };
  }

  const targetProfileId = normalizeDiscoveryProfileId(context.targetProfileId);
  if (targetProfileId === null) {
    return { ok: false, note: "invalid_target_profile_id" };
  }

  const expectedHeadId = normalizeDiscoveryProfileId(context.expectedHeadId);
  if (expectedHeadId === null) {
    return { ok: false, note: "invalid_expected_head_id" };
  }

  if (!Array.isArray(context.visibleProfileIds) || context.visibleProfileIds.length === 0) {
    return { ok: false, note: "empty_visible_profile_ids" };
  }

  const normalizedVisibleProfileIds: number[] = [];
  for (const value of context.visibleProfileIds) {
    const normalizedVisibleProfileId = normalizeDiscoveryProfileId(value);
    if (normalizedVisibleProfileId === null) {
      return { ok: false, note: "invalid_visible_profile_id" };
    }
    normalizedVisibleProfileIds.push(normalizedVisibleProfileId);
  }

  if (normalizedVisibleProfileIds[0] !== expectedHeadId) {
    return { ok: false, note: "visible_head_mismatch" };
  }

  if (targetProfileId !== expectedHeadId) {
    return { ok: false, note: "target_head_mismatch" };
  }

  if (DISCOVERY_DECISION_QUEUE_VERSION_REQUIRED && context.queueVersion == null) {
    return { ok: false, note: "missing_queue_version" };
  }

  const queueVersion =
    context.queueVersion == null
      ? null
      : normalizeDiscoveryQueueVersion(context.queueVersion);

  if (context.queueVersion != null && queueVersion === null) {
    return { ok: false, note: "invalid_queue_version" };
  }

  return {
    ok: true,
    value: {
      requestId,
      action: expectedAction,
      targetProfileId,
      expectedHeadId,
      visibleProfileIds: normalizedVisibleProfileIds,
      queueVersion,
      policyVersion: context.policyVersion ?? null,
      renderedFrontId: normalizeDiscoveryProfileId(context.renderedFrontId),
      tapSource: context.tapSource ?? null,
    },
  };
}

function createOnboardingAttemptId() {
  return `onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildOnboardingRequestHeaders(requestId?: string) {
  if (!requestId) {
    return undefined;
  }
  return {
    "X-Matcha-Request-Id": requestId,
  };
}

function resolveCanonicalOnboardingAccessState(
  onboardingState: OnboardingState | null | undefined
): OnboardingAccessState {
  return onboardingState === "complete" ? "complete" : "incomplete";
}

function resolveAccessGate(input: {
  authStatus: AuthStatus;
  needsProfileCompletion: boolean;
  onboardingState: OnboardingAccessState;
  source: AccessTruthSource | null;
}): ResolvedAccessGate {
  if (input.authStatus !== "authenticated") {
    return {
      authState: "unauthenticated",
      onboardingState: "unknown",
      needsProfileCompletion: false,
      canEnterDiscover: false,
      route: "/login",
      reason: "unauthenticated",
      source: null,
    };
  }

  if (input.needsProfileCompletion) {
    return {
      authState: "authenticated",
      onboardingState: input.onboardingState,
      needsProfileCompletion: true,
      canEnterDiscover: false,
      route: "/complete-profile",
      reason: "backend_profile_completion_required",
      source: input.source,
    };
  }

  if (input.onboardingState === "complete") {
    return {
      authState: "authenticated",
      onboardingState: "complete",
      needsProfileCompletion: false,
      canEnterDiscover: true,
      route: "/(tabs)/discover",
      reason: "onboarding_complete",
      source: input.source,
    };
  }

  return {
    authState: "authenticated",
    onboardingState: input.onboardingState,
    needsProfileCompletion: false,
    canEnterDiscover: false,
    route: "/onboarding",
    reason:
      input.onboardingState === "unknown"
        ? "onboarding_unknown_forced_safe_fallback"
        : "onboarding_incomplete",
    source: input.source,
  };
}

function mergeOnboardingResumeProfile(
  baseProfile: UserProfile,
  resumeDraft: OnboardingResumeDraft | null
) {
  if (!resumeDraft) {
    return baseProfile;
  }

  return normalizeStoredProfile({
    ...baseProfile,
    ...resumeDraft.profile,
    photos:
      resumeDraft.profile.photos?.length > 0
        ? resumeDraft.profile.photos
        : baseProfile.photos,
  });
}

function getAuthoritativeTotalLikesCount(
  input: Pick<DiscoveryPreferencesResponse, "totalLikesCount" | "lifetimeCounts" | "threshold">
) {
  if (Number.isFinite(input.lifetimeCounts?.likes)) {
    return Number(input.lifetimeCounts.likes);
  }
  if (Number.isFinite(input.threshold?.totalLikes)) {
    return Number(input.threshold.totalLikes);
  }
  return Number(input.totalLikesCount) || 0;
}

function getDiscoveryDecisionSnapshot(
  input: Pick<
    DiscoveryPreferencesResponse,
    "totalLikesCount" | "lifetimeCounts" | "threshold" | "goalsUnlock"
  >
): DiscoveryDecisionSnapshot {
  return {
    totalLikesCount: getAuthoritativeTotalLikesCount(input),
    lifetimeLikes: input.lifetimeCounts.likes,
    lifetimePasses: input.lifetimeCounts.passes,
    thresholdTotalLikes: input.threshold.totalLikes,
    thresholdTotalPasses: input.threshold.totalPasses,
    unlockAvailable: input.goalsUnlock.available,
    unlockPending: input.goalsUnlock.unlockMessagePending,
  };
}

function buildDiscoveryQueueSlotMetadata(
  profile: DiscoveryFeedProfileResponse
): DiscoveryQueueSlotMetadata {
  const { images: _images, ...metadata } = profile;
  return metadata;
}

export function buildDiscoveryQueueSlot(
  profile: DiscoveryFeedProfileResponse,
  phase: DiscoveryQueueSlotPhase
): DiscoveryQueueSlot {
  const normalizedId = normalizeDiscoveryProfileId(profile.id);
  const normalizedProfile =
    normalizedId !== null && normalizedId !== profile.id
      ? {
          ...profile,
          id: normalizedId,
        }
      : profile;
  const coverImage = normalizedProfile.images[0] ?? null;

  return {
    phase,
    id: normalizedProfile.id,
    publicId: normalizedProfile.publicId,
    profile: normalizedProfile,
    metadata: buildDiscoveryQueueSlotMetadata(normalizedProfile),
    coverImage,
    images:
      phase === "full"
        ? normalizedProfile.images
        : phase === "cover" && coverImage
          ? [coverImage]
          : [],
  };
}

export function buildDiscoveryQueueSlots(
  profiles: readonly DiscoveryFeedProfileResponse[]
): DiscoveryQueueSlot[] {
  const phases: DiscoveryQueueSlotPhase[] = ["full", "cover", "metadata", "metadata"];
  return profiles
    .slice(0, DISCOVERY_QUEUE_CACHE_SIZE)
    .map((profile, index) =>
      buildDiscoveryQueueSlot(profile, phases[index] ?? "metadata")
    );
}

function pruneDiscoveryFeedWindow(
  feed: DiscoveryFeedResponse,
  input: {
    targetProfileId: number;
    replacementProfile: DiscoveryLikeResponse["replacementProfile"];
    nextCursor: string | null;
    hasMore: boolean;
    queueVersion?: number | null;
    policyVersion?: string;
    supply: DiscoveryLikeResponse["supply"];
  }
): DiscoveryFeedResponse {
  const normalizedReplacementProfile =
    input.replacementProfile &&
    normalizeDiscoveryProfileId(input.replacementProfile.id) !== null
      ? {
          ...input.replacementProfile,
          id: normalizeDiscoveryProfileId(input.replacementProfile.id) as number,
        }
      : input.replacementProfile;
  const nextProfiles = applyDecisionToQueue(
    feed.profiles,
    input.targetProfileId,
    normalizedReplacementProfile,
    {
      maxLength: DISCOVERY_QUEUE_CACHE_SIZE,
    }
  );
  assertDiscoveryQueueInvariants(nextProfiles, {
    targetProfileId: input.targetProfileId,
    maxLength: DISCOVERY_QUEUE_CACHE_SIZE,
  });

  return {
    ...feed,
    queueVersion:
      Number.isFinite(input.queueVersion) && Number(input.queueVersion) > 0
        ? Number(input.queueVersion)
        : feed.queueVersion,
    policyVersion: input.policyVersion || feed.policyVersion,
    generatedAt: new Date().toISOString(),
    windowSize: nextProfiles.length,
    reserveCount: Math.min(DISCOVERY_QUEUE_CACHE_SIZE, nextProfiles.length),
    queueInvalidated: false,
    queueInvalidationReason: null,
    profiles: nextProfiles.slice(0, DISCOVERY_QUEUE_CACHE_SIZE),
    nextCursor: input.nextCursor,
    hasMore: input.hasMore,
    supply: input.supply,
  };
}

function getProfileTargetKey(field: ProfileEditableField): ProfileTargetKey {
  if (ATOMIC_PROFILE_FIELD_GROUPS.includes(field as AtomicProfileFieldGroup)) {
    return field as AtomicProfileFieldGroup;
  }
  return field;
}

function getProfileMutationTargetStorageKey(targetKey: ProfileTargetKey) {
  return `profile:${targetKey}`;
}

function getPhotoMutationTargetStorageKey(slot: number) {
  return `photo:${slot}`;
}

function isRetryableQueueError(error: any) {
  const code = error?.code || error?.message || "";
  return (
    code === "NETWORK_REQUEST_FAILED" ||
    code === "INTERNAL_SERVER_ERROR" ||
    code === "REQUEST_FAILED"
  );
}

function mapQueueStatusToVisibleState(status: MutationQueueStatus): ProfileFieldSaveState {
  if (status === "saving") {
    return "saving";
  }
  if (status === "queued") {
    return "queued";
  }
  if (status === "retryable_error" || status === "permanent_error") {
    return "error";
  }
  return "idle";
}

async function checkBiometricHardware(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [postAuthRedirectRoute, setPostAuthRedirectRoute] =
    useState<PostAuthRedirectRoute | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const analyticsSessionIdRef = useRef<string | null>(null);
  const analyticsHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setRefreshToken] = useState<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const sessionRefreshPromiseRef = useRef<Promise<AuthSessionResponse> | null>(null);
  const [language, setLanguageState] = useState<"es" | "en">("es");
  const languageRef = useRef<"es" | "en">("es");
  const [heightUnit, setHeightUnitState] = useState<HeightUnit>("metric");
  const heightUnitRef = useRef<HeightUnit>("metric");
  const [goals, setGoals] = useState<Goal[]>(() =>
    normalizeStoredGoals(DEFAULT_GOALS)
  );
  const goalsRef = useRef<Goal[]>(normalizeStoredGoals(DEFAULT_GOALS));
  const [sessionSwipeCounts, setSessionSwipeCounts] = useState({
    likes: 0,
    dislikes: 0,
  });
  const [lifetimeDiscoveryCounts, setLifetimeDiscoveryCounts] =
    useState<LifetimeDiscoveryCounts>(createEmptyLifetimeDiscoveryCounts());
  const lifetimeDiscoveryCountsRef = useRef<LifetimeDiscoveryCounts>(
    createEmptyLifetimeDiscoveryCounts()
  );
  const [discoveryThreshold, setDiscoveryThreshold] = useState<DiscoveryThresholdState>(
    createEmptyDiscoveryThreshold()
  );
  const discoveryThresholdRef = useRef<DiscoveryThresholdState>(
    createEmptyDiscoveryThreshold()
  );
  const [goalsUnlockState, setGoalsUnlockState] = useState<GoalsUnlockState>(
    createEmptyGoalsUnlockState()
  );
  const goalsUnlockStateRef = useRef<GoalsUnlockState>(createEmptyGoalsUnlockState());
  const [goalsUnlockPromptVisible, setGoalsUnlockPromptVisible] = useState(false);
  const [likedProfiles, setLikedProfiles] = useState<number[]>([]);
  const likedProfilesRef = useRef<number[]>([]);
  const [passedProfiles, setPassedProfiles] = useState<number[]>([]);
  const passedProfilesRef = useRef<number[]>([]);
  const [discoveryFeed, setDiscoveryFeed] = useState<DiscoveryFeedResponse>(
    createEmptyDiscoveryFeed()
  );
  const discoveryFeedRef = useRef<DiscoveryFeedResponse>(createEmptyDiscoveryFeed());
  const [discoveryQueueStatus, setDiscoveryQueueStatus] =
    useState<DiscoveryQueueStatus>("exhausted");
  const [discoveryPendingDecision, setDiscoveryPendingDecision] =
    useState<DiscoveryPendingDecision>(null);
  const discoveryPendingDecisionRef = useRef<DiscoveryPendingDecision>(null);
  const [discoveryQueuedDecisionCount, setDiscoveryQueuedDecisionCount] = useState(0);
  const discoveryQueuedDecisionsRef = useRef<DiscoveryQueuedDecision[]>([]);
  const discoveryDecisionQueueDrainingRef = useRef(false);
  const discoveryDecisionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discoveryQueueLastRequestId, setDiscoveryQueueLastRequestId] = useState<string | null>(
    null
  );
  const [discoveryQueueLastDecisionRejectedReason, setDiscoveryQueueLastDecisionRejectedReason] =
    useState<string | null>(null);
  const [discoveryQueueLastReplacementProfileId, setDiscoveryQueueLastReplacementProfileId] =
    useState<number | null>(null);
  const [discoveryQueueInvariantViolation, setDiscoveryQueueInvariantViolation] = useState<
    string | null
  >(null);
  const discoveryTraceSeqRef = useRef(0);
  const [discoveryQueueTraceSeq, setDiscoveryQueueTraceSeq] = useState(0);
  const [discoveryQueueTraceBuffer, setDiscoveryQueueTraceBuffer] = useState<
    DiscoveryQueueTraceLog[]
  >([]);
  const simulateNextDiscoveryCursorStaleRef = useRef(false);
  const [discoveryFilters, setDiscoveryFilters] =
    useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const discoveryFiltersRef = useRef<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [discoveryViewPreferences, setDiscoveryViewPreferencesState] =
    useState<DiscoveryViewPreferences>(DEFAULT_DISCOVERY_VIEW_PREFERENCES);
  const [popularAttributesByCategory, setPopularAttributesByCategory] = useState<
    Record<PopularAttributeCategory, PopularAttributeSnapshot>
  >(() => createEmptyPopularAttributesByCategory());
  const popularAttributesByCategoryRef = useRef<
    Record<PopularAttributeCategory, PopularAttributeSnapshot>
  >(createEmptyPopularAttributesByCategory());
  const [totalLikesCount, setTotalLikesCount] = useState(0);
  const totalLikesCountRef = useRef(0);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);
  const [sessionOfflineFallback, setSessionOfflineFallback] = useState(false);
  const sessionRecoveryInFlightRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);
  const confirmedProfileRef = useRef<UserProfile>(DEFAULT_PROFILE);
  const [profileSaveStates, setProfileSaveStates] = useState<
    Partial<Record<ProfileEditableField, ProfileFieldSaveState>>
  >({});
  const profileFieldRevisionRef = useRef<
    Partial<Record<ProfileEditableField, number>>
  >({});
  const profileFieldTimersRef = useRef<
    Partial<Record<ProfileEditableField, ReturnType<typeof setTimeout>>>
  >({});
  const profileFieldStateTimersRef = useRef<
    Partial<Record<ProfileEditableField, ReturnType<typeof setTimeout>>>
  >({});

  const clearDiscoveryDecisionTimeout = useCallback(() => {
    if (discoveryDecisionTimeoutRef.current) {
      clearTimeout(discoveryDecisionTimeoutRef.current);
      discoveryDecisionTimeoutRef.current = null;
    }
  }, []);

  const updateDiscoveryQueueStatus = useCallback((status: DiscoveryQueueStatus) => {
    setDiscoveryQueueStatus(status);
  }, []);

  const updateDiscoveryPendingDecision = useCallback(
    (pendingDecision: DiscoveryPendingDecision) => {
      discoveryPendingDecisionRef.current = pendingDecision;
      setDiscoveryPendingDecision(pendingDecision);
    },
    []
  );

  const setDiscoveryQueuedDecisions = useCallback(
    (queue: DiscoveryQueuedDecision[]) => {
      discoveryQueuedDecisionsRef.current = queue;
      setDiscoveryQueuedDecisionCount(queue.length);
    },
    []
  );

  const recordDiscoveryQueueTrace = useCallback(
    (payload: Omit<DiscoveryQueueTraceLog, "actorId" | "traceSeq">) => {
      const traceSeq = discoveryTraceSeqRef.current + 1;
      discoveryTraceSeqRef.current = traceSeq;
      setDiscoveryQueueTraceSeq(traceSeq);
      const entry: DiscoveryQueueTraceLog = {
        ...payload,
        actorId: userRef.current?.id ?? null,
        traceSeq,
      };
      setDiscoveryQueueTraceBuffer((current) =>
        [...current, entry].slice(-DISCOVERY_QUEUE_TRACE_BUFFER_LIMIT)
      );
      debugDiscoveryLog(entry.event, entry);
      return entry;
    },
    []
  );

  const clearQueuedDiscoveryDecisions = useCallback((reason: string) => {
    if (!discoveryQueuedDecisionsRef.current.length) {
      return;
    }
    const queued = discoveryQueuedDecisionsRef.current;
    discoveryQueuedDecisionsRef.current = [];
    setDiscoveryQueuedDecisionCount(0);
    for (const entry of queued) {
      recordDiscoveryQueueTrace({
        event: "queue_decision_dropped",
        requestId: entry.decisionContext.requestId,
        queueVersion: entry.decisionContext.queueVersion,
        policyVersion: entry.decisionContext.policyVersion,
        visibleQueue: entry.decisionContext.visibleProfileIds,
        activeProfileId: entry.decisionContext.expectedHeadId,
        action: entry.action,
        targetProfileId: entry.decisionContext.targetProfileId,
        logicalHeadId: entry.decisionContext.expectedHeadId,
        renderedFrontId: entry.decisionContext.renderedFrontId,
        hasAccessToken: Boolean(accessToken),
        authStatus,
        isOffline: !isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        canAct: false,
        source: "decision",
        note: reason,
      });
      entry.resolve(null);
    }
  }, [accessToken, authStatus, recordDiscoveryQueueTrace]);

  const commitDiscoveryFeedState = useCallback(
    (
      nextFeed: DiscoveryFeedResponse,
      options?: {
        status?: DiscoveryQueueStatus | null;
        pendingDecision?: DiscoveryPendingDecision;
      }
    ) => {
      const normalizedFeed = normalizeDiscoveryFeed(nextFeed);
      assertDiscoveryQueueInvariants(normalizedFeed.profiles);
      discoveryFeedRef.current = normalizedFeed;
      setDiscoveryFeed(normalizedFeed);
      updateDiscoveryPendingDecision(options?.pendingDecision ?? discoveryPendingDecisionRef.current);
      updateDiscoveryQueueStatus(
        deriveDiscoveryQueueStatus(normalizedFeed, {
          pendingDecision: options?.pendingDecision ?? discoveryPendingDecisionRef.current,
          queuedDecisionCount: discoveryQueuedDecisionsRef.current.length,
          forceStatus: options?.status ?? null,
        })
      );
      return normalizedFeed;
    },
    [updateDiscoveryPendingDecision, updateDiscoveryQueueStatus]
  );
  const viewerBootstrapMetaRef = useRef<ViewerBootstrapMetadata>(
    createDefaultBootstrapMetadata()
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deviceOnline, setDeviceOnlineState] = useState(false);
  const deviceOnlineRef = useRef(false);
  const [serverHealthStatus, setServerHealthStatusState] =
    useState<ServerHealthStatus>("unknown");
  const serverHealthStatusRef = useRef<ServerHealthStatus>("unknown");
  const [lastServerHealthAt, setLastServerHealthAt] = useState<string | null>(null);
  const [lastServerHealthFailureReason, setLastServerHealthFailureReason] =
    useState<string | null>(null);
  const serverHealthCheckInFlightRef = useRef(false);
  const serverHealthPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousEffectiveOnlineRef = useRef(false);
  const [isOnline, setIsOnline] = useState(false);
  const isOnlineRef = useRef(false);
  const [settingsSaveState, setSettingsSaveState] =
    useState<ProfileFieldSaveState>("idle");
  const [authFormPrefill, setAuthFormPrefill] = useState<AuthFormPrefill | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState<string | null>(
    null
  );
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("idle");
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const needsProfileCompletionRef = useRef(false);
  const [onboardingAccessState, setOnboardingAccessStateState] =
    useState<OnboardingAccessState>("unknown");
  const onboardingAccessStateRef = useRef<OnboardingAccessState>("unknown");
  const [onboardingAccessSource, setOnboardingAccessSourceState] =
    useState<AccessTruthSource>("unknown_fallback");
  const onboardingAccessSourceRef = useRef<AccessTruthSource>("unknown_fallback");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const hasCompletedOnboardingRef = useRef(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const biometricsEnabledRef = useRef(false);
  const [accessState, setAccessStateState] = useState<AccessGateState>("booting");
  const accessStateRef = useRef<AccessGateState>("booting");
  const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricBusyRef = useRef(false);
  const [bootstrapComplete, setBootstrapCompleteState] = useState(false);
  const bootstrapCompleteRef = useRef(false);
  const [appReadyForBiometric, setAppReadyForBiometricState] = useState(false);
  const appReadyForBiometricRef = useRef(false);
  const [lockScreenMounted, setLockScreenMountedState] = useState(false);
  const lockScreenMountedRef = useRef(false);
  const [lockScreenFocused, setLockScreenFocusedState] = useState(false);
  const lockScreenFocusedRef = useRef(false);
  const [lockCycleId, setLockCycleId] = useState(0);
  const lockCycleIdRef = useRef(0);
  const [deferredReplayPending, setDeferredReplayPendingState] = useState(false);
  const deferredReplayPendingRef = useRef(false);
  const [lastAppState, setLastAppState] = useState<AppStateStatus>(AppState.currentState);
  const [lastBackgroundAt, setLastBackgroundAtState] = useState<number | null>(null);
  const lastBackgroundAtRef = useRef<number | null>(null);
  const [lastUnlockAt, setLastUnlockAtState] = useState<number | null>(null);
  const [lastPromptCompletedAt, setLastPromptCompletedAtState] = useState<number | null>(null);
  const lastPromptCompletedAtRef = useRef<number | null>(null);
  const [pendingUnlockDestination, setPendingUnlockDestination] =
    useState<"/(tabs)/discover" | null>(null);
  const [lastLockTrigger, setLastLockTriggerState] = useState<LockTrigger>(null);
  const [lastBiometricErrorCode, setLastBiometricErrorCode] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailability>({
    google: false,
    facebook: false,
    apple: false,
  });
  const [onboardingResumeStep, setOnboardingResumeStepState] = useState(1);
  const pendingPostLoginRouteRef = useRef<PendingPostLoginRoute | null>(null);
  const onboardingResumeDraftRef = useRef<OnboardingResumeDraft | null>(null);
  const onboardingResumeStepRef = useRef(1);
  const isQueueReplayingRef = useRef(false);
  const replayMutationQueueRef = useRef<() => Promise<void>>(async () => {});
  const requestQueueReplay = useCallback(() => {
    void replayMutationQueueRef.current();
  }, []);
  const updateEffectiveOnline = useCallback(
    (nextDeviceOnline: boolean, nextServerHealthStatus: ServerHealthStatus) => {
      const nextEffectiveOnline =
        nextDeviceOnline && nextServerHealthStatus === "healthy";
      isOnlineRef.current = nextEffectiveOnline;
      setIsOnline((current) =>
        current === nextEffectiveOnline ? current : nextEffectiveOnline
      );
    },
    []
  );
  const setDeviceOnline = useCallback(
    (next: boolean) => {
      deviceOnlineRef.current = next;
      setDeviceOnlineState((current) => (current === next ? current : next));
      updateEffectiveOnline(next, serverHealthStatusRef.current);
    },
    [updateEffectiveOnline]
  );
  const commitServerHealthStatus = useCallback(
    (
      nextStatus: ServerHealthStatus,
      options?: {
        checkedAt?: string | null;
        failureReason?: string | null;
        result?: ServerHealthCheckResult | null;
        reason?: string | null;
      }
    ) => {
      const previousStatus = serverHealthStatusRef.current;
      serverHealthStatusRef.current = nextStatus;
      setServerHealthStatusState((current) =>
        current === nextStatus ? current : nextStatus
      );
      if (options?.checkedAt !== undefined) {
        setLastServerHealthAt(options.checkedAt ?? null);
      }
      if (options?.failureReason !== undefined) {
        setLastServerHealthFailureReason(options.failureReason ?? null);
      }
      updateEffectiveOnline(deviceOnlineRef.current, nextStatus);
    },
    [updateEffectiveOnline]
  );
  const setAccessState = useCallback((next: AccessGateState) => {
    accessStateRef.current = next;
    setAccessStateState(next);
  }, []);
  const setNeedsProfileCompletionResolved = useCallback((next: boolean) => {
    needsProfileCompletionRef.current = next;
    setNeedsProfileCompletion((current) => (current === next ? current : next));
  }, []);
  const setOnboardingAccessStateResolved = useCallback(
    (
      next: OnboardingAccessState,
      source: AccessTruthSource,
      reason: string,
      extra?: Record<string, unknown>
    ) => {
      onboardingAccessStateRef.current = next;
      onboardingAccessSourceRef.current = source;
      setOnboardingAccessStateState((current) => (current === next ? current : next));
      setOnboardingAccessSourceState((current) =>
        current === source ? current : source
      );
      hasCompletedOnboardingRef.current = next === "complete";
      setHasCompletedOnboarding((current) =>
        current === (next === "complete") ? current : next === "complete"
      );
      debugLog("[auth-gate] onboarding_state_resolved", {
        onboardingState: next,
        source,
        reason,
        userId: userRef.current?.id ?? null,
        ...extra,
      });
    },
    []
  );
  const setBiometricBusyState = useCallback((next: boolean) => {
    biometricBusyRef.current = next;
    setBiometricBusy(next);
  }, []);
  const setBootstrapComplete = useCallback((next: boolean) => {
    bootstrapCompleteRef.current = next;
    setBootstrapCompleteState(next);
  }, []);
  const setBiometricAppReady = useCallback((next: boolean) => {
    appReadyForBiometricRef.current = next;
    setAppReadyForBiometricState(next);
  }, []);
  const setLockScreenMounted = useCallback((next: boolean) => {
    lockScreenMountedRef.current = next;
    setLockScreenMountedState(next);
  }, []);
  const setLockScreenFocused = useCallback((next: boolean) => {
    lockScreenFocusedRef.current = next;
    setLockScreenFocusedState(next);
  }, []);
  const setDeferredReplayPending = useCallback((next: boolean) => {
    deferredReplayPendingRef.current = next;
    setDeferredReplayPendingState(next);
  }, []);
  const setLastBackgroundAt = useCallback((next: number | null) => {
    lastBackgroundAtRef.current = next;
    setLastBackgroundAtState(next);
  }, []);
  const setLastPromptCompletedAt = useCallback((next: number | null) => {
    lastPromptCompletedAtRef.current = next;
    setLastPromptCompletedAtState(next);
  }, []);
  const incrementLockCycleId = useCallback(() => {
    lockCycleIdRef.current += 1;
    setLockCycleId(lockCycleIdRef.current);
    return lockCycleIdRef.current;
  }, []);
  const logBiometricEvent = useCallback(
    (event: string, extra?: Record<string, unknown>) => {
      debugLog(`[biometric] ${event}`, {
        authStatus,
        accessState: accessStateRef.current,
        biometricsEnabled: biometricsEnabledRef.current,
        promptInFlight: biometricBusyRef.current,
        bootstrapComplete: bootstrapCompleteRef.current,
        appReadyForBiometric: appReadyForBiometricRef.current,
        lockScreenMounted: lockScreenMountedRef.current,
        lockScreenFocused: lockScreenFocusedRef.current,
        lockCycleId: lockCycleIdRef.current,
        deferredReplayPending: deferredReplayPendingRef.current,
        ...extra,
      });
    },
    [authStatus]
  );
  const persistOnboardingGateCache = useCallback(
    async (userId: number, onboardingState: OnboardingState) => {
      const cache: PersistedOnboardingGateCache = {
        userId,
        onboardingState,
        confirmedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        getOnboardingGateStorageKey(userId),
        JSON.stringify(cache)
      );
    },
    []
  );
  const readOnboardingGateCache = useCallback(async (userId: number) => {
    const raw = await AsyncStorage.getItem(getOnboardingGateStorageKey(userId));
    if (!raw) {
      return null;
    }
    try {
      const parsed = normalizePersistedOnboardingGateCache(JSON.parse(raw));
      if (!parsed || parsed.userId !== userId) {
        await AsyncStorage.removeItem(getOnboardingGateStorageKey(userId));
        return null;
      }
      return parsed;
    } catch {
      await AsyncStorage.removeItem(getOnboardingGateStorageKey(userId));
      return null;
    }
  }, []);
  const applyBackendConfirmedOnboardingState = useCallback(
    async (
      userId: number | null | undefined,
      onboardingState: OnboardingState | null | undefined,
      reason: string
    ) => {
      const resolvedState = resolveCanonicalOnboardingAccessState(onboardingState);
      setOnboardingAccessStateResolved(
        resolvedState,
        "backend_confirmed",
        reason,
        {
          userId: userId ?? null,
          backendOnboardingState: onboardingState ?? null,
        }
      );
      if (userId && Number.isFinite(userId)) {
        await persistOnboardingGateCache(
          userId,
          resolvedState === "complete" ? "complete" : "incomplete"
        );
      }
    },
    [persistOnboardingGateCache, setOnboardingAccessStateResolved]
  );
  const resetClientState = useCallback(() => {
    const emptyPopularAttributes = createEmptyPopularAttributesByCategory();
    const defaultGoals = normalizeStoredGoals(DEFAULT_GOALS);

    Object.values(profileFieldTimersRef.current).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    Object.values(profileFieldStateTimersRef.current).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    profileFieldTimersRef.current = {};
    profileFieldStateTimersRef.current = {};

    setUser(null);
    userRef.current = null;
    setAccessToken(null);
    accessTokenRef.current = null;
    setRefreshToken(null);
    refreshTokenRef.current = null;
    setPostAuthRedirectRoute(null);
    setAccessState("unauthenticated");
    setBiometricBusyState(false);
    setBiometricAppReady(false);
    setBootstrapComplete(false);
    setLockScreenMounted(false);
    setLockScreenFocused(false);
    setDeferredReplayPending(false);
    setLastBackgroundAt(null);
    setLastPromptCompletedAt(null);
    setLastUnlockAtState(null);
    setPendingUnlockDestination(null);
    setLastLockTriggerState(null);
    setLastBiometricErrorCode(null);
    setLockCycleId(0);
    lockCycleIdRef.current = 0;
    setOnboardingAccessStateResolved(
      "unknown",
      "unknown_fallback",
      "client_state_reset"
    );
    setNeedsProfileCompletionResolved(false);
    setAuthError(null);
    setAuthFormPrefill(null);
    setPendingVerificationEmail(null);
    setPendingVerificationPassword(null);
    setVerificationStatus("idle");
    setLikedProfiles([]);
    likedProfilesRef.current = [];
    setPassedProfiles([]);
    passedProfilesRef.current = [];
    clearDiscoveryDecisionTimeout();
    clearQueuedDiscoveryDecisions("auth_state_reset");
    updateDiscoveryPendingDecision(null);
    setDiscoveryQueueLastRequestId(null);
    setDiscoveryQueueLastDecisionRejectedReason(null);
    setDiscoveryQueueLastReplacementProfileId(null);
    setDiscoveryQueueInvariantViolation(null);
    commitDiscoveryFeedState(createEmptyDiscoveryFeed(), {
      pendingDecision: null,
    });
    setDiscoveryFilters(DEFAULT_DISCOVERY_FILTERS);
    discoveryFiltersRef.current = DEFAULT_DISCOVERY_FILTERS;
    setPopularAttributesByCategory(emptyPopularAttributes);
    popularAttributesByCategoryRef.current = emptyPopularAttributes;
    setTotalLikesCount(0);
    totalLikesCountRef.current = 0;
    setLifetimeDiscoveryCounts(createEmptyLifetimeDiscoveryCounts());
    lifetimeDiscoveryCountsRef.current = createEmptyLifetimeDiscoveryCounts();
    setDiscoveryThreshold(createEmptyDiscoveryThreshold());
    discoveryThresholdRef.current = createEmptyDiscoveryThreshold();
    setGoalsUnlockState(createEmptyGoalsUnlockState());
    goalsUnlockStateRef.current = createEmptyGoalsUnlockState();
    setGoalsUnlockPromptVisible(false);
    setLastServerSyncAt(null);
    setSessionOfflineFallback(false);
    confirmedProfileRef.current = DEFAULT_PROFILE;
    profileRef.current = DEFAULT_PROFILE;
    setProfile(DEFAULT_PROFILE);
    setProfileSaveStates({});
    setSettingsSaveState("idle");
    setOnboardingResumeStepState(1);
    onboardingResumeStepRef.current = 1;
    profileFieldRevisionRef.current = {};
    goalsRef.current = defaultGoals;
    setGoals(defaultGoals);
    viewerBootstrapMetaRef.current = createDefaultBootstrapMetadata();
  }, [setNeedsProfileCompletionResolved, setOnboardingAccessStateResolved]);

  const clearPendingPostLoginRoute = useCallback(async () => {
    pendingPostLoginRouteRef.current = null;
    await AsyncStorage.removeItem(PENDING_POST_LOGIN_ROUTE_STORAGE_KEY);
  }, []);

  useEffect(() => {
    biometricsEnabledRef.current = biometricsEnabled;
  }, [biometricsEnabled]);

  useEffect(() => {
    if (authStatus === "loading") {
      setAccessState("booting");
      setBiometricAppReady(false);
      return;
    }
    if (authStatus !== "authenticated" && accessStateRef.current !== "signing_out") {
      setAccessState("unauthenticated");
      setDeferredReplayPending(false);
    }
  }, [authStatus, setAccessState, setBiometricAppReady, setDeferredReplayPending]);

  useEffect(() => {
    if (authStatus === "loading" || !bootstrapCompleteRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBiometricAppReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [authStatus, bootstrapComplete, setBiometricAppReady]);

  const setPendingPostLoginRoute = useCallback(async (route: PendingPostLoginRoute) => {
    pendingPostLoginRouteRef.current = route;
    await AsyncStorage.setItem(PENDING_POST_LOGIN_ROUTE_STORAGE_KEY, route);
  }, []);

  const clearOnboardingResumeDraft = useCallback(async () => {
    onboardingResumeDraftRef.current = null;
    onboardingResumeStepRef.current = 1;
    setOnboardingResumeStepState(1);
    await AsyncStorage.removeItem(ONBOARDING_RESUME_DRAFT_STORAGE_KEY);
  }, []);

  const setOnboardingResumeStep = useCallback(async (step: number) => {
    const nextStep = normalizeOnboardingStep(step);
    onboardingResumeStepRef.current = nextStep;
    setOnboardingResumeStepState(nextStep);
    const currentDraft = onboardingResumeDraftRef.current;
    if (!currentDraft) {
      return;
    }
    const nextDraft: OnboardingResumeDraft = {
      ...currentDraft,
      step: nextStep,
      storedAt: new Date().toISOString(),
    };
    onboardingResumeDraftRef.current = nextDraft;
    await AsyncStorage.setItem(
      ONBOARDING_RESUME_DRAFT_STORAGE_KEY,
      JSON.stringify(nextDraft)
    );
  }, []);

  const cacheOnboardingResumeDraft = useCallback(
    async (
      profileDraft: UserProfile,
      email?: string | null,
      options?: {
        step?: number;
      }
    ) => {
      const nextStep = normalizeOnboardingStep(
        options?.step ?? onboardingResumeStepRef.current
      );
      const normalizedDraft: OnboardingResumeDraft = {
        email:
          email ??
          userRef.current?.email ??
          onboardingResumeDraftRef.current?.email ??
          authFormPrefill?.email ??
          null,
        profile: normalizeStoredProfile(profileDraft),
        step: nextStep,
        storedAt: new Date().toISOString(),
      };
      onboardingResumeStepRef.current = nextStep;
      setOnboardingResumeStepState(nextStep);
      onboardingResumeDraftRef.current = normalizedDraft;
      await AsyncStorage.setItem(
        ONBOARDING_RESUME_DRAFT_STORAGE_KEY,
        JSON.stringify(normalizedDraft)
      );
    },
    [authFormPrefill?.email]
  );

  const clearOnboardingResumeState = useCallback(async () => {
    await Promise.all([clearPendingPostLoginRoute(), clearOnboardingResumeDraft()]);
  }, [clearOnboardingResumeDraft, clearPendingPostLoginRoute]);

  const persistProfile = useCallback(async (nextProfile: UserProfile) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const clearProfileFieldTimer = useCallback((field: ProfileEditableField) => {
    const timer = profileFieldTimersRef.current[field];
    if (timer) {
      clearTimeout(timer);
      delete profileFieldTimersRef.current[field];
    }
  }, []);

  const clearProfileFieldStateTimer = useCallback((field: ProfileEditableField) => {
    const timer = profileFieldStateTimersRef.current[field];
    if (timer) {
      clearTimeout(timer);
      delete profileFieldStateTimersRef.current[field];
    }
  }, []);

  const setProfileFieldSaveState = useCallback(
    (field: ProfileEditableField, state: ProfileFieldSaveState) => {
      clearProfileFieldStateTimer(field);
      setProfileSaveStates((current) => {
        if (current[field] === state) {
          return current;
        }
        return {
          ...current,
          [field]: state,
        };
      });
    },
    [clearProfileFieldStateTimer]
  );

  const persistDiscoveryFiltersForUser = useCallback(
    async (userId: number, filters: DiscoveryFilters) => {
      const existingRaw = await AsyncStorage.getItem(DISCOVERY_FILTERS_STORAGE_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw) as DiscoveryFiltersCache) : {};
      existing[String(userId)] = filters;
      await AsyncStorage.setItem(
        DISCOVERY_FILTERS_STORAGE_KEY,
        JSON.stringify(existing)
      );
    },
    []
  );

  const persistDiscoveryViewPreferences = useCallback(
    async (nextPreferences: DiscoveryViewPreferences) => {
      await AsyncStorage.setItem(
        DISCOVERY_VIEW_PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences)
      );
    },
    []
  );

  const clearUserScopedCachedState = useCallback(async (userId?: number | null) => {
    const removals: Promise<unknown>[] = [
      AsyncStorage.removeItem("profile"),
      AsyncStorage.removeItem("goals"),
    ];

    if (!userId || !Number.isFinite(userId)) {
      await Promise.all(removals);
      return;
    }

    removals.push(AsyncStorage.removeItem(getViewerBootstrapStorageKey(userId)));
    removals.push(AsyncStorage.removeItem(getOnboardingGateStorageKey(userId)));
    removals.push(clearMutationQueueForUser(userId));

    const [allKeys, filtersRaw] = await Promise.all([
      AsyncStorage.getAllKeys(),
      AsyncStorage.getItem(DISCOVERY_FILTERS_STORAGE_KEY),
    ]);

    const feedPageKeys = allKeys.filter((key) =>
      key.startsWith(`${DISCOVERY_FEED_PAGE_STORAGE_PREFIX}${userId}:`)
    );
    if (feedPageKeys.length) {
      removals.push(AsyncStorage.multiRemove(feedPageKeys));
    }

    if (filtersRaw) {
      try {
        const parsed = JSON.parse(filtersRaw) as DiscoveryFiltersCache;
        delete parsed[String(userId)];
        const nextValue = JSON.stringify(parsed);
        removals.push(
          Object.keys(parsed).length
            ? AsyncStorage.setItem(DISCOVERY_FILTERS_STORAGE_KEY, nextValue)
            : AsyncStorage.removeItem(DISCOVERY_FILTERS_STORAGE_KEY)
        );
      } catch {
        removals.push(AsyncStorage.removeItem(DISCOVERY_FILTERS_STORAGE_KEY));
      }
    }

    await Promise.all(removals);
  }, []);

  const restoreProfilePhotos = useCallback(async (photos: UserProfilePhoto[]) => {
    const ownerKey = userRef.current?.id ?? "anonymous";
    return Promise.all(
      photos.map((photo, index) => ensureLocalProfilePhoto(photo, index, ownerKey))
    );
  }, []);

  const persistViewerBootstrapCache = useCallback(
    async (overrides?: Partial<ViewerBootstrapCache>) => {
      const currentUser = overrides?.user ?? userRef.current;
      if (!currentUser?.id) {
        return;
      }

      const nextProfile = normalizeStoredProfile({
        ...(overrides?.profile || confirmedProfileRef.current),
      });
      const nextSettings = {
        language:
          overrides?.settings?.language ??
          languageRef.current,
        heightUnit:
          overrides?.settings?.heightUnit ??
          heightUnitRef.current,
        genderIdentity:
          overrides?.settings?.genderIdentity ?? nextProfile.genderIdentity,
        pronouns: overrides?.settings?.pronouns ?? nextProfile.pronouns,
        personality: overrides?.settings?.personality ?? nextProfile.personality,
      };
      const nextDiscovery = {
        likedProfileIds:
          overrides?.discovery?.likedProfileIds ?? likedProfilesRef.current,
        passedProfileIds:
          overrides?.discovery?.passedProfileIds ?? passedProfilesRef.current,
        currentDecisionCounts:
          overrides?.discovery?.currentDecisionCounts ?? {
            likes: likedProfilesRef.current.length,
            passes: passedProfilesRef.current.length,
          },
        popularAttributesByCategory:
          overrides?.discovery?.popularAttributesByCategory ??
          popularAttributesByCategoryRef.current,
        totalLikesCount: getAuthoritativeTotalLikesCount({
          totalLikesCount:
            overrides?.discovery?.totalLikesCount ?? totalLikesCountRef.current,
          lifetimeCounts:
            overrides?.discovery?.lifetimeCounts ?? lifetimeDiscoveryCountsRef.current,
          threshold:
            overrides?.discovery?.threshold ?? discoveryThresholdRef.current,
        }),
        lifetimeCounts:
          overrides?.discovery?.lifetimeCounts ?? lifetimeDiscoveryCountsRef.current,
        threshold:
          overrides?.discovery?.threshold ?? discoveryThresholdRef.current,
        goalsUnlock:
          overrides?.discovery?.goalsUnlock ?? goalsUnlockStateRef.current,
        lastNotifiedPopularModeChangeAtLikeCount:
          overrides?.discovery?.lastNotifiedPopularModeChangeAtLikeCount ??
          totalLikesCountRef.current,
        filters: overrides?.discovery?.filters ?? discoveryFiltersRef.current,
        feed: overrides?.discovery?.feed ?? discoveryFeedRef.current,
      };
      const nextGoals = normalizeStoredGoals(
        (overrides?.goals as Goal[] | undefined) ?? goalsRef.current
      );
      const nextMetadata: ViewerBootstrapMetadata = {
        syncedAt: overrides?.syncedAt ?? viewerBootstrapMetaRef.current.syncedAt,
        bootstrapGeneratedAt:
          overrides?.bootstrapGeneratedAt ??
          viewerBootstrapMetaRef.current.bootstrapGeneratedAt,
        viewerVersion:
          overrides?.viewerVersion ?? viewerBootstrapMetaRef.current.viewerVersion,
        updatedAtByDomain:
          overrides?.updatedAtByDomain ?? viewerBootstrapMetaRef.current.updatedAtByDomain,
      };
      const nextOnboardingState =
        overrides?.onboardingState ??
        (onboardingAccessStateRef.current === "complete" ? "complete" : "incomplete");
      const bootstrap: ViewerBootstrapCache = {
        user: currentUser,
        onboardingState: nextOnboardingState,
        needsProfileCompletion:
          overrides?.needsProfileCompletion ?? needsProfileCompletionRef.current,
        hasCompletedOnboarding:
          overrides?.hasCompletedOnboarding ?? nextOnboardingState === "complete",
        profile: nextProfile,
        settings: nextSettings,
        photos: overrides?.photos ?? nextProfile.photos.map((photo) => ({
          profileImageId: photo.profileImageId || 0,
          mediaAssetId: photo.mediaAssetId || 0,
          sortOrder: photo.sortOrder,
          isPrimary: photo.sortOrder === 0,
          updatedAt: new Date().toISOString(),
          remoteUrl: photo.remoteUrl,
          mimeType: "image/jpeg",
          status: photo.status === "pending" ? "pending" : "ready",
        })),
        goals: nextGoals,
        discovery: nextDiscovery,
        syncedAt: nextMetadata.syncedAt,
        bootstrapGeneratedAt: nextMetadata.bootstrapGeneratedAt,
        viewerVersion: nextMetadata.viewerVersion,
        updatedAtByDomain: nextMetadata.updatedAtByDomain,
      };

      viewerBootstrapMetaRef.current = nextMetadata;
      await AsyncStorage.setItem(
        getViewerBootstrapStorageKey(currentUser.id),
        JSON.stringify(bootstrap)
      );
      await AsyncStorage.setItem(LAST_AUTH_USER_ID_STORAGE_KEY, String(currentUser.id));
    },
    []
  );

  const applyOnboardingResumeDraftToProfile = useCallback(async () => {
    const resumeDraft = onboardingResumeDraftRef.current;
    if (!resumeDraft) {
      return;
    }

    const nextStep = normalizeOnboardingStep(resumeDraft.step);
    onboardingResumeStepRef.current = nextStep;
    setOnboardingResumeStepState(nextStep);
    const mergedProfile = mergeOnboardingResumeProfile(profileRef.current, resumeDraft);
    profileRef.current = mergedProfile;
    setProfile(mergedProfile);
    await persistViewerBootstrapCache({
      profile: mergedProfile,
    });
  }, [persistViewerBootstrapCache]);

  const applyViewerBootstrap = useCallback(
    async (
      bootstrap: ViewerBootstrapCache,
      options?: { persist?: boolean; applyGateState?: boolean }
    ) => {
      const normalizedBootstrapUser: AuthUser = {
        ...bootstrap.user,
        dateOfBirth: normalizeIsoDateString(bootstrap.user.dateOfBirth),
      };
      const nextProfile = normalizeStoredProfile({
        ...bootstrap.profile,
        photos: mergeRemotePhotosWithLocal(confirmedProfileRef.current.photos, bootstrap.photos),
      });

      userRef.current = normalizedBootstrapUser;
      setUser(normalizedBootstrapUser);
      viewerBootstrapMetaRef.current = {
        syncedAt:
          bootstrap.syncedAt ||
          bootstrap.bootstrapGeneratedAt ||
          createDefaultBootstrapMetadata().syncedAt,
        bootstrapGeneratedAt:
          bootstrap.bootstrapGeneratedAt ||
          bootstrap.syncedAt ||
          createDefaultBootstrapMetadata().bootstrapGeneratedAt,
        viewerVersion: bootstrap.viewerVersion || "viewer-bootstrap-v1",
        updatedAtByDomain:
          bootstrap.updatedAtByDomain ||
          createDefaultBootstrapMetadata().updatedAtByDomain,
      };
      setNeedsProfileCompletionResolved(bootstrap.needsProfileCompletion);
      if (options?.applyGateState !== false) {
        setOnboardingAccessStateResolved(
          resolveCanonicalOnboardingAccessState(
            bootstrap.onboardingState ??
              (bootstrap.hasCompletedOnboarding ? "complete" : "incomplete")
          ),
          "backend_confirmed",
          "viewer_bootstrap_applied",
          {
            userId: normalizedBootstrapUser.id,
          }
        );
      }
      setLanguageState(bootstrap.settings.language);
      languageRef.current = bootstrap.settings.language;
      setHeightUnitState(bootstrap.settings.heightUnit);
      heightUnitRef.current = bootstrap.settings.heightUnit;
      Object.values(profileFieldTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      Object.values(profileFieldStateTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      profileFieldTimersRef.current = {};
      profileFieldStateTimersRef.current = {};
      setProfileSaveStates({});
      setSettingsSaveState("idle");
      profileFieldRevisionRef.current = {};
      confirmedProfileRef.current = nextProfile;
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      goalsRef.current = normalizeStoredGoals(bootstrap.goals as Goal[]);
      setGoals(goalsRef.current);
      const normalizedLikedProfileIds = (bootstrap.discovery.likedProfileIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      const normalizedPassedProfileIds = (bootstrap.discovery.passedProfileIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      likedProfilesRef.current = normalizedLikedProfileIds;
      setLikedProfiles(normalizedLikedProfileIds);
      passedProfilesRef.current = normalizedPassedProfileIds;
      setPassedProfiles(normalizedPassedProfileIds);
      const restoredDiscoveryFeed =
        options?.persist === false && DISABLE_PERSISTED_DISCOVERY_QUEUE_RESTORE
          ? {
              ...createEmptyDiscoveryFeed(),
              supply: {
                ...createEmptyDiscoveryFeed().supply,
                fetchedAt: bootstrap.bootstrapGeneratedAt || new Date().toISOString(),
              },
            }
          : bootstrap.discovery.feed || {
              ...createEmptyDiscoveryFeed(),
              supply: {
                ...createEmptyDiscoveryFeed().supply,
                fetchedAt: bootstrap.bootstrapGeneratedAt || new Date().toISOString(),
              },
            };
      clearDiscoveryDecisionTimeout();
      clearQueuedDiscoveryDecisions("bootstrap_restore");
      updateDiscoveryPendingDecision(null);
      setDiscoveryQueueInvariantViolation(null);
      setDiscoveryQueueLastRequestId(null);
      setDiscoveryQueueLastDecisionRejectedReason(null);
      setDiscoveryQueueLastReplacementProfileId(null);
      commitDiscoveryFeedState(restoredDiscoveryFeed, {
        pendingDecision: null,
      });
      discoveryFiltersRef.current = {
        ...DEFAULT_DISCOVERY_FILTERS,
        ...(bootstrap.discovery.filters || {}),
      };
      setDiscoveryFilters(discoveryFiltersRef.current);
      popularAttributesByCategoryRef.current =
        bootstrap.discovery.popularAttributesByCategory;
      setPopularAttributesByCategory(bootstrap.discovery.popularAttributesByCategory);
      const normalizedTotalLikesCount = getAuthoritativeTotalLikesCount(
        bootstrap.discovery
      );
      totalLikesCountRef.current = normalizedTotalLikesCount;
      setTotalLikesCount(normalizedTotalLikesCount);
      lifetimeDiscoveryCountsRef.current =
        bootstrap.discovery.lifetimeCounts || createEmptyLifetimeDiscoveryCounts();
      setLifetimeDiscoveryCounts(lifetimeDiscoveryCountsRef.current);
      discoveryThresholdRef.current =
        bootstrap.discovery.threshold || createEmptyDiscoveryThreshold();
      setDiscoveryThreshold(discoveryThresholdRef.current);
      goalsUnlockStateRef.current =
        bootstrap.discovery.goalsUnlock || createEmptyGoalsUnlockState();
      setGoalsUnlockState(goalsUnlockStateRef.current);
      setGoalsUnlockPromptVisible(Boolean(goalsUnlockStateRef.current.unlockMessagePending));
      setLastServerSyncAt(
        bootstrap.bootstrapGeneratedAt || bootstrap.syncedAt || new Date().toISOString()
      );

      void restoreProfilePhotos(nextProfile.photos)
        .then((restoredPhotos) => {
          const restoredProfile = normalizeStoredProfile({
            ...nextProfile,
            photos: restoredPhotos,
          });
          confirmedProfileRef.current = restoredProfile;
          profileRef.current = restoredProfile;
          setProfile(restoredProfile);
          if (options?.persist !== false) {
            void persistViewerBootstrapCache({
              ...bootstrap,
              profile: restoredProfile,
              settings: bootstrap.settings,
            });
          }
        })
        .catch(() => {});

      if (options?.persist !== false) {
        await persistViewerBootstrapCache({
          ...bootstrap,
          profile: nextProfile,
          settings: bootstrap.settings,
        });
      }
    },
    [
      persistViewerBootstrapCache,
      restoreProfilePhotos,
      setNeedsProfileCompletionResolved,
      setOnboardingAccessStateResolved,
    ]
  );

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => () => {
    clearDiscoveryDecisionTimeout();
  }, [clearDiscoveryDecisionTimeout]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    heightUnitRef.current = heightUnit;
  }, [heightUnit]);

  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    likedProfilesRef.current = likedProfiles;
  }, [likedProfiles]);

  useEffect(() => {
    passedProfilesRef.current = passedProfiles;
  }, [passedProfiles]);

  useEffect(() => {
    discoveryFiltersRef.current = discoveryFilters;
  }, [discoveryFilters]);

  useEffect(() => {
    discoveryFeedRef.current = discoveryFeed;
  }, [discoveryFeed]);

  useEffect(() => {
    popularAttributesByCategoryRef.current = popularAttributesByCategory;
  }, [popularAttributesByCategory]);

  useEffect(() => {
    totalLikesCountRef.current = totalLikesCount;
  }, [totalLikesCount]);

  useEffect(() => {
    lifetimeDiscoveryCountsRef.current = lifetimeDiscoveryCounts;
  }, [lifetimeDiscoveryCounts]);

  useEffect(() => {
    discoveryThresholdRef.current = discoveryThreshold;
  }, [discoveryThreshold]);

  useEffect(() => {
    goalsUnlockStateRef.current = goalsUnlockState;
  }, [goalsUnlockState]);

  useEffect(() => {
    needsProfileCompletionRef.current = needsProfileCompletion;
  }, [needsProfileCompletion]);

  useEffect(() => {
    hasCompletedOnboardingRef.current = hasCompletedOnboarding;
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    return () => {
      Object.values(profileFieldTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      Object.values(profileFieldStateTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  useEffect(() => {
    fetchProviderAvailability().then(setProviderAvailability).catch(() => {});
  }, []);

  const t = useCallback(
    (es: string, en: string) => (language === "es" ? es : en),
    [language]
  );

  const resolvedAccessGate = useMemo(
    () =>
      resolveAccessGate({
        authStatus,
        needsProfileCompletion,
        onboardingState: onboardingAccessState,
        source: onboardingAccessSource,
      }),
    [
      authStatus,
      needsProfileCompletion,
      onboardingAccessSource,
      onboardingAccessState,
    ]
  );

  useEffect(() => {
    debugLog("[auth-gate] route_decision", {
      authState: resolvedAccessGate.authState,
      onboardingState: resolvedAccessGate.onboardingState,
      needsProfileCompletion: resolvedAccessGate.needsProfileCompletion,
      canEnterDiscover: resolvedAccessGate.canEnterDiscover,
      route: resolvedAccessGate.route,
      reason: resolvedAccessGate.reason,
      source: resolvedAccessGate.source,
      sessionOfflineFallback,
      userId: userRef.current?.id ?? null,
    });
  }, [resolvedAccessGate, sessionOfflineFallback]);

  const refreshProfileLocation = useCallback(
    async (options?: { reason?: string; force?: boolean; requestId?: string }) => {
      if (Platform.OS === "web") {
        return {
          status: "web",
          reason: options?.reason || "manual",
          userId: null,
          requestId: options?.requestId || null,
        } satisfies LocationSyncResult;
      }

      const userId = userRef.current?.id;
      const token = accessTokenRef.current;
      if (!userId || !token) {
        return {
          status: "no_session",
          reason: options?.reason || "manual",
          userId: userId || null,
          requestId: options?.requestId || null,
        } satisfies LocationSyncResult;
      }

      const reason = options?.reason || "manual";
      const requestId = options?.requestId || createLocationSyncRequestId(reason);
      const cadenceKey = `${DISCOVERY_LOCATION_SYNC_STORAGE_PREFIX}${userId}`;

      try {
        if (reason === "discover_entry" && !options?.force) {
          const lastSyncedAt = await AsyncStorage.getItem(cadenceKey);
          if (lastSyncedAt) {
            const elapsedMs = Date.now() - new Date(lastSyncedAt).getTime();
            if (Number.isFinite(elapsedMs) && elapsedMs < 24 * 60 * 60 * 1000) {
              debugLog("[location-sync] skipped_recent_sync", {
                reason,
                userId,
                lastSyncedAt,
              });
              return {
                status: "skipped_recent_sync",
                reason,
                userId,
                requestId,
              } satisfies LocationSyncResult;
            }
          }
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          debugWarn("[location-sync] services_disabled", {
            reason,
            userId,
            requestId,
          });
          return {
            status: "services_disabled",
            reason,
            userId,
            requestId,
          } satisfies LocationSyncResult;
        }

        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (!permission.granted) {
          debugWarn("[location-sync] permission_denied", {
            reason,
            userId,
            canAskAgain: permission.canAskAgain,
            requestId,
          });
          return {
            status: "permission_denied",
            reason,
            userId,
            requestId,
            canAskAgain: permission.canAskAgain,
          } satisfies LocationSyncResult;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (!place) {
          debugWarn("[location-sync] reverse_geocode_empty", {
            reason,
            userId,
            requestId,
          });
          return {
            status: "reverse_geocode_empty",
            reason,
            userId,
            requestId,
          } satisfies LocationSyncResult;
        }

        const city =
          place.city ||
          place.subregion ||
          place.district ||
          place.region ||
          "";
        const country = place.country || "";
        const nextLocation = [city, country].filter(Boolean).join(", ");

        if (!nextLocation) {
          debugWarn("[location-sync] normalized_location_empty", {
            reason,
            userId,
            requestId,
          });
          return {
            status: "normalized_location_empty",
            reason,
            userId,
            requestId,
          } satisfies LocationSyncResult;
        }

        debugLog("[location-sync] update_started", {
          reason,
          userId,
          requestId,
          nextLocation,
          country,
        });

        const response = await updateViewerProfile(
          token,
          {
            location: nextLocation,
            country,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          } as any,
          {
            headers: {
              "X-Matcha-Location-Source": reason,
              "X-Matcha-Request-Id": requestId,
            },
          }
        );

        const updated = normalizeStoredProfile({
          ...profileRef.current,
          ...response.profile,
        });
        profileRef.current = updated;
        setProfile(updated);
        await persistViewerBootstrapCache({ profile: updated });
        await AsyncStorage.setItem(cadenceKey, new Date().toISOString());
        debugLog("[location-sync] update_succeeded", {
          reason,
          userId,
          requestId,
          nextLocation,
        });
        return {
          status: "updated",
          reason,
          userId,
          requestId,
          nextLocation,
        } satisfies LocationSyncResult;
      } catch (error: any) {
        debugWarn("[location-sync] update_failed", {
          reason,
          userId,
          requestId,
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        });
        return {
          status: "failed",
          reason,
          userId,
          requestId,
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        } satisfies LocationSyncResult;
      }
    },
    [persistViewerBootstrapCache]
  );

  const setLanguage = useCallback((lang: "es" | "en") => {
    setLanguageState(lang);
    AsyncStorage.setItem("language", lang).catch(() => {});
  }, []);

  const setHeightUnit = useCallback((unit: HeightUnit) => {
    setHeightUnitState(unit);
    AsyncStorage.setItem("heightUnit", unit).catch(() => {});
  }, []);

  const setDiscoveryViewPreferences = useCallback(
    async (updates: Partial<DiscoveryViewPreferences>) => {
      setDiscoveryViewPreferencesState((current) => {
        const nextPreferences = {
          ...current,
          ...updates,
        };
        void persistDiscoveryViewPreferences(nextPreferences);
        return nextPreferences;
      });
    },
    [persistDiscoveryViewPreferences]
  );

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
  }, []);

  const clearPostAuthRedirectRoute = useCallback(() => {
    setPostAuthRedirectRoute(null);
  }, []);

  const resetPendingVerificationState = useCallback(() => {
    setPendingVerificationEmail(null);
    setPendingVerificationPassword(null);
    setVerificationStatus("idle");
    setAuthStatus((prev) =>
      prev === "verification_pending" ? "unauthenticated" : prev
    );
  }, []);

  const clearStoredSessionTokens = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
    ]);
  }, []);

  const refreshSessionSingleFlight = useCallback(async (refreshToken: string) => {
    if (sessionRefreshPromiseRef.current) {
      return sessionRefreshPromiseRef.current;
    }

    const request = refreshSession(refreshToken);
    const wrapped = request.finally(() => {
      if (sessionRefreshPromiseRef.current === wrapped) {
        sessionRefreshPromiseRef.current = null;
      }
    });

    sessionRefreshPromiseRef.current = wrapped;
    return wrapped;
  }, []);

  const setSignInPrefill = useCallback((email: string | null | undefined) => {
    if (!email) return;
    setAuthFormPrefill({
      email,
      mode: "signin",
    });
  }, []);

  const applySession = useCallback(
    async (session: {
      accessToken: string;
      refreshToken: string | null;
      user: AuthUser;
      needsProfileCompletion: boolean;
      onboardingState: OnboardingState;
      hasCompletedOnboarding: boolean;
    }, options?: { restoreOnboardingDraft?: boolean }) => {
      Keyboard.dismiss();
      const normalizedSessionUser: AuthUser = {
        ...session.user,
        dateOfBirth: normalizeIsoDateString(session.user.dateOfBirth),
      };
      const previousUserId = userRef.current?.id ?? null;
      debugLog("[auth] applySession", {
        userId: normalizedSessionUser.id,
        needsProfileCompletion: session.needsProfileCompletion,
        onboardingState: session.onboardingState,
      });
      setAccessToken(session.accessToken);
      accessTokenRef.current = session.accessToken;
      setRefreshToken(session.refreshToken);
      refreshTokenRef.current = session.refreshToken;
      setUser(normalizedSessionUser);
      setAuthFormPrefill(null);
      setPendingVerificationEmail(null);
      setPendingVerificationPassword(null);
      setVerificationStatus("idle");
      setAuthError(null);
      setNeedsProfileCompletionResolved(session.needsProfileCompletion);
      await applyBackendConfirmedOnboardingState(
        normalizedSessionUser.id,
        session.onboardingState,
        "apply_session"
      );
      setSessionOfflineFallback(false);
      await Promise.all([
        AsyncStorage.setItem(LAST_AUTH_USER_ID_STORAGE_KEY, String(normalizedSessionUser.id)),
        AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken),
        AsyncStorage.removeItem("profile"),
        AsyncStorage.removeItem("goals"),
        previousUserId && previousUserId !== normalizedSessionUser.id
          ? clearUserScopedCachedState(previousUserId)
          : Promise.resolve(),
        session.refreshToken
          ? SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken)
          : SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
      ]);

      let bootstrap: ViewerBootstrapCache;
      try {
        bootstrap = await getViewerBootstrap(session.accessToken);
      } catch {
        debugWarn("[auth] bootstrap fetch failed, using fallback cache seed", {
          userId: normalizedSessionUser.id,
        });
        bootstrap = {
          user: normalizedSessionUser,
          onboardingState: session.onboardingState,
          needsProfileCompletion: session.needsProfileCompletion,
          hasCompletedOnboarding: session.hasCompletedOnboarding,
          profile: normalizeStoredProfile({
            ...DEFAULT_PROFILE,
            name: normalizedSessionUser.name || "",
            dateOfBirth: normalizedSessionUser.dateOfBirth || "",
            profession: normalizedSessionUser.profession || "",
          }),
          settings: {
            language: languageRef.current,
            heightUnit: heightUnitRef.current,
            genderIdentity: DEFAULT_PROFILE.genderIdentity,
            pronouns: DEFAULT_PROFILE.pronouns,
            personality: DEFAULT_PROFILE.personality,
          },
          photos: [],
          goals: goalsRef.current,
          discovery: {
            likedProfileIds: likedProfilesRef.current,
            passedProfileIds: passedProfilesRef.current,
            currentDecisionCounts: {
              likes: likedProfilesRef.current.length,
              passes: passedProfilesRef.current.length,
            },
            popularAttributesByCategory: popularAttributesByCategoryRef.current,
            totalLikesCount: totalLikesCountRef.current,
            lifetimeCounts: lifetimeDiscoveryCountsRef.current,
            threshold: discoveryThresholdRef.current,
            goalsUnlock: goalsUnlockStateRef.current,
            lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
            filters: discoveryFiltersRef.current,
            feed: discoveryFeedRef.current,
          },
          syncedAt: new Date().toISOString(),
          bootstrapGeneratedAt: new Date().toISOString(),
          viewerVersion: "viewer-bootstrap-v1",
          updatedAtByDomain: createDefaultBootstrapMetadata().updatedAtByDomain,
        };
      }

      await applyViewerBootstrap({
        ...bootstrap,
        onboardingState: session.onboardingState,
        hasCompletedOnboarding: session.onboardingState === "complete",
      });
      const onboardingResumeDraft = onboardingResumeDraftRef.current;
      const resumeDraftMatchesSession =
        !onboardingResumeDraft?.email ||
        !normalizedSessionUser.email ||
        onboardingResumeDraft.email === normalizedSessionUser.email;
      const shouldRestoreOnboardingDraft =
        options?.restoreOnboardingDraft !== false &&
        Boolean(onboardingResumeDraft) &&
        resumeDraftMatchesSession &&
        !session.needsProfileCompletion &&
        session.onboardingState !== "complete";

      if (shouldRestoreOnboardingDraft) {
        await applyOnboardingResumeDraftToProfile();
      } else if (onboardingResumeDraft && !resumeDraftMatchesSession) {
        await clearOnboardingResumeState().catch(() => {});
      } else if (session.onboardingState === "complete" || session.needsProfileCompletion) {
        await clearOnboardingResumeState().catch(() => {});
      } else {
        const preservedStep = onboardingResumeDraft?.step ?? onboardingResumeStepRef.current;
        const nextStep = normalizeOnboardingStep(preservedStep);
        onboardingResumeStepRef.current = nextStep;
        setOnboardingResumeStepState(nextStep);
      }
      debugLog("[auth] session applied", {
        userId: normalizedSessionUser.id,
      });
      setAuthStatus("authenticated");
      setAccessState("authenticated_unlocked");
      requestQueueReplay();
    },
    [
      applyBackendConfirmedOnboardingState,
      applyOnboardingResumeDraftToProfile,
      applyViewerBootstrap,
      clearUserScopedCachedState,
      clearOnboardingResumeState,
      requestQueueReplay,
      setAccessState,
      setNeedsProfileCompletionResolved,
    ]
  );

  const hydrateSessionFromTokens = useCallback(
    async (tokens: { accessToken: string; refreshToken: string | null }) => {
      const me = await getMe(tokens.accessToken);
      await applySession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: me.user,
        needsProfileCompletion: me.needsProfileCompletion,
        onboardingState: me.onboardingState,
        hasCompletedOnboarding: me.hasCompletedOnboarding,
      });
      return {
        needsProfileCompletion: me.needsProfileCompletion,
        onboardingState: me.onboardingState,
        hasCompletedOnboarding: me.hasCompletedOnboarding,
      };
    },
    [applySession]
  );

  const clearOnboardingResumeForFreshIncompleteSession = useCallback(
    async (session: {
      needsProfileCompletion: boolean;
      onboardingState: OnboardingState;
      hasCompletedOnboarding: boolean;
    }) => {
      if (!session.needsProfileCompletion && session.onboardingState !== "complete") {
        await clearOnboardingResumeState().catch(() => {});
      }
    },
    [clearOnboardingResumeState]
  );

  const syncPostAuthRedirectFromResolvedState = useCallback(() => {
    const nextRoute = resolveAccessGate({
      authStatus: "authenticated",
      needsProfileCompletion: needsProfileCompletionRef.current,
      onboardingState: onboardingAccessStateRef.current,
      source: onboardingAccessSourceRef.current,
    });
    setPostAuthRedirectRoute(
      nextRoute.route === "/(tabs)/discover"
        ? null
        : (nextRoute.route as PostAuthRedirectRoute)
    );
  }, []);

  const requireOnboardingReLogin = useCallback(
    async (requestId?: string, reason?: string) => {
      const recoveryEmail =
        userRef.current?.email ?? onboardingResumeDraftRef.current?.email ?? null;
      const currentDraft = normalizeStoredProfile(profileRef.current);
      await Promise.all([
        setPendingPostLoginRoute("onboarding"),
        cacheOnboardingResumeDraft(
          currentDraft,
          recoveryEmail
        ),
      ]);

      console.warn("[onboarding-auth] onboarding_resume_required", {
        requestId: requestId || null,
        reason: reason || "session_recovery_failed",
        email: recoveryEmail,
      });

      if (recoveryEmail) {
        try {
          await authResendVerificationEmail(recoveryEmail);
          debugLog("[onboarding-auth] verification_resend_requested", {
            requestId: requestId || null,
            email: recoveryEmail,
          });
        } catch (resendError: any) {
          console.warn("[onboarding-auth] verification_resend_failed", {
            requestId: requestId || null,
            email: recoveryEmail,
            error:
              resendError instanceof ApiError
                ? resendError.code
                : resendError?.message || "UNKNOWN_ERROR",
          });
        }
      }

      setSignInPrefill(recoveryEmail);
      setUser(null);
      userRef.current = null;
      setAccessToken(null);
      accessTokenRef.current = null;
      setRefreshToken(null);
      refreshTokenRef.current = null;
      setPendingVerificationEmail(recoveryEmail);
      setPendingVerificationPassword(null);
      setVerificationStatus(recoveryEmail ? "pending" : "idle");
      setSessionOfflineFallback(false);
      setAccessState("unauthenticated");
      setBiometricBusyState(false);
      setDeferredReplayPending(false);
      setLastBiometricErrorCode(null);
      setAuthStatus(recoveryEmail ? "verification_pending" : "unauthenticated");
      setAuthError(null);
      await clearStoredSessionTokens();
    },
    [
      authResendVerificationEmail,
      cacheOnboardingResumeDraft,
      clearStoredSessionTokens,
      setAccessState,
      setBiometricBusyState,
      setDeferredReplayPending,
      setPendingPostLoginRoute,
      setSignInPrefill,
    ]
  );

  const runWithOnboardingSessionRecovery = useCallback(
    async <T,>(
      requestId: string | undefined,
      label: string,
      action: (token: string) => Promise<T>
    ) => {
      const initialToken = accessTokenRef.current;
      if (!initialToken) {
        await requireOnboardingReLogin(requestId, "missing_access_token");
        throw new ApiError("SESSION_EXPIRED", "SESSION_EXPIRED");
      }

      try {
        return await action(initialToken);
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          !["INVALID_SESSION", "UNAUTHORIZED"].includes(error.code)
        ) {
          throw error;
        }

        debugLog("[onboarding-auth] session_refresh_started", {
          requestId: requestId || null,
          label,
          error: error.code,
        });

        const storedRefreshToken =
          refreshTokenRef.current ||
          (await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY));

        if (!storedRefreshToken) {
          await requireOnboardingReLogin(requestId, "missing_refresh_token");
          throw new ApiError("SESSION_EXPIRED", "SESSION_EXPIRED");
        }

        try {
          const refreshedSession = await refreshSession(storedRefreshToken);
          await applySession(refreshedSession, {
            restoreOnboardingDraft: true,
          });
          debugLog("[onboarding-auth] session_refresh_succeeded", {
            requestId: requestId || null,
            label,
            userId: refreshedSession.user.id,
          });
          return await action(refreshedSession.accessToken);
        } catch (refreshError: any) {
          console.warn("[onboarding-auth] session_refresh_failed", {
            requestId: requestId || null,
            label,
            error:
              refreshError instanceof ApiError
                ? refreshError.code
                : refreshError?.message || "UNKNOWN_ERROR",
          });
          await requireOnboardingReLogin(
            requestId,
            refreshError instanceof ApiError
              ? refreshError.code
              : refreshError?.message || "refresh_failed"
          );
          throw new ApiError("SESSION_EXPIRED", "SESSION_EXPIRED");
        }
      }
    },
    [applySession, requireOnboardingReLogin]
  );

  const completePendingVerificationSignIn = useCallback(async () => {
    if (!pendingVerificationEmail || !pendingVerificationPassword) {
      setSignInPrefill(pendingVerificationEmail);
      resetPendingVerificationState();
      setAuthStatus("unauthenticated");
      return false;
    }

    try {
      const session = await authSignIn({
        email: pendingVerificationEmail,
        password: pendingVerificationPassword,
      });
      await clearOnboardingResumeForFreshIncompleteSession(session);
      await applySession(session);
      syncPostAuthRedirectFromResolvedState();
      debugLog("[auth] pending verification auto-login succeeded");
      return true;
    } catch (e: any) {
      debugWarn("[auth] pending verification auto-login failed", e?.code || e?.message);
      const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
      setAuthError(code);
      setSignInPrefill(pendingVerificationEmail);
      resetPendingVerificationState();
      setAuthStatus("unauthenticated");
      return false;
    }
  }, [
    applySession,
    clearOnboardingResumeForFreshIncompleteSession,
    pendingVerificationEmail,
    pendingVerificationPassword,
    resetPendingVerificationState,
    setSignInPrefill,
    syncPostAuthRedirectFromResolvedState,
  ]);

  useEffect(() => {
    (async () => {
      try {
        setBootstrapComplete(false);
        setBiometricAppReady(false);
        setAccessState("booting");
        const [
          lang,
          savedDiscoveryFilters,
          savedDiscoveryViewPreferences,
          savedLastAuthUserId,
          savedPendingPostLoginRoute,
          savedOnboardingResumeDraft,
          savedBiometrics,
          savedHeightUnit,
          legacyGoals,
          legacyProfile,
        ] =
          await Promise.all([
            AsyncStorage.getItem("language"),
            AsyncStorage.getItem(DISCOVERY_FILTERS_STORAGE_KEY),
            AsyncStorage.getItem(DISCOVERY_VIEW_PREFERENCES_STORAGE_KEY),
            AsyncStorage.getItem(LAST_AUTH_USER_ID_STORAGE_KEY),
            AsyncStorage.getItem(PENDING_POST_LOGIN_ROUTE_STORAGE_KEY),
            AsyncStorage.getItem(ONBOARDING_RESUME_DRAFT_STORAGE_KEY),
            AsyncStorage.getItem("biometricsEnabled"),
            AsyncStorage.getItem("heightUnit"),
            AsyncStorage.getItem("goals"),
            AsyncStorage.getItem("profile"),
          ]);
        const storedRefreshToken = await SecureStore.getItemAsync(
          REFRESH_TOKEN_STORAGE_KEY
        );

        if (lang === "es" || lang === "en") setLanguageState(lang);
        if (savedHeightUnit === "metric" || savedHeightUnit === "imperial") {
          setHeightUnitState(savedHeightUnit);
        }
        const cachedDiscoveryFilters = savedDiscoveryFilters
          ? (JSON.parse(savedDiscoveryFilters) as DiscoveryFiltersCache)
          : null;
        if (savedDiscoveryViewPreferences) {
          try {
            setDiscoveryViewPreferencesState({
              ...DEFAULT_DISCOVERY_VIEW_PREFERENCES,
              ...(JSON.parse(savedDiscoveryViewPreferences) as Partial<DiscoveryViewPreferences>),
            });
          } catch {}
        }
        const lastAuthUserId = savedLastAuthUserId ? Number(savedLastAuthUserId) : null;
        if (savedPendingPostLoginRoute === "onboarding") {
          pendingPostLoginRouteRef.current = "onboarding";
        }
        if (savedOnboardingResumeDraft) {
          try {
            const parsedResumeDraft = JSON.parse(
              savedOnboardingResumeDraft
            ) as OnboardingResumeDraft;
            onboardingResumeDraftRef.current = {
              ...parsedResumeDraft,
              step: normalizeOnboardingStep(parsedResumeDraft.step),
              profile: normalizeStoredProfile(parsedResumeDraft.profile),
            };
            onboardingResumeStepRef.current = normalizeOnboardingStep(
              parsedResumeDraft.step
            );
            setOnboardingResumeStepState(
              normalizeOnboardingStep(parsedResumeDraft.step)
            );
            if (parsedResumeDraft.email) {
              setSignInPrefill(parsedResumeDraft.email);
            }
          } catch {
            onboardingResumeDraftRef.current = null;
            onboardingResumeStepRef.current = 1;
          }
        }
        const cachedBootstrapRaw =
          lastAuthUserId && Number.isFinite(lastAuthUserId)
            ? await AsyncStorage.getItem(getViewerBootstrapStorageKey(lastAuthUserId))
            : null;
        const cachedOnboardingGate =
          lastAuthUserId && Number.isFinite(lastAuthUserId)
            ? await readOnboardingGateCache(lastAuthUserId)
            : null;

        if (cachedBootstrapRaw) {
          try {
            await applyViewerBootstrap(
              JSON.parse(cachedBootstrapRaw) as ViewerBootstrapCache,
              { persist: false, applyGateState: false }
            );
          } catch {}
        } else {
          if (legacyGoals) setGoals(normalizeStoredGoals(JSON.parse(legacyGoals)));
          if (legacyProfile) {
            const p = JSON.parse(legacyProfile);
            const normalizedProfile = normalizeStoredProfile(p);
            profileRef.current = normalizedProfile;
            setProfile(normalizedProfile);
            void restoreProfilePhotos(normalizedProfile.photos)
              .then((restoredPhotos) =>
                persistProfile(
                  normalizeStoredProfile({
                    ...normalizedProfile,
                    photos: restoredPhotos,
                  })
                )
              )
              .catch(() => {});
          }
        }

        if (cachedOnboardingGate) {
          setOnboardingAccessStateResolved(
            resolveCanonicalOnboardingAccessState(cachedOnboardingGate.onboardingState),
            "offline_safe_cache",
            "startup_cached_gate_restored",
            {
              userId: cachedOnboardingGate.userId,
              confirmedAt: cachedOnboardingGate.confirmedAt,
            }
          );
        } else {
          setOnboardingAccessStateResolved(
            "unknown",
            "unknown_fallback",
            "startup_gate_unknown"
          );
        }

        if (lastAuthUserId && cachedDiscoveryFilters?.[String(lastAuthUserId)]) {
          setDiscoveryFilters({
            ...DEFAULT_DISCOVERY_FILTERS,
            ...cachedDiscoveryFilters[String(lastAuthUserId)],
          });
        }

        const bioEnabled = savedBiometrics === "true";
        setBiometricsEnabledState(bioEnabled);
        biometricsEnabledRef.current = bioEnabled;

        if (storedRefreshToken) {
          try {
            const session = await refreshSession(storedRefreshToken);
            setSessionOfflineFallback(false);
            debugLog("[auth] refresh succeeded", {
              userId: session.user.id,
            });
            if (cachedDiscoveryFilters?.[String(session.user.id)]) {
              setDiscoveryFilters({
                ...DEFAULT_DISCOVERY_FILTERS,
                ...cachedDiscoveryFilters[String(session.user.id)],
              });
            }
            await clearOnboardingResumeForFreshIncompleteSession(session);
            await applySession(session);
            const resolvedPostUnlockRoute = resolveAccessGate({
              authStatus: "authenticated",
              needsProfileCompletion: session.needsProfileCompletion,
              onboardingState: resolveCanonicalOnboardingAccessState(
                session.onboardingState
              ),
              source: "backend_confirmed",
            }).route;
            if (bioEnabled && Platform.OS !== "web") {
              incrementLockCycleId();
              setPendingUnlockDestination(
                resolvedPostUnlockRoute === "/(tabs)/discover"
                  ? "/(tabs)/discover"
                  : null
              );
              setLastLockTriggerState("cold_start");
              setLastBiometricErrorCode(null);
              setAccessState("authenticated_locked");
              logBiometricEvent("biometric_lock_armed", {
                trigger: "cold_start",
              });
            } else {
              setAccessState("authenticated_unlocked");
            }
          } catch (error) {
            if (cachedBootstrapRaw && !isInvalidRefreshError(error)) {
              debugWarn("[auth] refresh failed, keeping warm-start cache", {
                reason: error instanceof Error ? error.message : "unknown",
              });
              setSessionOfflineFallback(true);
              setAuthStatus("authenticated");
              const offlineResolvedRoute = resolveAccessGate({
                authStatus: "authenticated",
                needsProfileCompletion: needsProfileCompletionRef.current,
                onboardingState: onboardingAccessStateRef.current,
                source: onboardingAccessSourceRef.current,
              }).route;
              if (bioEnabled && Platform.OS !== "web") {
                incrementLockCycleId();
                setPendingUnlockDestination(
                  offlineResolvedRoute === "/(tabs)/discover"
                    ? "/(tabs)/discover"
                    : null
                );
                setLastLockTriggerState("cold_start");
                setLastBiometricErrorCode(null);
                setAccessState("authenticated_locked");
                logBiometricEvent("biometric_lock_armed", {
                  trigger: "cold_start",
                });
              } else {
                setAccessState("authenticated_unlocked");
              }
              return;
            }

            debugWarn("[auth] refresh failed, clearing authenticated state", {
              reason: error instanceof Error ? error.message : "unknown",
            });
            if (error instanceof ApiError && error.code === "NETWORK_REQUEST_FAILED") {
              setAuthError(toReadableAuthError(error));
            }
            resetClientState();
            await clearStoredSessionTokens();
            await Promise.all([
              clearUserScopedCachedState(lastAuthUserId),
              AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
            ]);
            setAuthStatus("unauthenticated");
            setAccessState("unauthenticated");
          }
        } else {
          setAuthStatus("unauthenticated");
          setAccessState("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
        setAccessState("unauthenticated");
      } finally {
        setBootstrapComplete(true);
      }
    })();
  }, [
    applySession,
    clearOnboardingResumeForFreshIncompleteSession,
    applyViewerBootstrap,
    clearUserScopedCachedState,
    clearStoredSessionTokens,
    persistProfile,
    readOnboardingGateCache,
    resetClientState,
    restoreProfilePhotos,
    setSignInPrefill,
    incrementLockCycleId,
    logBiometricEvent,
    setAccessState,
    setOnboardingAccessStateResolved,
    setBiometricAppReady,
    setBootstrapComplete,
  ]);

  const runServerHealthCheck = useCallback(
    async (
      reason: "initial" | "poll" | "foreground" | "device_online"
    ): Promise<boolean | null> => {
      if (!deviceOnlineRef.current || serverHealthCheckInFlightRef.current) {
        return null;
      }

      serverHealthCheckInFlightRef.current = true;
      const shouldMarkChecking = serverHealthStatusRef.current !== "healthy";

      if (shouldMarkChecking) {
        commitServerHealthStatus("checking", {
          reason,
        });
      }

      try {
        const result = await checkServerHealth({
          timeoutMs: SERVER_HEALTH_TIMEOUT_MS,
        });

        if (result.healthy) {
          commitServerHealthStatus("healthy", {
            checkedAt: result.checkedAt,
            failureReason: null,
            result,
            reason,
          });
          return true;
        }

        debugWarn("[reachability] server_health_check_failed", {
          reason,
          checkedAt: result.checkedAt,
          status: result.status ?? null,
          code: result.code ?? null,
        });
        commitServerHealthStatus("unhealthy", {
          checkedAt: result.checkedAt,
          failureReason: result.code ?? "UNHEALTHY",
          result,
          reason,
        });
        return false;
      } finally {
        serverHealthCheckInFlightRef.current = false;
      }
    },
    [commitServerHealthStatus]
  );

  useEffect(() => {
    void NetInfo.fetch().then((state) => {
      const nextOnline = state.isConnected !== false && state.isInternetReachable !== false;
      setDeviceOnline(nextOnline);
      if (!nextOnline) {
        commitServerHealthStatus("unknown", {
          failureReason: "DEVICE_OFFLINE",
          reason: "device_offline",
        });
      }
    });
  }, [commitServerHealthStatus, setDeviceOnline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextOnline = state.isConnected !== false && state.isInternetReachable !== false;
      const wasDeviceOnline = deviceOnlineRef.current;
      setDeviceOnline(nextOnline);
      if (!nextOnline) {
        commitServerHealthStatus("unknown", {
          failureReason: "DEVICE_OFFLINE",
          reason: "device_offline",
        });
        return;
      }
      if (!wasDeviceOnline) {
        void runServerHealthCheck("device_online");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [commitServerHealthStatus, runServerHealthCheck, setDeviceOnline]);

  useEffect(() => {
    if (serverHealthPollIntervalRef.current) {
      clearInterval(serverHealthPollIntervalRef.current);
      serverHealthPollIntervalRef.current = null;
    }

    if (!deviceOnline || lastAppState !== "active") {
      return;
    }

    void runServerHealthCheck("initial");
    serverHealthPollIntervalRef.current = setInterval(() => {
      void runServerHealthCheck("poll");
    }, SERVER_HEALTH_POLL_INTERVAL_MS);

    return () => {
      if (serverHealthPollIntervalRef.current) {
        clearInterval(serverHealthPollIntervalRef.current);
        serverHealthPollIntervalRef.current = null;
      }
    };
  }, [deviceOnline, lastAppState, runServerHealthCheck]);

  useEffect(() => {
    if (!previousEffectiveOnlineRef.current && isOnline) {
      requestQueueReplay();
    }
    previousEffectiveOnlineRef.current = isOnline;
  }, [isOnline, requestQueueReplay]);

  useEffect(() => {
    if (
      !isOnline ||
      !sessionOfflineFallback ||
      authStatus !== "authenticated" ||
      accessTokenRef.current ||
      sessionRecoveryInFlightRef.current
    ) {
      return;
    }

    sessionRecoveryInFlightRef.current = true;

    void (async () => {
      try {
        const storedRefreshToken =
          refreshTokenRef.current ||
          (await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY));

        if (!storedRefreshToken) {
          debugWarn("[auth] session recovery skipped", {
            reason: "missing_refresh_token",
          });
          return;
        }

        debugLog("[auth] session recovery started", {
          reason: "effective_online_restored",
        });

        const refreshedSession = await refreshSessionSingleFlight(storedRefreshToken);
        await applySession(refreshedSession, {
          restoreOnboardingDraft: true,
        });

        debugLog("[auth] session recovery succeeded", {
          userId: refreshedSession.user.id,
          reason: "effective_online_restored",
        });
      } catch (error: any) {
        debugWarn("[auth] session recovery failed", {
          reason: "effective_online_restored",
          error:
            error instanceof ApiError
              ? error.code
              : error?.message || "UNKNOWN_ERROR",
        });
      } finally {
        sessionRecoveryInFlightRef.current = false;
      }
    })();
  }, [authStatus, applySession, isOnline, refreshSessionSingleFlight, sessionOfflineFallback]);

  const saveSettings = useCallback(
    async (input: {
      name: string;
      dateOfBirth: string;
      profession: string;
      genderIdentity: string;
      pronouns: string;
      personality: string;
      language: "es" | "en";
      heightUnit: HeightUnit;
    }) => {
      if (!isOnlineRef.current) {
        setAuthError("NETWORK_UNAVAILABLE");
        setSettingsSaveState("error");
        return false;
      }
      Keyboard.dismiss();
      setAuthBusy(true);
      setAuthError(null);
      setSettingsSaveState("saving");
      try {
        const resolvedName =
          input.name || profileRef.current.name || userRef.current?.name || "";
        const resolvedDateOfBirth =
          input.dateOfBirth ||
          profileRef.current.dateOfBirth ||
          userRef.current?.dateOfBirth ||
          "";
        let nextProfile = normalizeStoredProfile({
          ...profileRef.current,
          name: resolvedName,
          dateOfBirth: resolvedDateOfBirth,
          profession: normalizeCanonicalProfileField("profession", input.profession),
          genderIdentity: normalizeCanonicalProfileField(
            "genderIdentity",
            input.genderIdentity
          ),
          pronouns: normalizeCanonicalProfileField("pronouns", input.pronouns),
          personality: normalizeCanonicalProfileField("personality", input.personality),
        });
        let nextSettings = {
          language: input.language,
          heightUnit: input.heightUnit,
          genderIdentity: input.genderIdentity,
          pronouns: input.pronouns,
          personality: input.personality,
        };

        if (!accessToken || !userRef.current?.id) {
          setSettingsSaveState("error");
          return false;
        }

        const profileFields: readonly ProfileEditableField[] = [
          "name",
          "dateOfBirth",
          "profession",
          "genderIdentity",
          "pronouns",
          "personality",
        ];
        const profilePatch = mapCanonicalProfileToProfilePatch(nextProfile, profileFields);
        const mePatch: Parameters<typeof updateMe>[1] = {
          profession: input.profession,
        };
        if (resolvedName) {
          mePatch.name = resolvedName;
        }
        if (resolvedDateOfBirth) {
          mePatch.dateOfBirth = resolvedDateOfBirth;
        }

        const profileResult = await updateViewerProfile(accessToken, profilePatch);
        const confirmedProfile = normalizeStoredProfile({
          ...confirmedProfileRef.current,
          ...profileResult.profile,
          photos: confirmedProfileRef.current.photos,
        });
        confirmedProfileRef.current = confirmedProfile;
        profileRef.current = confirmedProfile;
        setProfile(confirmedProfile);

        const settingsResult = await updateSettings(accessToken, {
          language: input.language,
          heightUnit: input.heightUnit,
        });
        setLanguageState(settingsResult.settings.language);
        languageRef.current = settingsResult.settings.language;
        setHeightUnitState(settingsResult.settings.heightUnit);
        heightUnitRef.current = settingsResult.settings.heightUnit;
        await AsyncStorage.setItem("language", settingsResult.settings.language);
        await AsyncStorage.setItem("heightUnit", settingsResult.settings.heightUnit);

        const me = await updateMe(accessToken, mePatch);
        setUser(me.user);
        userRef.current = me.user;
        setNeedsProfileCompletionResolved(me.needsProfileCompletion);
        await applyBackendConfirmedOnboardingState(
          me.user.id,
          me.onboardingState,
          "save_settings_update_me"
        );

        await persistViewerBootstrapCache({
          user: me.user,
          profile: confirmedProfile,
          settings: {
            ...nextSettings,
            language: settingsResult.settings.language,
            heightUnit: settingsResult.settings.heightUnit,
          },
          needsProfileCompletion: me.needsProfileCompletion,
          onboardingState: me.onboardingState,
          hasCompletedOnboarding: me.hasCompletedOnboarding,
        });

        setSettingsSaveState("idle");
        debugLog("[settings] save succeeded", {
          userId: userRef.current.id,
          hasDateOfBirth: Boolean(resolvedDateOfBirth),
          hasName: Boolean(resolvedName),
        });

        return true;
      } catch (e: any) {
        debugWarn("[settings] save failed", {
          code: e?.code || null,
          message: e?.message || "UNKNOWN_ERROR",
          payload: {
            hasName: Boolean(input.name || profileRef.current.name || userRef.current?.name),
            dateOfBirth:
              input.dateOfBirth ||
              profileRef.current.dateOfBirth ||
              userRef.current?.dateOfBirth ||
              "",
            profession: input.profession,
            genderIdentity: input.genderIdentity,
            pronouns: input.pronouns,
            personality: input.personality,
            language: input.language,
            heightUnit: input.heightUnit,
          },
        });
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        setSettingsSaveState("error");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [accessToken, persistViewerBootstrapCache]
  );

  const login = useCallback(async () => {
    const demoLoginEnabled =
      process.env.NODE_ENV !== "production" &&
      process.env.EXPO_PUBLIC_ENABLE_DEMO_AUTH === "true";
    if (!demoLoginEnabled) {
      setAuthError("DEMO_AUTH_DISABLED");
      return;
    }
    setPostAuthRedirectRoute("/onboarding");
    await applySession({
      accessToken: `demo-access-${Math.random().toString(36).slice(2)}`,
      refreshToken: `demo-refresh-${Math.random().toString(36).slice(2)}`,
      user: {
        id: 1,
        email: "demo@matcha.app",
        name: "Alejandro",
        dateOfBirth: "1995-06-15",
        profession: "Demo User",
        emailVerified: true,
      },
      needsProfileCompletion: false,
      onboardingState: "incomplete",
      hasCompletedOnboarding: false,
    });
  }, [applySession]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await authSignIn(input);
        setSignInPrefill(input.email);
        await clearOnboardingResumeForFreshIncompleteSession(session);
        await applySession(session);
        syncPostAuthRedirectFromResolvedState();
        analytics.track({ eventName: "login_success" }, {
          accessToken: session.accessToken,
          sessionId: analyticsSessionIdRef.current,
        });
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
        analytics.track({
          eventName: code === "EMAIL_VERIFICATION_REQUIRED" ? "email_verification_required" : "login_failed",
          metadata: { errorCode: code },
        });
        if (code === "EMAIL_VERIFICATION_REQUIRED") {
          const normalizedEmail = input.email.trim();
          setPendingVerificationEmail(normalizedEmail);
          setPendingVerificationPassword(input.password);
          setSignInPrefill(normalizedEmail);
          setAuthStatus("verification_pending");
          setVerificationStatus("pending");
          try {
            await authResendVerificationEmail(normalizedEmail);
          } catch (resendError: any) {
            debugWarn("[auth] verification resend after sign-in failed", {
              email: normalizedEmail,
              error:
                resendError instanceof ApiError
                  ? resendError.code
                  : resendError?.message || "UNKNOWN_ERROR",
            });
          }
          return false;
        }
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      applySession,
      clearOnboardingResumeForFreshIncompleteSession,
      setSignInPrefill,
      syncPostAuthRedirectFromResolvedState,
    ]
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      analytics.track({ eventName: "sign_up_started" });
      try {
        const result = await authSignUp(input);
        if (result.status === "verification_pending") {
          setAuthStatus("verification_pending");
          setPendingVerificationEmail(result.email);
          setPendingVerificationPassword(input.password);
          setSignInPrefill(result.email);
          setVerificationStatus("pending");
          analytics.track({
            eventName: "sign_up_completed",
            metadata: { status: "verification_pending" },
          });
          analytics.track({ eventName: "email_verification_required" });
        }
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [setSignInPrefill]
  );

  const signInWithProvider = useCallback(
    async (provider: AuthProvider, mode: "signin" | "signup") => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await authSignInWithProvider(provider, mode);
        await clearOnboardingResumeForFreshIncompleteSession(session);
        await applySession(session);
        syncPostAuthRedirectFromResolvedState();
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession, clearOnboardingResumeForFreshIncompleteSession, syncPostAuthRedirectFromResolvedState]
  );

  const handleAuthCallback = useCallback(
    async (payload: AuthCallbackPayload) => {
      Keyboard.dismiss();
      setAuthBusy(true);
      setAuthError(null);

      debugLog("[auth-callback] payload", {
        status: payload.status,
        provider: payload.provider,
        hasHandoffCode: Boolean(payload.handoffCode),
        email: payload.email,
      });

      try {
        if (payload.status === "success" && payload.handoffCode) {
          const session = await exchangeSocialHandoffCode(payload.handoffCode);
          const hydrated = await hydrateSessionFromTokens({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          });
          if (!hydrated.needsProfileCompletion && hydrated.onboardingState !== "complete") {
            await clearOnboardingResumeState().catch(() => {});
          }
          syncPostAuthRedirectFromResolvedState();
          return true;
        }

        if (payload.status === "already_verified" || payload.status === "verified") {
          if (payload.email) {
            setSignInPrefill(payload.email);
          }
          const loggedIn = await completePendingVerificationSignIn();
          if (loggedIn) {
            return true;
          }
          return false;
        }

        if (payload.email) {
          setSignInPrefill(payload.email);
        }
        resetPendingVerificationState();
        setAuthStatus("unauthenticated");
        setAuthError(
          toReadableAuthError(payload.code || "INVALID_VERIFICATION_TOKEN")
        );
        return false;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
        setAuthError(code);
        if (payload.email) {
          setSignInPrefill(payload.email);
        }
        resetPendingVerificationState();
        setAuthStatus("unauthenticated");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      clearOnboardingResumeState,
      completePendingVerificationSignIn,
      hydrateSessionFromTokens,
      resetPendingVerificationState,
      setSignInPrefill,
      syncPostAuthRedirectFromResolvedState,
    ]
  );

  const checkPendingVerificationStatus = useCallback(async () => {
    if (!pendingVerificationEmail) {
      return null;
    }

    setAuthError(null);
    setVerificationStatus("checking");

    try {
      const result = await authCheckVerificationStatus(pendingVerificationEmail);
      if (result.status === "verified") {
        const loggedIn = await completePendingVerificationSignIn();
        if (!loggedIn) {
          setVerificationStatus("idle");
        }
        return "verified";
      }

      setVerificationStatus("pending");
      return "pending";
    } catch (e: any) {
      const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
      setAuthError(code);
      setVerificationStatus("pending");
      return null;
    }
  }, [completePendingVerificationSignIn, pendingVerificationEmail]);

  const resendPendingVerificationEmail = useCallback(async () => {
    const email = pendingVerificationEmail?.trim();
    if (!email) {
      return false;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      await authResendVerificationEmail(email);
      setAuthStatus("verification_pending");
      setVerificationStatus("pending");
      return true;
    } catch (e: any) {
      const code = e instanceof ApiError ? toReadableAuthError(e) : "UNKNOWN_ERROR";
      setAuthError(code);
      setVerificationStatus("pending");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [pendingVerificationEmail]);

  const logout = useCallback(async () => {
    analytics.track(
      { eventName: "logout_clicked" },
      { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
    );
    analytics.endSession(accessTokenRef.current, analyticsSessionIdRef.current, "logout");
    analyticsSessionIdRef.current = null;
    try {
      if (accessToken) await authSignOut(accessToken);
    } catch {}
    const currentUserId = userRef.current?.id;
    setAuthStatus("unauthenticated");
    resetClientState();
    await Promise.all([
      clearOnboardingResumeState(),
      clearStoredSessionTokens(),
      clearUserScopedCachedState(currentUserId),
      AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
    ]);
  }, [
    accessToken,
    clearOnboardingResumeState,
    clearStoredSessionTokens,
    clearUserScopedCachedState,
    resetClientState,
  ]);

  const deleteAccount = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (accessToken) {
        await deleteAccountRequest(accessToken);
      }

      const currentUserId = userRef.current?.id;
      const storedPhotos = normalizeStoredProfilePhotos(profileRef.current.photos);
      await Promise.all(
        storedPhotos.map((photo) =>
          photo.localUri
            ? deleteStoredProfilePhoto(photo.localUri).catch(() => {})
            : Promise.resolve()
        )
      );

      setAuthStatus("unauthenticated");
      resetClientState();
      await Promise.all([
        clearOnboardingResumeState(),
        clearStoredSessionTokens(),
        clearUserScopedCachedState(currentUserId),
        AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
        AsyncStorage.removeItem("biometricsEnabled"),
      ]);
      return true;
    } catch (e: any) {
      setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [
    accessToken,
    clearOnboardingResumeState,
    clearStoredSessionTokens,
    clearUserScopedCachedState,
    resetClientState,
  ]);

  const accountProfile = useMemo(
    () => {
      const normalizedProfile = normalizeStoredProfile(profile);
      return {
        ...normalizedProfile,
        name: normalizedProfile.name || user?.name || "",
        dateOfBirth: normalizedProfile.dateOfBirth || user?.dateOfBirth || "",
        profession: normalizedProfile.profession || user?.profession || "",
        email: user?.email || "",
      };
    },
    [profile, user?.dateOfBirth, user?.email, user?.name, user?.profession]
  );

  const persistConfirmedProfileWithBootstrap = useCallback(
    async (
      nextProfile: UserProfile,
      options?: {
        syncUi?: boolean;
      }
    ) => {
      confirmedProfileRef.current = nextProfile;
      if (options?.syncUi !== false) {
        profileRef.current = nextProfile;
        setProfile(nextProfile);
      }
      await persistViewerBootstrapCache({
        profile: nextProfile,
      });
    },
    [persistViewerBootstrapCache]
  );

  const applyConfirmedProfileFields = useCallback(
    async (
      fields: readonly ProfileEditableField[],
      remoteProfile: Partial<UserProfile>,
      options?: {
        revision?: number;
      }
    ) => {
      const normalizedRemoteProfile = normalizeStoredProfile({
        ...confirmedProfileRef.current,
        ...remoteProfile,
        photos: confirmedProfileRef.current.photos,
      });
      const nextConfirmedProfile = reconcileCanonicalProfileFields(
        confirmedProfileRef.current,
        normalizedRemoteProfile,
        fields
      );
      confirmedProfileRef.current = nextConfirmedProfile;
      await persistViewerBootstrapCache({
        profile: nextConfirmedProfile,
      });

      const currentRevision = options?.revision
        ? Math.max(
            ...fields.map((field) => profileFieldRevisionRef.current[field] || 0),
            0
          )
        : null;
      const shouldReconcileUi =
        !options?.revision || !currentRevision || currentRevision <= options.revision;

      if (shouldReconcileUi) {
        const nextUiProfile = reconcileCanonicalProfileFields(
          profileRef.current,
          normalizedRemoteProfile,
          fields
        );
        profileRef.current = nextUiProfile;
        setProfile(nextUiProfile);
        fields.forEach((field) => {
          setProfileFieldSaveState(field, "idle");
        });
      }

      return nextConfirmedProfile;
    },
    [persistViewerBootstrapCache, setProfileFieldSaveState]
  );

  const replayMutationQueue = useCallback(async () => {
    const currentUserId = userRef.current?.id;
    if (
      !currentUserId ||
      !accessToken ||
      !isOnlineRef.current ||
      isQueueReplayingRef.current
    ) {
      return;
    }

    isQueueReplayingRef.current = true;
    try {
      const queueItems = await getReplayableMutationsForUser(currentUserId);
      for (const queuedItem of queueItems) {
        if (userRef.current?.id !== queuedItem.userId || !accessToken) {
          break;
        }

        const savingItem = await updateMutationQueueItem(queuedItem.id, {
          status: "saving",
          lastError: null,
        });
        const item = savingItem || queuedItem;

        try {
          if (item.type === "profile_field_patch") {
            const payload = item.canonicalPayload as ProfileFieldQueuePayload;
            payload.fields.forEach((field) => setProfileFieldSaveState(field, "saving"));
            debugLog("[queue] replay profile patch", {
              id: item.id,
              targetKey: item.targetKey,
              fields: payload.fields,
            });
            const result = await updateViewerProfile(accessToken, payload.patch);
            await applyConfirmedProfileFields(payload.fields, result.profile, {
              revision: payload.revision,
            });
          } else if (item.type === "settings_save") {
            setSettingsSaveState("saving");
            const payload = item.canonicalPayload as SettingsSavePayload;

            if (!payload.completed.profile) {
              const profileResult = await updateViewerProfile(
                accessToken,
                payload.profilePatch
              );
              await applyConfirmedProfileFields(payload.profileFields, profileResult.profile);
              payload.completed.profile = true;
              await updateMutationQueueItem(item.id, {
                canonicalPayload: payload,
              });
            }

            if (!payload.completed.settings) {
              const settingsResult = await updateSettings(accessToken, payload.settingsPatch);
              setLanguageState(settingsResult.settings.language);
              languageRef.current = settingsResult.settings.language;
              setHeightUnitState(settingsResult.settings.heightUnit);
              heightUnitRef.current = settingsResult.settings.heightUnit;
              await AsyncStorage.setItem("language", settingsResult.settings.language);
              await AsyncStorage.setItem("heightUnit", settingsResult.settings.heightUnit);
              await persistViewerBootstrapCache({
                settings: {
                  ...settingsResult.settings,
                  genderIdentity: confirmedProfileRef.current.genderIdentity,
                  pronouns: confirmedProfileRef.current.pronouns,
                  personality: confirmedProfileRef.current.personality,
                },
              });
              payload.completed.settings = true;
              await updateMutationQueueItem(item.id, {
                canonicalPayload: payload,
              });
            }

            if (!payload.completed.account) {
              const me = await updateMe(accessToken, payload.mePatch);
              setUser(me.user);
              userRef.current = me.user;
              setNeedsProfileCompletionResolved(me.needsProfileCompletion);
              await applyBackendConfirmedOnboardingState(
                me.user.id,
                me.onboardingState,
                "replay_settings_save"
              );
              payload.completed.account = true;
              await updateMutationQueueItem(item.id, {
                canonicalPayload: payload,
              });
            }

            setSettingsSaveState("idle");
          } else if (item.type === "profile_photo_upload") {
            const payload = item.canonicalPayload as ProfilePhotoUploadPayload;
            const fileInfo = await FileSystem.getInfoAsync(payload.localUri);
            if (!fileInfo.exists) {
              throw new ApiError(
                "LOCAL_MEDIA_MISSING",
                "Local media file is missing for queued upload"
              );
            }
            const uploaded = await uploadProfilePhotoRequest(
              accessToken,
              payload.slot,
              payload.localUri
            );
            const nextConfirmedProfile = normalizeStoredProfile({
              ...confirmedProfileRef.current,
              photos: normalizeStoredProfilePhotos(
                confirmedProfileRef.current.photos
                  .filter((photo) => photo.sortOrder !== uploaded.sortOrder)
                  .concat({
                    localUri: "",
                    remoteUrl: uploaded.remoteUrl,
                    mediaAssetId: uploaded.mediaAssetId,
                    profileImageId: uploaded.profileImageId,
                    sortOrder: uploaded.sortOrder,
                    status: uploaded.status === "pending" ? "pending" : "ready",
                  })
              ),
            });
            await persistConfirmedProfileWithBootstrap(nextConfirmedProfile, {
              syncUi: false,
            });
            const currentSlotPhoto = getProfilePhotoBySortOrder(profileRef.current.photos, payload.slot);
            if (!currentSlotPhoto || currentSlotPhoto.localUri === payload.localUri) {
              const nextUiProfile = normalizeStoredProfile({
                ...profileRef.current,
                photos: normalizeStoredProfilePhotos(
                  profileRef.current.photos
                    .filter((photo) => photo.sortOrder !== uploaded.sortOrder)
                    .concat({
                      localUri: "",
                      remoteUrl: uploaded.remoteUrl,
                      mediaAssetId: uploaded.mediaAssetId,
                      profileImageId: uploaded.profileImageId,
                      sortOrder: uploaded.sortOrder,
                      status: uploaded.status === "pending" ? "pending" : "ready",
                    })
                ),
              });
              profileRef.current = nextUiProfile;
              setProfile(nextUiProfile);
            }
            if (isStoredProfilePhoto(payload.localUri)) {
              await deleteStoredProfilePhoto(payload.localUri).catch(() => {});
            }
          } else if (item.type === "profile_photo_delete") {
            const payload = item.canonicalPayload as ProfilePhotoDeletePayload;
            const profileImageId =
              payload.profileImageId ||
              getProfilePhotoBySortOrder(confirmedProfileRef.current.photos, payload.slot)
                ?.profileImageId ||
              null;
            if (profileImageId) {
              await deleteProfilePhotoRequest(accessToken, profileImageId);
            }
            const nextConfirmedProfile = normalizeStoredProfile({
              ...confirmedProfileRef.current,
              photos: confirmedProfileRef.current.photos.filter(
                (photo) => photo.sortOrder !== payload.slot
              ),
            });
            await persistConfirmedProfileWithBootstrap(nextConfirmedProfile, {
              syncUi: false,
            });
            const nextUiProfile = normalizeStoredProfile({
              ...profileRef.current,
              photos: profileRef.current.photos.filter(
                (photo) => photo.sortOrder !== payload.slot
              ),
            });
            profileRef.current = nextUiProfile;
            setProfile(nextUiProfile);
            if (isStoredProfilePhoto(payload.localUri)) {
              await deleteStoredProfilePhoto(payload.localUri).catch(() => {});
            }
          }

          await updateMutationQueueItem(item.id, {
            status: "completed",
            lastError: null,
          });
        } catch (error: any) {
          const nextStatus: MutationQueueStatus = isRetryableQueueError(error)
            ? "retryable_error"
            : "permanent_error";
          await updateMutationQueueItem(item.id, {
            status: nextStatus,
            retryCount: item.retryCount + 1,
            lastError: error?.code || error?.message || "UNKNOWN_ERROR",
          });

          if (item.type === "profile_field_patch") {
            const payload = item.canonicalPayload as ProfileFieldQueuePayload;
            payload.fields.forEach((field) => {
              setProfileFieldSaveState(
                field,
                nextStatus === "retryable_error" ? "queued" : "error"
              );
            });
          } else if (item.type === "settings_save") {
            setSettingsSaveState(
              nextStatus === "retryable_error" ? "queued" : "error"
            );
          } else if (item.type === "profile_photo_upload") {
            const payload = item.canonicalPayload as ProfilePhotoUploadPayload;
            const nextUiProfile = normalizeStoredProfile({
              ...profileRef.current,
              photos: normalizeStoredProfilePhotos(
                profileRef.current.photos
                  .filter((photo) => photo.sortOrder !== payload.slot)
                  .concat({
                    localUri: payload.localUri,
                    remoteUrl: "",
                    mediaAssetId: null,
                    profileImageId: null,
                    sortOrder: payload.slot,
                    status: "error",
                  })
              ),
            });
            profileRef.current = nextUiProfile;
            setProfile(nextUiProfile);
          }

          debugWarn("[queue] replay failed", {
            id: item.id,
            type: item.type,
            targetKey: item.targetKey,
            status: nextStatus,
            error: error?.code || error?.message || "UNKNOWN_ERROR",
          });
        }
      }

      await removeCompletedMutationsForUser(currentUserId);
    } finally {
      isQueueReplayingRef.current = false;
    }
  }, [
    accessToken,
    applyConfirmedProfileFields,
    persistConfirmedProfileWithBootstrap,
    persistViewerBootstrapCache,
    setProfileFieldSaveState,
  ]);
  replayMutationQueueRef.current = replayMutationQueue;

  const queueProfileFieldMutation = useCallback(
    async (
      fields: readonly ProfileEditableField[],
      updatedProfile: UserProfile,
      options?: {
        revision?: number;
      }
    ) => {
      if (!userRef.current?.id || !accessToken) {
        return;
      }

      const targetKey = getProfileTargetKey(fields[0]!);
      const patch = mapCanonicalProfileToProfilePatch(updatedProfile, fields);
      await enqueueMutation<ProfileFieldQueuePayload>({
        userId: userRef.current.id,
        type: "profile_field_patch",
        targetKey: getProfileMutationTargetStorageKey(targetKey),
        canonicalPayload: {
          fields,
          patch,
          revision: options?.revision || 0,
        },
      });
      fields.forEach((field) => setProfileFieldSaveState(field, "queued"));
      void replayMutationQueue();
    },
    [accessToken, replayMutationQueue, setProfileFieldSaveState]
  );

  const completeProfile = useCallback(
    async (data: { name: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const updated = normalizeStoredProfile({
          ...profileRef.current,
          name: data.name,
          dateOfBirth: data.dateOfBirth,
        });

        if (accessToken) {
          const result = await updateMe(accessToken, data);
          setUser(result.user);
          userRef.current = result.user;
          setNeedsProfileCompletionResolved(result.needsProfileCompletion);
          await applyBackendConfirmedOnboardingState(
            result.user.id,
            result.onboardingState,
            "complete_profile"
          );
          await persistConfirmedProfileWithBootstrap(updated);
          await applyConfirmedProfileFields(["name", "dateOfBirth"], updated);
        } else {
          setAuthError("SESSION_NOT_READY");
          return false;
        }
        setNeedsProfileCompletionResolved(false);
        analytics.track(
          { eventName: "profile_completion_completed", screenName: "Complete profile" },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        return true;
      } catch (e: any) {
        setAuthError(e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      accessToken,
      applyConfirmedProfileFields,
      persistConfirmedProfileWithBootstrap,
      persistViewerBootstrapCache,
    ]
  );

  const applyOnboardingDraftToLocalState = useCallback(
    (data: OnboardingDraftInput) => {
      const updated = normalizeStoredProfile({
        ...profileRef.current,
        genderIdentity: normalizeCanonicalProfileField(
          "genderIdentity",
          data.genderIdentity
        ),
        pronouns: normalizeCanonicalProfileField("pronouns", data.pronouns),
        personality: normalizeCanonicalProfileField("personality", data.personality),
        relationshipGoals: normalizeCanonicalProfileField(
          "relationshipGoals",
          data.relationshipGoals
        ),
        childrenPreference: normalizeCanonicalProfileField(
          "childrenPreference",
          data.childrenPreference
        ),
        languagesSpoken: normalizeCanonicalProfileField(
          "languagesSpoken",
          data.languagesSpoken
        ),
        education: normalizeCanonicalProfileField("education", data.education),
        physicalActivity: normalizeCanonicalProfileField(
          "physicalActivity",
          data.physicalActivity
        ),
        bodyType: normalizeCanonicalProfileField("bodyType", data.bodyType),
        photos: data.photos,
      });

      profileRef.current = updated;
      setProfile(updated);
      return updated;
    },
    []
  );

  const submitOnboardingDraftToServer = useCallback(
    async (
      token: string,
      data: OnboardingDraftInput,
      requestId?: string
    ) => {
      const fields: readonly ProfileEditableField[] = [
        "genderIdentity",
        "pronouns",
        "personality",
        "relationshipGoals",
        "childrenPreference",
        "languagesSpoken",
        "education",
        "physicalActivity",
        "bodyType",
      ];
      const result = await updateViewerProfile(
        token,
        mapCanonicalProfileToProfilePatch(profileRef.current, fields),
        {
          headers: buildOnboardingRequestHeaders(requestId),
        }
      );
      await applyConfirmedProfileFields(fields, result.profile);
      await cacheOnboardingResumeDraft(
        normalizeStoredProfile({
          ...profileRef.current,
          photos: data.photos,
        })
      );
    },
    [applyConfirmedProfileFields, cacheOnboardingResumeDraft]
  );

  const commitOnboardingPhotos = useCallback(
    async (
      draftPhotos: UserProfilePhoto[],
      options?: { token?: string; requestId?: string }
    ) => {
      const normalizedDraftPhotos = normalizeStoredProfilePhotos(draftPhotos);
      if (!normalizedDraftPhotos.length) {
        return;
      }

      const token = options?.token ?? accessTokenRef.current;
      if (!token) {
        const nextProfile = normalizeStoredProfile({
          ...profileRef.current,
          photos: normalizedDraftPhotos,
        });
        await persistConfirmedProfileWithBootstrap(nextProfile);
        await cacheOnboardingResumeDraft(nextProfile);
        return;
      }

      const committedPhotos: UserProfilePhoto[] = [];
      const localUrisToDelete: string[] = [];

      for (const photo of normalizedDraftPhotos) {
        const needsUpload =
          Boolean(photo.localUri) &&
          (!photo.remoteUrl || photo.mediaAssetId == null || photo.profileImageId == null);

        if (!needsUpload) {
          committedPhotos.push(photo);
          continue;
        }

        const uploaded = await runWithOnboardingSessionRecovery(
          options?.requestId,
          "commit_onboarding_photo",
          async (resolvedToken) =>
            uploadProfilePhotoRequest(resolvedToken, photo.sortOrder, photo.localUri, {
              headers: buildOnboardingRequestHeaders(options?.requestId),
            })
        );
        committedPhotos.push({
          localUri: "",
          remoteUrl: uploaded.remoteUrl,
          mediaAssetId: uploaded.mediaAssetId,
          profileImageId: uploaded.profileImageId,
          sortOrder: uploaded.sortOrder,
          status: uploaded.status === "pending" ? "pending" : "ready",
        });

        if (isStoredProfilePhoto(photo.localUri)) {
          localUrisToDelete.push(photo.localUri);
        }
      }

      const nextProfile = normalizeStoredProfile({
        ...profileRef.current,
        photos: committedPhotos,
      });
      await persistConfirmedProfileWithBootstrap(nextProfile);
      await cacheOnboardingResumeDraft(nextProfile);

      await Promise.all(
        localUrisToDelete.map((uri) => deleteStoredProfilePhoto(uri).catch(() => {}))
      );
    },
    [
      cacheOnboardingResumeDraft,
      persistConfirmedProfileWithBootstrap,
      runWithOnboardingSessionRecovery,
    ]
  );

  const saveOnboardingDraft = useCallback(
    async (
      data: OnboardingDraftInput,
      options?: {
        step?: number;
        requestId?: string;
      }
    ) => {
      const requestId = options?.requestId ?? createOnboardingAttemptId();
      const currentStep = normalizeOnboardingStep(options?.step);
      setAuthBusy(true);
      setAuthError(null);
      try {
        const updated = applyOnboardingDraftToLocalState(data);
        await cacheOnboardingResumeDraft(updated, undefined, {
          step: currentStep,
        });

        const token = accessTokenRef.current;
        if (!token || !isOnlineRef.current) {
          setAuthError(!token ? "SESSION_NOT_READY" : "NETWORK_UNAVAILABLE");
          return false;
        }
        await runWithOnboardingSessionRecovery(
          requestId,
          "save_draft",
          async (resolvedToken) =>
            submitOnboardingDraftToServer(resolvedToken, data, requestId)
        );
        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      applyOnboardingDraftToLocalState,
      cacheOnboardingResumeDraft,
      runWithOnboardingSessionRecovery,
      submitOnboardingDraftToServer,
    ]
  );

  const finishOnboarding = useCallback(
    async (data: OnboardingDraftInput) => {
      const requestId = createOnboardingAttemptId();
      setAuthBusy(true);
      setAuthError(null);
      analytics.track(
        { eventName: "onboarding_started", screenName: "Onboarding" },
        { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
      );
      debugLog("[onboarding-auth] onboarding_submit_started", {
        requestId,
        hasPhotos: data.photos.length > 0,
      });

      try {
        const updated = applyOnboardingDraftToLocalState(data);
        await cacheOnboardingResumeDraft(updated);

        const token = accessTokenRef.current;
        if (!token || !isOnlineRef.current) {
          setAuthError(!token ? "SESSION_NOT_READY" : "NETWORK_UNAVAILABLE");
          return false;
        }
        await runWithOnboardingSessionRecovery(
          requestId,
          "finish_onboarding_save_draft",
          async (resolvedToken) =>
            submitOnboardingDraftToServer(resolvedToken, data, requestId)
        );
        await commitOnboardingPhotos(data.photos, {
          requestId,
        });
        const result = await runWithOnboardingSessionRecovery(
          requestId,
          "finish_onboarding_complete",
          async (resolvedToken) =>
            completeOnboardingRequest(resolvedToken, {
              headers: buildOnboardingRequestHeaders(requestId),
            })
        );
        await applyBackendConfirmedOnboardingState(
          userRef.current?.id,
          result.onboardingState,
          "finish_onboarding_complete"
        );
        await persistViewerBootstrapCache({
          onboardingState: result.onboardingState,
          hasCompletedOnboarding: result.hasCompletedOnboarding,
        });

        await clearOnboardingResumeState();
        analytics.track(
          { eventName: "onboarding_completed", screenName: "Onboarding" },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        debugLog("[onboarding-auth] onboarding_complete_succeeded", {
          requestId,
        });
        return true;
      } catch (e: any) {
        console.warn("[onboarding-auth] onboarding_complete_failed", {
          requestId,
          error: e?.code || e?.message || "UNKNOWN_ERROR",
        });
        analytics.track(
          {
            eventName: "onboarding_save_failed",
            screenName: "Onboarding",
            metadata: { errorCode: e?.code || e?.message || "UNKNOWN_ERROR" },
          },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      applyOnboardingDraftToLocalState,
      cacheOnboardingResumeDraft,
      clearOnboardingResumeState,
      commitOnboardingPhotos,
      persistViewerBootstrapCache,
      runWithOnboardingSessionRecovery,
      submitOnboardingDraftToServer,
    ]
  );

  const saveProfileChanges = useCallback(
    async (patch: Partial<Omit<UserProfile, "age" | "photos">>) => {
      const token = accessTokenRef.current;
      if (!token || !isOnlineRef.current) {
        if (!isOnlineRef.current) {
          setAuthError("NETWORK_UNAVAILABLE");
        }
        return false;
      }

      try {
        debugLog("[profile-save] started", {
          fields: Object.keys(patch),
        });
        const result = await updateViewerProfile(token, patch as any);
        const updated = normalizeStoredProfile({
          ...profileRef.current,
          ...result.profile,
        });
        profileRef.current = updated;
        setProfile(updated);
        await persistViewerBootstrapCache({ profile: updated });
        debugLog("[profile-save] succeeded", {
          fields: Object.keys(patch),
        });
        return true;
      } catch (error: any) {
        debugWarn("[profile-save] failed", {
          fields: Object.keys(patch),
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        });
        setAuthError(error?.code || error?.message || "UNKNOWN_ERROR");
        return false;
      }
    },
    [persistViewerBootstrapCache]
  );

  const runDeferredReplayIfNeeded = useCallback(() => {
    if (!deferredReplayPendingRef.current || authStatus !== "authenticated") {
      return;
    }
    setDeferredReplayPending(false);
    logBiometricEvent("biometric_deferred_replay_executed");
    requestQueueReplay();
  }, [authStatus, logBiometricEvent, requestQueueReplay, setDeferredReplayPending]);

  const authenticateWithBiometricPrompt = useCallback(
    async (options: {
      promptMessage: string;
      cancelLabel: string;
      fallbackLabel?: string;
    }) =>
      LocalAuthentication.authenticateAsync({
        promptMessage: options.promptMessage,
        cancelLabel: options.cancelLabel,
        fallbackLabel: options.fallbackLabel,
      }),
    []
  );

  const forceLogoutForBiometricPolicy = useCallback(
    async (reason: string) => {
      logBiometricEvent("biometric_forced_logout", { reason });
      setAccessState("signing_out");
      setDeferredReplayPending(false);
      setPendingUnlockDestination(null);
      setLastBiometricErrorCode(reason);
      await logout();
      setAccessState("unauthenticated");
    },
    [logBiometricEvent, logout, setAccessState, setDeferredReplayPending]
  );

  const armBiometricLock = useCallback(
    (trigger: LockTrigger) => {
      if (Platform.OS === "web") {
        return;
      }
      if (authStatus !== "authenticated" || !biometricsEnabledRef.current) {
        return;
      }
      if (
        accessStateRef.current === "authenticated_locked" ||
        accessStateRef.current === "unlocking" ||
        accessStateRef.current === "signing_out"
      ) {
        return;
      }
      const now = Date.now();
      const lastCompletedAt = lastPromptCompletedAtRef.current;
      if (
        lastCompletedAt &&
        now - lastCompletedAt < PROMPT_REENTRY_COOLDOWN_MS
      ) {
        logBiometricEvent("biometric_prompt_cooldown_ignored", {
          trigger,
          elapsedMs: now - lastCompletedAt,
        });
        return;
      }

      incrementLockCycleId();
      setAccessState("authenticated_locked");
      setPendingUnlockDestination("/(tabs)/discover");
      setLastLockTriggerState(trigger);
      setLastBiometricErrorCode(null);
      logBiometricEvent("biometric_lock_armed", { trigger });
    },
    [authStatus, incrementLockCycleId, logBiometricEvent, setAccessState]
  );

  const beginBiometricUnlock = useCallback(
    async (trigger?: LockTrigger): Promise<BiometricResult> => {
      if (Platform.OS === "web") {
        setAccessState("authenticated_unlocked");
        return { ok: true };
      }
      const now = Date.now();
      if (
        biometricBusyRef.current ||
        accessStateRef.current !== "authenticated_locked" ||
        !bootstrapCompleteRef.current ||
        !appReadyForBiometricRef.current ||
        !lockScreenMountedRef.current ||
        !lockScreenFocusedRef.current ||
        appStateRef.current !== "active"
      ) {
        logBiometricEvent("biometric_prompt_requested", {
          trigger: trigger ?? lastLockTrigger,
          blocked: true,
        });
        return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
      }
      if (
        lastPromptCompletedAtRef.current &&
        now - lastPromptCompletedAtRef.current < PROMPT_REENTRY_COOLDOWN_MS
      ) {
        logBiometricEvent("biometric_prompt_cooldown_ignored", {
          trigger: trigger ?? lastLockTrigger,
          elapsedMs: now - lastPromptCompletedAtRef.current,
        });
        return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
      }

      logBiometricEvent("biometric_prompt_requested", {
        trigger: trigger ?? lastLockTrigger,
      });
      setBiometricBusyState(true);
      setAccessState("unlocking");
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          await forceLogoutForBiometricPolicy("BIOMETRICS_UNAVAILABLE");
          return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
        }
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) {
          await forceLogoutForBiometricPolicy("BIOMETRICS_NOT_ENROLLED");
          return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
        }
        logBiometricEvent("biometric_prompt_started", {
          trigger: trigger ?? lastLockTrigger,
        });
        const result = await authenticateWithBiometricPrompt({
          promptMessage: "Desbloquear MatchA",
          fallbackLabel: "Usar contraseña",
          cancelLabel: "Cancelar",
        });
        logBiometricEvent("biometric_prompt_result", {
          trigger: trigger ?? lastLockTrigger,
          resultCode: result.success ? "success" : result.error || "BIOMETRIC_AUTH_FAILED",
        });
        if (result.success) {
          setPendingUnlockDestination("/(tabs)/discover");
          setLastBiometricErrorCode(null);
          setLastUnlockAtState(now);
          setLastPromptCompletedAt(now);
          setAccessState("authenticated_unlocked");
          setPostAuthRedirectRoute(null);
          logBiometricEvent("biometric_unlock_succeeded", {
            trigger: trigger ?? lastLockTrigger,
          });
          runDeferredReplayIfNeeded();
          return { ok: true };
        }
        const nextCode =
          result.error === "user_cancel" || result.error === "system_cancel"
            ? "BIOMETRIC_CANCELLED"
            : "BIOMETRIC_AUTH_FAILED";
        setLastBiometricErrorCode(nextCode);
        setLastPromptCompletedAt(now);
        setAccessState("authenticated_locked");
        logBiometricEvent(
          nextCode === "BIOMETRIC_CANCELLED"
            ? "biometric_unlock_cancelled"
            : "biometric_unlock_failed",
          {
            trigger: trigger ?? lastLockTrigger,
            resultCode: nextCode,
          }
        );
        return { ok: false, code: nextCode };
      } catch {
        setLastBiometricErrorCode("BIOMETRIC_AUTH_FAILED");
        setLastPromptCompletedAt(now);
        setAccessState("authenticated_locked");
        logBiometricEvent("biometric_unlock_failed", {
          trigger: trigger ?? lastLockTrigger,
          resultCode: "BIOMETRIC_AUTH_FAILED",
        });
        return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
      } finally {
        setBiometricBusyState(false);
      }
    },
    [
      authenticateWithBiometricPrompt,
      forceLogoutForBiometricPolicy,
      lastLockTrigger,
      logBiometricEvent,
      runDeferredReplayIfNeeded,
      setAccessState,
      setBiometricBusyState,
      setLastPromptCompletedAt,
    ]
  );

  const setLockScreenPresence = useCallback((presence: LockScreenPresence) => {
    setLockScreenMounted(presence.mounted);
    setLockScreenFocused(presence.focused);
  }, [setLockScreenFocused, setLockScreenMounted]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextState;
      setLastAppState(nextState);
      logBiometricEvent("biometric_appstate_changed", {
        previousAppState,
        nextAppState: nextState,
      });

      const now = Date.now();
      if (nextState === "background" || nextState === "inactive") {
        setLastBackgroundAt(now);
        analytics.track(
          { eventName: "app_backgrounded", metadata: { source: "app_lifecycle" } },
          {
            accessToken: accessTokenRef.current,
            sessionId: analyticsSessionIdRef.current,
          }
        );
        analytics.endSession(
          accessTokenRef.current,
          analyticsSessionIdRef.current,
          "background"
        );
        analyticsSessionIdRef.current = null;
        return;
      }

      if (nextState !== "active") {
        return;
      }

      const inactiveDuration =
        lastBackgroundAtRef.current == null ? null : now - lastBackgroundAtRef.current;
      const resumedFromBackground = previousAppState === "background";
      const resumedFromInactive = previousAppState === "inactive";
      const shouldLockFromInactive =
        resumedFromInactive &&
        inactiveDuration != null &&
        inactiveDuration >= MIN_LOCK_INTERRUPTION_MS;

      if (resumedFromInactive && !shouldLockFromInactive) {
        logBiometricEvent("biometric_resume_ignored_short_interrupt", {
          previousAppState,
          nextAppState: nextState,
          interruptionMs: inactiveDuration,
        });
      }

      const shouldLock =
        authStatus === "authenticated" &&
        biometricsEnabledRef.current &&
        (resumedFromBackground || shouldLockFromInactive);

      if (shouldLock) {
        logBiometricEvent("biometric_resume_detected", {
          previousAppState,
          nextAppState: nextState,
          interruptionMs: inactiveDuration,
        });
        armBiometricLock("resume_from_background");
        setDeferredReplayPending(true);
        logBiometricEvent("biometric_deferred_replay_scheduled", {
          previousAppState,
          nextAppState: nextState,
        });
        return;
      }

      requestQueueReplay();
    });

    return () => {
      subscription.remove();
    };
  }, [
    armBiometricLock,
    authStatus,
    logBiometricEvent,
    requestQueueReplay,
    setDeferredReplayPending,
    setLastBackgroundAt,
  ]);

  const setBiometricsEnabled = useCallback(
    async (enabled: boolean): Promise<BiometricResult> => {
      if (Platform.OS === "web") {
        return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
      }
      if (enabled) {
        const available = await checkBiometricHardware();
        if (!available) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          if (!hasHardware) return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
          return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
        }
        const result = await authenticateWithBiometricPrompt({
          promptMessage: "Confirmar biometría",
          cancelLabel: "Cancelar",
        });
        if (!result.success) return { ok: false, code: "BIOMETRIC_CANCELLED" };
      }
      setBiometricsEnabledState(enabled);
      biometricsEnabledRef.current = enabled;
      await AsyncStorage.setItem("biometricsEnabled", enabled ? "true" : "false");
      return { ok: true };
    },
    [authenticateWithBiometricPrompt]
  );

  const updateProfileField = useCallback(
    <K extends ProfileEditableField>(field: K, value: UserProfile[K]) => {
      clearProfileFieldTimer(field);
      clearProfileFieldStateTimer(field);

      const normalizedValue = normalizeCanonicalProfileField(field, value);
      const updated = normalizeStoredProfile({
        ...profileRef.current,
        [field]: normalizedValue,
      });
      const nextRevision = (profileFieldRevisionRef.current[field] || 0) + 1;
      profileFieldRevisionRef.current[field] = nextRevision;
      profileRef.current = updated;
      setProfile(updated);
      setProfileFieldSaveState(field, "queued");

      if (DEBOUNCED_PROFILE_FIELDS.has(field)) {
        profileFieldTimersRef.current[field] = setTimeout(() => {
          delete profileFieldTimersRef.current[field];
          void queueProfileFieldMutation([field], updated, {
            revision: nextRevision,
          });
        }, 650);
        return;
      }

      void queueProfileFieldMutation([field], updated, {
        revision: nextRevision,
      });
    },
    [
      clearProfileFieldStateTimer,
      clearProfileFieldTimer,
      queueProfileFieldMutation,
      setProfileFieldSaveState,
    ]
  );

  const completeGoalTask = useCallback((id: string) => {
    if (!isOnlineRef.current) {
      return;
    }
    const previousGoals = goalsRef.current;
    const targetGoal = previousGoals.find((goal) => goal.id === id);
    if (!targetGoal || targetGoal.completed) {
      return;
    }

    const categoryGoals = previousGoals
      .filter((goal) => goal.category === targetGoal.category)
      .sort((a, b) => a.order - b.order);
    const remainingActive = categoryGoals.filter(
      (goal) => !goal.completed && goal.id !== id
    );
    const completedGoals = categoryGoals.filter(
      (goal) => goal.completed && goal.id !== id
    );
    const completedTarget = {
      ...targetGoal,
      completed: true,
    };

    const reorderedCategory = [
      ...remainingActive,
      ...completedGoals,
      completedTarget,
    ].map((goal, index) => ({
      ...goal,
      order: index,
    }));

    const otherGoals = previousGoals.filter((goal) => goal.category !== targetGoal.category);
    const optimisticGoals = normalizeStoredGoals([...otherGoals, ...reorderedCategory]);
    goalsRef.current = optimisticGoals;
    setGoals(optimisticGoals);
    void persistViewerBootstrapCache({ goals: optimisticGoals });

    if (!accessToken) {
      return;
    }

    void completeGoalRequest(accessToken, id)
      .then((result) => {
        const syncedGoals = normalizeStoredGoals(result.goals as Goal[]);
        goalsRef.current = syncedGoals;
        setGoals(syncedGoals);
        void persistViewerBootstrapCache({ goals: syncedGoals });
      })
      .catch(() => {
        goalsRef.current = previousGoals;
        setGoals(previousGoals);
        void persistViewerBootstrapCache({ goals: previousGoals });
      });
  }, [accessToken, persistViewerBootstrapCache]);

  const reorderGoalTasks = useCallback(
    (category: GoalCategory, fromIndex: number, toIndex: number) => {
      if (!isOnlineRef.current) {
        return;
      }
      const previousGoals = goalsRef.current;
      const categoryGoals = previousGoals
        .filter((goal) => goal.category === category)
        .sort((a, b) => a.order - b.order);
      const activeGoals = categoryGoals.filter((goal) => !goal.completed);
      const completedGoals = categoryGoals.filter((goal) => goal.completed);

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= activeGoals.length ||
        toIndex >= activeGoals.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const reorderedActive = [...activeGoals];
      const [moved] = reorderedActive.splice(fromIndex, 1);
      reorderedActive.splice(toIndex, 0, moved);

      const normalizedCategory = [...reorderedActive, ...completedGoals].map(
        (goal, index) => ({
          ...goal,
          order: index,
        })
      );

      const otherGoals = previousGoals.filter((goal) => goal.category !== category);
      const optimisticGoals = normalizeStoredGoals([...otherGoals, ...normalizedCategory]);
      goalsRef.current = optimisticGoals;
      setGoals(optimisticGoals);
      void persistViewerBootstrapCache({ goals: optimisticGoals });

      if (!accessToken) {
        return;
      }

      void reorderGoalsRequest(accessToken, {
        category,
        orderedGoalKeys: reorderedActive.map((goal) => goal.id),
      })
        .then((result) => {
          const syncedGoals = normalizeStoredGoals(result.goals as Goal[]);
          goalsRef.current = syncedGoals;
          setGoals(syncedGoals);
          void persistViewerBootstrapCache({ goals: syncedGoals });
        })
        .catch(() => {
          goalsRef.current = previousGoals;
          setGoals(previousGoals);
          void persistViewerBootstrapCache({ goals: previousGoals });
        });
    },
    [accessToken, persistViewerBootstrapCache]
  );

  const refreshDiscoveryFeedState = useCallback(
    async (
      token: string | null,
      options?: {
        reason?: string;
        requestId?: string;
        targetProfileId?: number;
      }
    ) => {
      if (!token) {
        return discoveryFeedRef.current;
      }
      if (!isOnlineRef.current) {
        return discoveryFeedRef.current;
      }

      const previousFeed = discoveryFeedRef.current;
      const requestHeaders = options?.requestId
        ? {
            "X-Matcha-Request-Id": options.requestId,
          }
        : undefined;
      let refreshedFeed: DiscoveryFeedResponse;
      try {
        refreshedFeed = await refreshDiscoveryFeed(token, DISCOVERY_QUEUE_CACHE_SIZE, {
          headers: requestHeaders,
        });
      } catch (error) {
        const isAuthRefreshFailure =
          error instanceof ApiError &&
          [
            "INVALID_SESSION",
            "UNAUTHORIZED",
            "SESSION_NOT_FOUND",
            "ACCESS_TOKEN_EXPIRED",
            "INVALID_ACCESS_TOKEN",
          ].includes(error.code);

        if (isAuthRefreshFailure) {
          const storedRefreshToken =
            refreshTokenRef.current ||
            (await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY));

          if (storedRefreshToken) {
            try {
              const refreshedSession = await refreshSessionSingleFlight(storedRefreshToken);
              await applySession(refreshedSession, {
                restoreOnboardingDraft: true,
              });
              refreshedFeed = await refreshDiscoveryFeed(
                refreshedSession.accessToken,
                DISCOVERY_QUEUE_CACHE_SIZE,
                {
                  headers: requestHeaders,
                }
              );
            } catch (refreshError: any) {
              debugDiscoveryWarn("feed_refresh_session_retry_failed", {
                requestId: options?.requestId || null,
                reason: options?.reason || "manual",
                errorCode:
                  refreshError instanceof ApiError
                    ? refreshError.code
                    : refreshError?.code || error.code,
              });

              if (previousFeed.profiles.length > 0) {
                debugDiscoveryWarn("feed_refresh_preserved_existing_queue", {
                  requestId: options?.requestId || null,
                  reason: options?.reason || "manual",
                  errorCode:
                    refreshError instanceof ApiError
                      ? refreshError.code
                      : refreshError?.code || error.code,
                  preservedVisibleQueue: getDiscoveryQueueIds(previousFeed.profiles.slice(0, 3)),
                });
                return previousFeed;
              }

              throw refreshError;
            }
          } else if (previousFeed.profiles.length > 0) {
            debugDiscoveryWarn("feed_refresh_preserved_existing_queue", {
              requestId: options?.requestId || null,
              reason: options?.reason || "manual",
              errorCode: error.code,
              preservedVisibleQueue: getDiscoveryQueueIds(previousFeed.profiles.slice(0, 3)),
            });
            return previousFeed;
          }
        }

        throw error;
      }

      const feed = normalizeDiscoveryFeed(refreshedFeed);
      const statusOverride =
        options?.reason === "cursor_stale"
          ? deriveDiscoveryQueueStatus(feed)
          : deriveDiscoveryQueueStatus(feed);
      commitDiscoveryFeedState(feed, {
        status: statusOverride,
        pendingDecision: null,
      });
      debugDiscoveryLog("feed_refresh_applied", {
        requestId: options?.requestId || null,
        reason: options?.reason || "manual",
        targetProfileId: options?.targetProfileId || null,
        previousProfileCount: previousFeed.profiles.length,
        nextProfileCount: feed.profiles.length,
        previousNextCursor: previousFeed.nextCursor,
        nextCursor: feed.nextCursor,
        previousUnseenCount: previousFeed.supply?.unseenCount ?? null,
        nextUnseenCount: feed.supply?.unseenCount ?? null,
        fetchedAt: feed.supply?.fetchedAt ?? null,
      });
      setDiscoveryQueueLastRequestId(options?.requestId ?? null);
      setDiscoveryQueueLastDecisionRejectedReason(null);
      setDiscoveryQueueLastReplacementProfileId(null);
      recordDiscoveryQueueTrace({
        event:
          options?.reason === "cursor_stale" ? "queue_hard_refresh_applied" : "queue_window_loaded",
        requestId: options?.requestId ?? null,
        queueVersion: feed.queueVersion ?? null,
        policyVersion: feed.policyVersion ?? null,
        visibleQueue: getDiscoveryQueueIds(feed.profiles.slice(0, 3)),
        activeProfileId: feed.profiles[0]?.id ?? null,
        canAct: feed.profiles.length > 0,
        source: options?.reason === "cursor_stale" ? "hard_refresh" : "window",
      });
      setLastServerSyncAt(feed.supply?.fetchedAt || new Date().toISOString());
      await persistViewerBootstrapCache({
        discovery: {
          likedProfileIds: likedProfilesRef.current,
          passedProfileIds: passedProfilesRef.current,
          currentDecisionCounts: {
            likes: likedProfilesRef.current.length,
            passes: passedProfilesRef.current.length,
          },
          popularAttributesByCategory: popularAttributesByCategoryRef.current,
          totalLikesCount: totalLikesCountRef.current,
          lifetimeCounts: lifetimeDiscoveryCountsRef.current,
          threshold: discoveryThresholdRef.current,
          goalsUnlock: goalsUnlockStateRef.current,
          lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
          filters: discoveryFiltersRef.current,
          feed,
        },
      });
      return feed;
    },
    [commitDiscoveryFeedState, persistViewerBootstrapCache, recordDiscoveryQueueTrace]
  );

  const appendDiscoveryFeedWindow = useCallback(
    async (token: string | null) => {
      if (!token) {
        return discoveryFeedRef.current;
      }

      const currentFeed = discoveryFeedRef.current;
      if (!currentFeed.hasMore || !currentFeed.nextCursor) {
        return currentFeed;
      }

      const fetchedFeed = await getNextDiscoveryFeedWindow(token, currentFeed.nextCursor);
      const knownIds = new Set(
        currentFeed.profiles
          .map((profile) => normalizeDiscoveryProfileId(profile.id))
          .filter((profileId): profileId is number => profileId !== null)
      );
      const mergedFeed: DiscoveryFeedResponse = {
        queueVersion: fetchedFeed.queueVersion ?? currentFeed.queueVersion,
        policyVersion: fetchedFeed.policyVersion ?? currentFeed.policyVersion,
        generatedAt: fetchedFeed.generatedAt ?? currentFeed.generatedAt,
        windowSize: fetchedFeed.windowSize ?? currentFeed.windowSize,
        reserveCount: fetchedFeed.reserveCount ?? currentFeed.reserveCount,
        profiles: [
          ...currentFeed.profiles,
          ...fetchedFeed.profiles
            .map((profile) => {
              const normalizedProfileId = normalizeDiscoveryProfileId(profile.id);
              return normalizedProfileId === null
                ? profile
                : { ...profile, id: normalizedProfileId };
            })
            .filter((profile) => !knownIds.has(profile.id)),
        ].slice(0, DISCOVERY_QUEUE_CACHE_SIZE),
        nextCursor: fetchedFeed.nextCursor,
        hasMore: fetchedFeed.hasMore,
        supply: fetchedFeed.supply,
      };

      debugDiscoveryLog("feed_window_appended", {
        requestId: null,
        appendedCount: mergedFeed.profiles.length - currentFeed.profiles.length,
        previousProfileCount: currentFeed.profiles.length,
        nextProfileCount: mergedFeed.profiles.length,
        previousNextCursor: currentFeed.nextCursor,
        nextCursor: mergedFeed.nextCursor,
        hasMore: mergedFeed.hasMore,
        unseenCount: mergedFeed.supply?.unseenCount ?? null,
        fetchedAt: mergedFeed.supply?.fetchedAt ?? null,
      });
      const nextFeed = commitDiscoveryFeedState(mergedFeed);
      setLastServerSyncAt(mergedFeed.supply?.fetchedAt || new Date().toISOString());
      await persistViewerBootstrapCache({
        discovery: {
          likedProfileIds: likedProfilesRef.current,
          passedProfileIds: passedProfilesRef.current,
          currentDecisionCounts: {
            likes: likedProfilesRef.current.length,
            passes: passedProfilesRef.current.length,
          },
          popularAttributesByCategory: popularAttributesByCategoryRef.current,
          totalLikesCount: totalLikesCountRef.current,
          lifetimeCounts: lifetimeDiscoveryCountsRef.current,
          threshold: discoveryThresholdRef.current,
          goalsUnlock: goalsUnlockStateRef.current,
          lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
          filters: discoveryFiltersRef.current,
          feed: nextFeed,
        },
      });

      return nextFeed;
    },
    [commitDiscoveryFeedState, persistViewerBootstrapCache]
  );

  const applyDiscoveryPreferenceResult = useCallback(
    (
      result: DiscoveryLikeResponse,
      options?: {
        requestId?: string;
        action?: DiscoveryDecisionAction;
        targetProfileId?: number;
        latencyMs?: number;
        before?: DiscoveryDecisionSnapshot;
      }
    ) => {
      const after = getDiscoveryDecisionSnapshot(result);
      debugDiscoveryLog("decision_response_reconciled", {
        requestId: options?.requestId || null,
        action: options?.action || result.decisionState,
        targetProfileId: options?.targetProfileId ?? result.targetProfileId,
        latencyMs: options?.latencyMs ?? null,
        decisionApplied: result.decisionApplied,
        decisionRejectedReason: result.decisionRejectedReason ?? null,
        before: options?.before || null,
        after,
        changedCategories: result.changedCategories.map((item) => item.category),
        shouldShowDiscoveryUpdate: result.shouldShowDiscoveryUpdate,
      });
      likedProfilesRef.current = result.likedProfileIds;
      setLikedProfiles(result.likedProfileIds);
      passedProfilesRef.current = result.passedProfileIds;
      setPassedProfiles(result.passedProfileIds);
      popularAttributesByCategoryRef.current = result.popularAttributesByCategory;
      setPopularAttributesByCategory(result.popularAttributesByCategory);
      const normalizedTotalLikesCount = getAuthoritativeTotalLikesCount(result);
      totalLikesCountRef.current = normalizedTotalLikesCount;
      setTotalLikesCount(normalizedTotalLikesCount);
      lifetimeDiscoveryCountsRef.current = result.lifetimeCounts;
      setLifetimeDiscoveryCounts(result.lifetimeCounts);
      discoveryThresholdRef.current = result.threshold;
      setDiscoveryThreshold(result.threshold);
      goalsUnlockStateRef.current = result.goalsUnlock;
      setGoalsUnlockState(result.goalsUnlock);
      setGoalsUnlockPromptVisible(Boolean(result.goalsUnlock.unlockMessagePending));
      setLastServerSyncAt(result.threshold.lastDecisionEventAt || new Date().toISOString());
    },
    []
  );

  const executeDiscoveryDecisionRequest = useCallback(
    async (queuedDecision: DiscoveryQueuedDecision) => {
      const currentAccessToken = accessToken;
      if (!currentAccessToken) {
        return null;
      }
      const {
        action,
        requestDecision,
        profile,
        decisionContext,
        targetProfilePublicId,
        visibleProfilePublicIds,
        shouldSimulateCursorStale,
      } = queuedDecision;
      const requestId = decisionContext.requestId;
      const submittedAt = new Date().toISOString();
      const timeoutAt = new Date(Date.now() + DEFAULT_REQUEST_TIMEOUT_MS).toISOString();
      const before = getDiscoveryDecisionSnapshot({
        totalLikesCount: totalLikesCountRef.current,
        lifetimeCounts: lifetimeDiscoveryCountsRef.current,
        threshold: discoveryThresholdRef.current,
        goalsUnlock: goalsUnlockStateRef.current,
      });
      const startedAt = Date.now();
      const pendingDecision: DiscoveryPendingDecision = {
        requestId,
        action,
        targetProfileId: decisionContext.targetProfileId,
        submittedAt,
        timeoutAt,
      };

      setDiscoveryQueueInvariantViolation(null);
      setDiscoveryQueueLastRequestId(decisionContext.requestId);
      setDiscoveryQueueLastDecisionRejectedReason(null);
      setDiscoveryQueueLastReplacementProfileId(null);
      updateDiscoveryPendingDecision(pendingDecision);
      updateDiscoveryQueueStatus("decision_submitting");
      clearDiscoveryDecisionTimeout();
      discoveryDecisionTimeoutRef.current = setTimeout(() => {
        const currentPendingDecision = discoveryPendingDecisionRef.current as {
          requestId: string;
          targetProfileId: number;
        } | null;
        if (!currentPendingDecision || currentPendingDecision.requestId !== requestId) {
          return;
        }
        updateDiscoveryPendingDecision(null);
        updateDiscoveryQueueStatus(
          deriveDiscoveryQueueStatus(discoveryFeedRef.current, {
            queuedDecisionCount: discoveryQueuedDecisionsRef.current.length,
          })
        );
        setDiscoveryQueueLastDecisionRejectedReason("timeout");
        recordDiscoveryQueueTrace({
          event: "queue_decision_timeout",
          requestId: decisionContext.requestId,
          queueVersion: decisionContext.queueVersion,
          policyVersion: decisionContext.policyVersion,
          visibleQueue: decisionContext.visibleProfileIds,
          activeProfileId: decisionContext.expectedHeadId,
          action,
          targetProfileId: decisionContext.targetProfileId,
          decisionRejectedReason: "timeout",
          logicalHeadId: decisionContext.expectedHeadId,
          renderedFrontId: decisionContext.renderedFrontId,
          hasAccessToken: Boolean(accessToken),
          authStatus,
          isOffline: !isOnlineRef.current,
          hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
          canAct: false,
          source: "decision",
          note: `Decision request exceeded ${DEFAULT_REQUEST_TIMEOUT_MS}ms`,
        });
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      debugDiscoveryLog("decision_request_sent", {
        requestId: decisionContext.requestId,
        action,
        targetProfileId: decisionContext.targetProfileId,
        before,
      });
      recordDiscoveryQueueTrace({
        event: "queue_before_decision_submit",
        requestId: decisionContext.requestId,
        queueVersion: decisionContext.queueVersion,
        policyVersion: decisionContext.policyVersion,
        visibleQueue: decisionContext.visibleProfileIds,
        activeProfileId: decisionContext.expectedHeadId,
        action,
        targetProfileId: decisionContext.targetProfileId,
        logicalHeadId: decisionContext.expectedHeadId,
        renderedFrontId: decisionContext.renderedFrontId,
        hasAccessToken: Boolean(accessToken),
        authStatus,
        isOffline: !isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        canAct: true,
        source: "decision",
      });
      recordDiscoveryQueueTrace({
        event: "queue_decision_request_body",
        requestId: decisionContext.requestId,
        queueVersion: decisionContext.queueVersion,
        policyVersion: decisionContext.policyVersion,
        visibleQueue: decisionContext.visibleProfileIds,
        activeProfileId: decisionContext.expectedHeadId,
        action,
        targetProfileId: decisionContext.targetProfileId,
        logicalHeadId: decisionContext.expectedHeadId,
        renderedFrontId: decisionContext.renderedFrontId,
        hasAccessToken: Boolean(accessToken),
        authStatus,
        isOffline: !isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        cursorPresent: shouldSimulateCursorStale,
        hasCategoryValues: Boolean(profile.categoryValues),
        presentedPosition: 1,
        canAct: true,
        source: "decision",
      });
      recordDiscoveryQueueTrace({
        event: "decision_transport_attempt",
        requestId: decisionContext.requestId,
        queueVersion: decisionContext.queueVersion,
        policyVersion: decisionContext.policyVersion,
        visibleQueue: decisionContext.visibleProfileIds,
        activeProfileId: decisionContext.expectedHeadId,
        action,
        targetProfileId: decisionContext.targetProfileId,
        path: "/api/discovery/decision",
        method: "POST",
        hasAccessToken: Boolean(accessToken),
        authStatus,
        isOffline: !isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        logicalHeadId: decisionContext.expectedHeadId,
        renderedFrontId: decisionContext.renderedFrontId,
        timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
        canAct: false,
        source: "decision",
      });

      try {
        const normalizedTargetProfilePublicId = targetProfilePublicId ?? undefined;
        const decisionPayload: Parameters<typeof requestDecision>[1] = {
          targetProfileId: decisionContext.targetProfileId,
          ...(normalizedTargetProfilePublicId
            ? {
                targetProfilePublicId: normalizedTargetProfilePublicId,
              }
            : {}),
          categoryValues: profile.categoryValues,
          requestId: decisionContext.requestId,
          visibleProfileIds: decisionContext.visibleProfileIds,
          ...(visibleProfilePublicIds.length
            ? {
                visibleProfilePublicIds,
              }
            : {}),
          queueVersion: decisionContext.queueVersion,
          presentedPosition: 1,
        };
        
        // Only include cursor if it has a value (don't send null)
        if (shouldSimulateCursorStale) {
          decisionPayload.cursor = "debug_cursor_stale";
        }
        
        const result = await requestDecision(currentAccessToken, decisionPayload);
        const latencyMs = Date.now() - startedAt;
        const responseRequestId = result.requestId ?? decisionContext.requestId;
        recordDiscoveryQueueTrace({
          event: "queue_decision_response_raw",
          requestId: responseRequestId,
          queueVersion: result.queueVersion ?? decisionContext.queueVersion,
          policyVersion: result.policyVersion ?? decisionContext.policyVersion,
          visibleQueue: decisionContext.visibleProfileIds,
          activeProfileId: decisionContext.expectedHeadId,
          action,
          targetProfileId: result.targetProfileId,
          replacementProfileId: result.replacementProfile?.id ?? null,
          decisionRejectedReason: result.decisionRejectedReason ?? null,
          logicalHeadId: decisionContext.expectedHeadId,
          renderedFrontId: decisionContext.renderedFrontId,
          hasAccessToken: Boolean(accessToken),
          authStatus,
          isOffline: !isOnlineRef.current,
          hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
          canAct: false,
          source: "decision",
        });
        const currentPendingDecision = discoveryPendingDecisionRef.current as {
          requestId: string;
          targetProfileId: number;
        } | null;
        debugLog("[decision] response match check", {
          pendingRequestId: currentPendingDecision?.requestId,
          responseRequestId,
          pendingTargetId: currentPendingDecision?.targetProfileId,
          pendingTargetType: typeof currentPendingDecision?.targetProfileId,
          resultTargetId: result.targetProfileId,
          resultTargetType: typeof result.targetProfileId,
          strictMatch: currentPendingDecision?.targetProfileId === result.targetProfileId,
          normalizedMatch: discoveryIdsEqual(currentPendingDecision?.targetProfileId, result.targetProfileId),
        });
        if (
          !currentPendingDecision ||
          currentPendingDecision.requestId !== responseRequestId ||
          !discoveryIdsEqual(currentPendingDecision.targetProfileId, result.targetProfileId)
        ) {
          const ignoredPendingDescriptor = currentPendingDecision
            ? `pending=${currentPendingDecision.requestId}:${currentPendingDecision.targetProfileId}`
            : "no_pending_decision";
          recordDiscoveryQueueTrace({
            event: "queue_response_ignored",
            requestId: responseRequestId,
            queueVersion: discoveryFeedRef.current.queueVersion ?? decisionContext.queueVersion,
            policyVersion: discoveryFeedRef.current.policyVersion ?? decisionContext.policyVersion,
            visibleQueue: decisionContext.visibleProfileIds,
            activeProfileId: decisionContext.expectedHeadId,
            action,
            targetProfileId: result.targetProfileId,
            replacementProfileId: result.replacementProfile?.id ?? null,
            decisionRejectedReason: result.decisionRejectedReason ?? null,
            logicalHeadId: decisionContext.expectedHeadId,
            renderedFrontId: decisionContext.renderedFrontId,
            hasAccessToken: Boolean(accessToken),
            authStatus,
            isOffline: !isOnlineRef.current,
            hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
            canAct: false,
            source: "decision",
            note: ignoredPendingDescriptor,
          });
          clearDiscoveryDecisionTimeout();
          updateDiscoveryPendingDecision(null);
          updateDiscoveryQueueStatus(deriveDiscoveryQueueStatus(discoveryFeedRef.current));
          return null;
        }
        clearDiscoveryDecisionTimeout();
        updateDiscoveryPendingDecision(null);
        setDiscoveryQueueLastRequestId(responseRequestId);
        setDiscoveryQueueLastDecisionRejectedReason(result.decisionRejectedReason ?? null);
        setDiscoveryQueueLastReplacementProfileId(result.replacementProfile?.id ?? null);
        applyDiscoveryPreferenceResult(result, {
          requestId: responseRequestId,
          action,
          targetProfileId: decisionContext.targetProfileId,
          latencyMs,
          before,
        });
        analytics.track(
          {
            eventName: action === "like" ? "profile_like" : "profile_pass",
            screenName: "Discover",
            targetProfilePublicId,
            metadata: {
              requestId: responseRequestId,
              action,
              latencyMs,
              queueVersion: result.queueVersion ?? decisionContext.queueVersion,
              policyVersion: result.policyVersion ?? decisionContext.policyVersion,
            },
          },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        analytics.track(
          {
            eventName: "discovery_decision_success",
            screenName: "Discover",
            targetProfilePublicId,
            metadata: { requestId: responseRequestId, action, latencyMs },
          },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        if (latencyMs > 1500) {
          analytics.track(
            {
              eventName: "decision_latency_slow",
              screenName: "Discover",
              metadata: { requestId: responseRequestId, latencyMs },
            },
            { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
          );
        }
        
        // Queue should advance if decision was applied OR if it was idempotent with a valid replacement
        const shouldAdvanceQueue = result.decisionApplied || (
          !result.decisionApplied &&
          (result.decisionRejectedReason === "same_state_existing_decision" ||
           result.decisionRejectedReason === "duplicate_request_id") &&
          result.replacementProfile !== null
        );
        
        const nextFeed = shouldAdvanceQueue
          ? pruneDiscoveryFeedWindow(discoveryFeedRef.current, {
              targetProfileId: result.targetProfileId,
              replacementProfile: result.replacementProfile,
              nextCursor: result.nextCursor,
              hasMore: result.hasMore,
              queueVersion: result.queueVersion ?? discoveryFeedRef.current.queueVersion ?? null,
              policyVersion: result.policyVersion || discoveryFeedRef.current.policyVersion,
              supply: result.supply,
            })
          : discoveryFeedRef.current;
        if (shouldAdvanceQueue) {
          const previousProfileCount = discoveryFeedRef.current.profiles.length;
          const committedFeed = commitDiscoveryFeedState(nextFeed, {
            pendingDecision: null,
          });
          recordDiscoveryQueueTrace({
            event: "queue_after_mutation",
            requestId: responseRequestId,
            queueVersion: committedFeed.queueVersion ?? decisionContext.queueVersion,
            policyVersion: committedFeed.policyVersion ?? null,
            visibleQueue: decisionContext.visibleProfileIds,
            activeProfileId: decisionContext.expectedHeadId,
            action,
            targetProfileId: result.targetProfileId,
            replacementProfileId: result.replacementProfile?.id ?? null,
            resultQueue: getDiscoveryQueueIds(committedFeed.profiles.slice(0, 3)),
            logicalHeadId: decisionContext.expectedHeadId,
            renderedFrontId: decisionContext.renderedFrontId,
            canAct: false,
            source: "decision",
          });
          debugDiscoveryLog("feed_window_progressed", {
            requestId: responseRequestId,
            action,
            targetProfileId: result.targetProfileId,
            previousProfileCount,
            nextProfileCount: committedFeed.profiles.length,
            replacementProfileId: result.replacementProfile?.id ?? null,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            latencyMs,
          });
          setLastServerSyncAt(
            result.threshold.lastDecisionEventAt ||
              committedFeed.supply?.fetchedAt ||
              new Date().toISOString()
          );
          await persistViewerBootstrapCache({
            discovery: {
              ...result,
              feed: committedFeed,
            },
          });
          debugDiscoveryLog("decision_request_completed", {
            requestId: responseRequestId,
            action,
            targetProfileId: result.targetProfileId,
            decisionApplied: result.decisionApplied,
            decisionRejectedReason: result.decisionRejectedReason ?? null,
            queueAction: "append-replacement",
            latencyMs,
          });
          return {
            ...result,
            requestId: responseRequestId,
          };
        }
        updateDiscoveryQueueStatus(deriveDiscoveryQueueStatus(discoveryFeedRef.current));
        await persistViewerBootstrapCache({
          discovery: {
            ...result,
            feed: discoveryFeedRef.current,
          },
        });
        debugDiscoveryLog("decision_request_completed", {
          requestId: responseRequestId,
          action,
          targetProfileId: result.targetProfileId,
          decisionApplied: result.decisionApplied,
          decisionRejectedReason: result.decisionRejectedReason ?? null,
          queueAction: "noop",
          latencyMs,
        });
        return {
          ...result,
          requestId: responseRequestId,
        };
      } catch (error: any) {  
        debugLog("[decision] CATCH BLOCK HIT", {
          errorCode: error?.code,
          errorMessage: error?.message,
          errorStatus: error?.status,
          requestId,
          action,
          targetProfileId: decisionContext.targetProfileId,
        });
        const currentPendingDecision = discoveryPendingDecisionRef.current as {
          requestId: string;
          targetProfileId: number;
        } | null;
        const isCurrentPending =
          currentPendingDecision?.requestId === requestId &&
          currentPendingDecision.targetProfileId === decisionContext.targetProfileId;
        const isTimeoutError =
          error?.code === "NETWORK_REQUEST_FAILED" &&
          typeof error?.message === "string" &&
          error.message.includes("Request timed out");

        if (error?.code === "DISCOVERY_CURSOR_STALE") {
          const latencyMs = Date.now() - startedAt;
          clearDiscoveryDecisionTimeout();
          if (isCurrentPending) {
            updateDiscoveryPendingDecision(null);
          }
          updateDiscoveryQueueStatus("hard_refreshing");
          setDiscoveryQueueLastRequestId(requestId);
          setDiscoveryQueueLastDecisionRejectedReason("cursor_stale");
          recordDiscoveryQueueTrace({
            event: "queue_hard_refresh_started",
            requestId,
            queueVersion: decisionContext.queueVersion,
            policyVersion: decisionContext.policyVersion,
            visibleQueue: decisionContext.visibleProfileIds,
            activeProfileId: decisionContext.expectedHeadId,
            action,
            targetProfileId: decisionContext.targetProfileId,
            decisionRejectedReason: "cursor_stale",
            logicalHeadId: decisionContext.expectedHeadId,
            renderedFrontId: decisionContext.renderedFrontId,
            hasAccessToken: Boolean(accessToken),
            authStatus,
            isOffline: !isOnlineRef.current,
            hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
            canAct: false,
            source: "hard_refresh",
          });
          const refreshedFeed = await refreshDiscoveryFeedState(accessToken, {
            reason: "cursor_stale",
            requestId,
            targetProfileId: decisionContext.targetProfileId,
          }).catch(() => {});
          if (refreshedFeed) {
            return {
              requestId,
              likedProfileIds: likedProfilesRef.current,
              passedProfileIds: passedProfilesRef.current,
              currentDecisionCounts: {
                likes: likedProfilesRef.current.length,
                passes: passedProfilesRef.current.length,
              },
              popularAttributesByCategory: popularAttributesByCategoryRef.current,
              totalLikesCount: totalLikesCountRef.current,
              lifetimeCounts: lifetimeDiscoveryCountsRef.current,
              threshold: discoveryThresholdRef.current,
              goalsUnlock: goalsUnlockStateRef.current,
              lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
              filters: discoveryFiltersRef.current,
              decisionApplied: false as const,
              decisionState: action,
              targetProfileId: decisionContext.targetProfileId,
              decisionRejectedReason: "cursor_stale" as const,
              changedCategories: [],
              shouldShowDiscoveryUpdate: false,
              queueVersion:
                refreshedFeed.queueVersion ?? discoveryFeedRef.current.queueVersion ?? null,
              policyVersion:
                refreshedFeed.policyVersion || discoveryFeedRef.current.policyVersion,
              replacementProfile: null,
              nextCursor: refreshedFeed.nextCursor,
              hasMore: refreshedFeed.hasMore,
              supply: refreshedFeed.supply,
            };
          }
          debugDiscoveryWarn("decision_request_stale_refresh_failed", {
            requestId,
            action,
            targetProfileId: decisionContext.targetProfileId,
            latencyMs,
          });
        }
        if (isCurrentPending) {
          clearDiscoveryDecisionTimeout();
          updateDiscoveryPendingDecision(null);
          updateDiscoveryQueueStatus(deriveDiscoveryQueueStatus(discoveryFeedRef.current));
          setDiscoveryQueueLastRequestId(requestId);
          setDiscoveryQueueLastDecisionRejectedReason(
            isTimeoutError ? "timeout" : error?.code || "request_failed"
          );
        }
        if (isTimeoutError && isCurrentPending) {
          recordDiscoveryQueueTrace({
            event: "queue_decision_timeout",
            requestId,
            queueVersion: decisionContext.queueVersion,
            policyVersion: decisionContext.policyVersion,
            visibleQueue: decisionContext.visibleProfileIds,
            activeProfileId: decisionContext.expectedHeadId,
            action,
            targetProfileId: decisionContext.targetProfileId,
            decisionRejectedReason: "timeout",
            logicalHeadId: decisionContext.expectedHeadId,
            renderedFrontId: decisionContext.renderedFrontId,
            hasAccessToken: Boolean(accessToken),
            authStatus,
            isOffline: !isOnlineRef.current,
            hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
            canAct: false,
            source: "decision",
            note: error?.message || `Decision request exceeded ${DEFAULT_REQUEST_TIMEOUT_MS}ms`,
            errorCode: error?.code ?? null,
          });
        } else if (isCurrentPending) {
          recordDiscoveryQueueTrace({
            event: "queue_network_error",
            requestId,
            queueVersion: decisionContext.queueVersion,
            policyVersion: decisionContext.policyVersion,
            visibleQueue: decisionContext.visibleProfileIds,
            activeProfileId: decisionContext.expectedHeadId,
            action,
            targetProfileId: decisionContext.targetProfileId,
            decisionRejectedReason: error?.code || "request_failed",
            logicalHeadId: decisionContext.expectedHeadId,
            renderedFrontId: decisionContext.renderedFrontId,
            hasAccessToken: Boolean(accessToken),
            authStatus,
            isOffline: !isOnlineRef.current,
            hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
            canAct: false,
            source: "decision",
            note: error?.message || "UNKNOWN_ERROR",
            errorCode: error?.code ?? null,
          });
        }
        analytics.track(
          {
            eventName: "discovery_decision_failed",
            screenName: "Discover",
            targetProfilePublicId,
            metadata: {
              requestId,
              action,
              errorCode: error?.code || "request_failed",
            },
          },
          { accessToken: accessTokenRef.current, sessionId: analyticsSessionIdRef.current }
        );
        return null;
      }
    },
    [
      accessToken,
      applyDiscoveryPreferenceResult,
      clearDiscoveryDecisionTimeout,
      clearQueuedDiscoveryDecisions,
      commitDiscoveryFeedState,
      persistViewerBootstrapCache,
      recordDiscoveryQueueTrace,
      refreshDiscoveryFeedState,
      updateDiscoveryPendingDecision,
      updateDiscoveryQueueStatus,
    ]
  );

  const processDiscoveryDecisionQueue = useCallback(async () => {
    if (discoveryDecisionQueueDrainingRef.current) {
      return;
    }
    if (!accessToken || !isOnlineRef.current || discoveryPendingDecisionRef.current) {
      return;
    }

    discoveryDecisionQueueDrainingRef.current = true;
    try {
      while (
        accessToken &&
        isOnlineRef.current &&
        !discoveryPendingDecisionRef.current &&
        discoveryQueuedDecisionsRef.current.length
      ) {
        const [nextDecision, ...remaining] = discoveryQueuedDecisionsRef.current;
        setDiscoveryQueuedDecisions(remaining);
        const result = await executeDiscoveryDecisionRequest(nextDecision);
        nextDecision.resolve(result);
        if (!result || result.decisionRejectedReason === "cursor_stale") {
          clearQueuedDiscoveryDecisions(
            result?.decisionRejectedReason === "cursor_stale"
              ? "cursor_stale_refresh"
              : "queued_decision_request_failed"
          );
          break;
        }
      }
    } finally {
      discoveryDecisionQueueDrainingRef.current = false;
      if (!discoveryPendingDecisionRef.current) {
        updateDiscoveryQueueStatus(
          deriveDiscoveryQueueStatus(discoveryFeedRef.current, {
            queuedDecisionCount: discoveryQueuedDecisionsRef.current.length,
          })
        );
      }
    }
  }, [
    accessToken,
    clearQueuedDiscoveryDecisions,
    executeDiscoveryDecisionRequest,
    setDiscoveryQueuedDecisions,
    updateDiscoveryQueueStatus,
  ]);

  useEffect(() => {
    if (!accessToken || !isOnline || discoveryPendingDecision || !discoveryQueuedDecisionCount) {
      return;
    }
    void processDiscoveryDecisionQueue();
  }, [
    accessToken,
    discoveryPendingDecision,
    discoveryQueuedDecisionCount,
    isOnline,
    processDiscoveryDecisionQueue,
  ]);

  const submitDiscoveryDecision = useCallback(
    async (
      action: DiscoveryDecisionAction,
      requestDecision: DiscoveryDecisionRequester,
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">,
      options?: DiscoveryDecisionOptions
    ) => {
      debugLog("[decision] submitDiscoveryDecision called", {
        action,
        hasAccessToken: Boolean(accessToken),
        isOnline: isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        queuedDecisionCount: discoveryQueuedDecisionsRef.current.length,
        targetProfileId: normalizeDiscoveryProfileId(
          options?.decisionContext?.targetProfileId ?? profile.id
        ),
      });
      const fallbackTargetProfileId =
        normalizeDiscoveryProfileId(profile.id) ??
        normalizeDiscoveryProfileId(options?.renderedFrontId) ??
        normalizeDiscoveryProfileId(discoveryFeedRef.current.profiles[0]?.id) ??
        Date.now();
      const fallbackRequestId =
        options?.decisionContext?.requestId?.trim() ||
        options?.requestId?.trim() ||
        createDiscoveryDecisionRequestId(action, fallbackTargetProfileId);
      const fallbackVisibleQueue = getDiscoveryQueueIds(
        discoveryFeedRef.current.profiles.slice(0, 3)
      );
      const fallbackQueueVersion = normalizeDiscoveryQueueVersion(
        discoveryFeedRef.current.queueVersion
      );
      const rawDecisionContext =
        options?.decisionContext ??
        ({
          requestId: fallbackRequestId,
          action,
          targetProfileId: fallbackTargetProfileId,
          expectedHeadId: fallbackVisibleQueue[0] ?? fallbackTargetProfileId,
          visibleProfileIds: fallbackVisibleQueue,
          queueVersion: fallbackQueueVersion,
          policyVersion: discoveryFeedRef.current.policyVersion ?? null,
          renderedFrontId:
            normalizeDiscoveryProfileId(options?.renderedFrontId ?? profile.id) ?? null,
          tapSource: options?.tapSource ?? null,
        } satisfies DiscoveryDecisionContext);
      const requestId =
        typeof rawDecisionContext.requestId === "string" &&
        rawDecisionContext.requestId.trim().length
          ? rawDecisionContext.requestId.trim()
          : fallbackRequestId;
      const visibleQueueAtStart = Array.isArray(rawDecisionContext.visibleProfileIds)
        ? rawDecisionContext.visibleProfileIds
            .map((item) => normalizeDiscoveryProfileId(item))
            .filter((item): item is number => item !== null)
        : fallbackVisibleQueue;
      const logicalHeadIdAtStart =
        normalizeDiscoveryProfileId(rawDecisionContext.expectedHeadId) ??
        visibleQueueAtStart[0] ??
        null;
      const targetProfileIdAtStart =
        normalizeDiscoveryProfileId(rawDecisionContext.targetProfileId) ??
        fallbackTargetProfileId;
      const renderedFrontIdAtStart =
        normalizeDiscoveryProfileId(rawDecisionContext.renderedFrontId) ?? null;
      const queueVersionAtStart =
        normalizeDiscoveryQueueVersion(rawDecisionContext.queueVersion) ??
        fallbackQueueVersion;
      recordDiscoveryQueueTrace({
        event: "decision_submit_started",
        requestId,
        queueVersion: queueVersionAtStart,
        policyVersion: rawDecisionContext.policyVersion ?? discoveryFeedRef.current.policyVersion ?? null,
        visibleQueue: visibleQueueAtStart,
        activeProfileId: logicalHeadIdAtStart,
        action,
        targetProfileId: targetProfileIdAtStart,
        logicalHeadId: logicalHeadIdAtStart,
        renderedFrontId: renderedFrontIdAtStart,
        hasAccessToken: Boolean(accessToken),
        isOnline: isOnlineRef.current,
        canAct: discoveryIdsEqual(logicalHeadIdAtStart, targetProfileIdAtStart),
        source: "decision",
      });
      recordDiscoveryQueueTrace({
        event: "decision_auth_context_snapshot",
        requestId,
        queueVersion: queueVersionAtStart,
        policyVersion: rawDecisionContext.policyVersion ?? discoveryFeedRef.current.policyVersion ?? null,
        visibleQueue: visibleQueueAtStart,
        activeProfileId: logicalHeadIdAtStart,
        action,
        targetProfileId: targetProfileIdAtStart,
        logicalHeadId: logicalHeadIdAtStart,
        renderedFrontId: renderedFrontIdAtStart,
        hasAccessToken: Boolean(accessToken),
        authStatus,
        isRefreshingToken: false,
        sessionId: null,
        accessTokenAgeMs: null,
        isOffline: !isOnlineRef.current,
        hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
        canAct: discoveryIdsEqual(logicalHeadIdAtStart, targetProfileIdAtStart),
        source: "decision",
      });
      if (!accessToken || !isOnlineRef.current) {
        setDiscoveryQueueLastRequestId(requestId);
        setDiscoveryQueueLastDecisionRejectedReason(
          !accessToken ? "missing_access_token" : "offline"
        );
        recordDiscoveryQueueTrace({
          event: "queue_action_blocked",
          requestId,
          queueVersion: queueVersionAtStart,
          policyVersion: rawDecisionContext.policyVersion ?? discoveryFeedRef.current.policyVersion ?? null,
          visibleQueue: visibleQueueAtStart,
          activeProfileId: logicalHeadIdAtStart,
          action,
          targetProfileId: targetProfileIdAtStart,
          logicalHeadId: logicalHeadIdAtStart,
          renderedFrontId: renderedFrontIdAtStart,
          decisionRejectedReason: !accessToken ? "missing_access_token" : "offline",
          hasAccessToken: Boolean(accessToken),
          authStatus,
          isOnline: isOnlineRef.current,
          isOffline: !isOnlineRef.current,
          hasPendingDecision: Boolean(discoveryPendingDecisionRef.current),
          canAct: false,
          source: "decision",
          note:
            !accessToken
              ? "Decision blocked: missing access token"
              : "Decision blocked: offline",
        });
        return null;
      }
      const validatedDecisionContext = validateDiscoveryDecisionContext(
        rawDecisionContext,
        action
      );
      if (!validatedDecisionContext.ok) {
        setDiscoveryQueueLastRequestId(requestId);
        setDiscoveryQueueLastDecisionRejectedReason("malformed_snapshot");
        recordDiscoveryQueueTrace({
          event: "queue_action_blocked",
          requestId,
          queueVersion: queueVersionAtStart,
          policyVersion: rawDecisionContext.policyVersion ?? discoveryFeedRef.current.policyVersion ?? null,
          visibleQueue: visibleQueueAtStart,
          activeProfileId: logicalHeadIdAtStart,
          action,
          targetProfileId: targetProfileIdAtStart,
          logicalHeadId: logicalHeadIdAtStart,
          renderedFrontId: renderedFrontIdAtStart,
          decisionRejectedReason: "malformed_snapshot",
          hasAccessToken: Boolean(accessToken),
          authStatus,
          isOnline: isOnlineRef.current,
          isOffline: !isOnlineRef.current,
          hasPendingDecision: false,
          canAct: false,
          source: "decision",
          note: validatedDecisionContext.note,
        });
        return null;
      }
      const decisionContext = validatedDecisionContext.value;
      const targetProfilePublicId =
        normalizeDiscoveryPublicId(profile.publicId) ??
        normalizeDiscoveryPublicId(
          discoveryFeedRef.current.profiles.find(
            (candidate) =>
              normalizeDiscoveryProfileId(candidate.id) === decisionContext.targetProfileId
          )?.publicId
        ) ??
        null;
      const visibleProfilePublicIds = resolveVisibleProfilePublicIds(
        discoveryFeedRef.current.profiles,
        decisionContext.visibleProfileIds
      );
      const shouldSimulateCursorStale =
        __DEV__ && simulateNextDiscoveryCursorStaleRef.current;
      if (shouldSimulateCursorStale) {
        simulateNextDiscoveryCursorStaleRef.current = false;
      }
      const currentVisibleQueue = discoveryFeedRef.current.profiles.slice(0, 3);
      const currentVisibleQueueIds = getDiscoveryQueueIds(currentVisibleQueue);
      if (
        currentVisibleQueueIds.length &&
        (currentVisibleQueueIds.length !== decisionContext.visibleProfileIds.length ||
          currentVisibleQueueIds.some(
            (profileId, index) => profileId !== decisionContext.visibleProfileIds[index]
          ) ||
          !discoveryIdsEqual(currentVisibleQueueIds[0], decisionContext.expectedHeadId))
      ) {
        debugDiscoveryLog("decision_snapshot_drift", {
          requestId: decisionContext.requestId,
          action,
          targetProfileId: decisionContext.targetProfileId,
          expectedHeadId: decisionContext.expectedHeadId,
          snapshotVisibleQueue: decisionContext.visibleProfileIds,
          currentVisibleQueue: currentVisibleQueueIds,
          renderedFrontId: decisionContext.renderedFrontId,
        });
      }

      const resultPromise = new Promise<DiscoveryLikeResponse | null>((resolve) => {
        const nextQueuedDecision: DiscoveryQueuedDecision = {
          action,
          requestDecision,
          profile,
          decisionContext,
          targetProfilePublicId,
          visibleProfilePublicIds,
          shouldSimulateCursorStale,
          resolve,
        };
        const nextQueue = [...discoveryQueuedDecisionsRef.current, nextQueuedDecision];
        setDiscoveryQueuedDecisions(nextQueue);
        updateDiscoveryQueueStatus(
          deriveDiscoveryQueueStatus(discoveryFeedRef.current, {
            pendingDecision: discoveryPendingDecisionRef.current,
            queuedDecisionCount: nextQueue.length,
          })
        );
      });

      void processDiscoveryDecisionQueue();
      return resultPromise;
    },
    [
      accessToken,
      authStatus,
      processDiscoveryDecisionQueue,
      recordDiscoveryQueueTrace,
      setDiscoveryQueuedDecisions,
      updateDiscoveryQueueStatus,
    ]
  );

  const armDiscoveryCursorStaleSimulation = useCallback(() => {
    if (__DEV__) {
      simulateNextDiscoveryCursorStaleRef.current = true;
    }
  }, []);

  const likeProfile = useCallback(
    async (
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">,
      options?: DiscoveryDecisionOptions
    ) => submitDiscoveryDecision("like", likeDiscoveryProfile, profile, options),
    [submitDiscoveryDecision]
  );

  const passProfile = useCallback(
    async (
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "publicId" | "categoryValues">,
      options?: DiscoveryDecisionOptions
    ) => submitDiscoveryDecision("pass", passDiscoveryProfile, profile, options),
    [submitDiscoveryDecision]
  );

  const resetDiscoveryHistory = useCallback(async () => {
    if (!accessToken) {
      setLikedProfiles([]);
      setPassedProfiles([]);
      setPopularAttributesByCategory(createEmptyPopularAttributesByCategory());
      setTotalLikesCount(0);
      setLifetimeDiscoveryCounts(createEmptyLifetimeDiscoveryCounts());
      setDiscoveryThreshold(createEmptyDiscoveryThreshold());
      setGoalsUnlockState(createEmptyGoalsUnlockState());
      setGoalsUnlockPromptVisible(false);
      clearDiscoveryDecisionTimeout();
      clearQueuedDiscoveryDecisions("discovery_history_reset");
      updateDiscoveryPendingDecision(null);
      setDiscoveryQueueInvariantViolation(null);
      setDiscoveryQueueLastRequestId(null);
      setDiscoveryQueueLastDecisionRejectedReason(null);
      setDiscoveryQueueLastReplacementProfileId(null);
      commitDiscoveryFeedState(createEmptyDiscoveryFeed(), {
        pendingDecision: null,
      });
      setSessionSwipeCounts({ likes: 0, dislikes: 0 });
      await persistViewerBootstrapCache({
        discovery: {
          likedProfileIds: [],
          passedProfileIds: [],
          currentDecisionCounts: {
            likes: 0,
            passes: 0,
          },
          popularAttributesByCategory: createEmptyPopularAttributesByCategory(),
          totalLikesCount: 0,
          lifetimeCounts: createEmptyLifetimeDiscoveryCounts(),
          threshold: createEmptyDiscoveryThreshold(),
          goalsUnlock: createEmptyGoalsUnlockState(),
          lastNotifiedPopularModeChangeAtLikeCount: 0,
          filters: discoveryFiltersRef.current,
          feed: createEmptyDiscoveryFeed(),
        },
      });
      return true;
    }

    try {
      const result = await resetDiscoveryHistoryRequest(accessToken);
      setLikedProfiles(result.likedProfileIds);
      setPassedProfiles(result.passedProfileIds);
      setPopularAttributesByCategory(result.popularAttributesByCategory);
      setTotalLikesCount(getAuthoritativeTotalLikesCount(result));
      setLifetimeDiscoveryCounts(result.lifetimeCounts);
      setDiscoveryThreshold(result.threshold);
      setGoalsUnlockState(result.goalsUnlock);
      setGoalsUnlockPromptVisible(Boolean(result.goalsUnlock.unlockMessagePending));
      const refreshedFeed = await refreshDiscoveryFeedState(accessToken);
      setSessionSwipeCounts({ likes: 0, dislikes: 0 });
      await persistViewerBootstrapCache({
        discovery: result,
      });
      return true;
    } catch {
      return false;
    }
  }, [
    accessToken,
    clearDiscoveryDecisionTimeout,
    commitDiscoveryFeedState,
    persistViewerBootstrapCache,
    refreshDiscoveryFeedState,
    updateDiscoveryPendingDecision,
  ]);

  const refreshDiscoveryCandidates = useCallback(async () => {
    if (!accessToken) {
      debugDiscoveryWarn("authoritative_window_skipped", {
        reason: "no_access_token",
      });
      return false;
    }

    try {
      debugDiscoveryLog("authoritative_window_fetch", {
        reason: "refresh_candidates",
        hasAccessToken: Boolean(accessToken),
        isOnline: isOnlineRef.current,
      });
      await refreshDiscoveryFeedState(accessToken, {
        reason: "refresh_candidates",
      });
      return true;
    } catch {
      return false;
    }
  }, [accessToken, refreshDiscoveryFeedState]);

  const fetchNextDiscoveryWindow = useCallback(async () => {
    if (!accessToken || !isOnlineRef.current) {
      return false;
    }

    try {
      const currentFeed = discoveryFeedRef.current;
      if (!currentFeed.hasMore || !currentFeed.nextCursor) {
        return false;
      }
      await appendDiscoveryFeedWindow(accessToken);
      return true;
    } catch {
      return false;
    }
  }, [accessToken, appendDiscoveryFeedWindow]);

  const saveDiscoveryFilters = useCallback(
    async (filters: DiscoveryFilters) => {
      if (!isOnlineRef.current) {
        setAuthError("NETWORK_UNAVAILABLE");
        return false;
      }
      const nextFilters = {
        ...DEFAULT_DISCOVERY_FILTERS,
        ...filters,
      };
      const requestId = `discovery_filters_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      debugDiscoveryLog("filters_update_started", {
        requestId,
        nextFilters,
        previousQueueVersion: discoveryFeedRef.current.queueVersion ?? null,
      });

      setDiscoveryFilters(nextFilters);
      if (user?.id) {
        await persistDiscoveryFiltersForUser(user.id, nextFilters);
      }
      clearDiscoveryDecisionTimeout();
      clearQueuedDiscoveryDecisions("discovery_filters_changed");
      updateDiscoveryPendingDecision(null);
      setDiscoveryQueueInvariantViolation(null);
      setDiscoveryQueueLastRequestId(null);
      setDiscoveryQueueLastDecisionRejectedReason(null);
      setDiscoveryQueueLastReplacementProfileId(null);
      commitDiscoveryFeedState(createEmptyDiscoveryFeed(), {
        pendingDecision: null,
      });
      await persistViewerBootstrapCache({
        discovery: {
          likedProfileIds: likedProfilesRef.current,
          passedProfileIds: passedProfilesRef.current,
          currentDecisionCounts: {
            likes: likedProfilesRef.current.length,
            passes: passedProfilesRef.current.length,
          },
          popularAttributesByCategory: popularAttributesByCategoryRef.current,
          totalLikesCount: totalLikesCountRef.current,
          lifetimeCounts: lifetimeDiscoveryCountsRef.current,
          threshold: discoveryThresholdRef.current,
          goalsUnlock: goalsUnlockStateRef.current,
          lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
          filters: nextFilters,
        },
      });

      if (!accessToken) {
        debugDiscoveryWarn("filters_update_skipped_missing_access_token", {
          requestId,
          nextFilters,
          sessionOfflineFallback,
          authStatus,
        });
        setAuthError("SESSION_NOT_READY");
        return false;
      }

      try {
        const result = await updateDiscoveryPreferences(accessToken, nextFilters, {
          headers: {
            "X-Matcha-Request-Id": requestId,
          },
        });
        const refreshedFeed = await refreshDiscoveryFeedState(accessToken, {
          reason: "filters_updated",
          requestId,
        });
        const syncedFilters = {
          ...DEFAULT_DISCOVERY_FILTERS,
          ...(result.filters || {}),
        };
        setDiscoveryFilters(syncedFilters);
        if (user?.id) {
          await persistDiscoveryFiltersForUser(user.id, syncedFilters);
        }
        await persistViewerBootstrapCache({
          discovery: {
            likedProfileIds: likedProfilesRef.current,
            passedProfileIds: passedProfilesRef.current,
            currentDecisionCounts: {
              likes: likedProfilesRef.current.length,
              passes: passedProfilesRef.current.length,
            },
            popularAttributesByCategory: popularAttributesByCategoryRef.current,
            totalLikesCount: totalLikesCountRef.current,
            lifetimeCounts: lifetimeDiscoveryCountsRef.current,
            threshold: discoveryThresholdRef.current,
            goalsUnlock: goalsUnlockStateRef.current,
            lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
            filters: syncedFilters,
            feed: refreshedFeed,
          },
        });
        debugDiscoveryLog("filters_update_succeeded", {
          requestId,
          queueVersion: refreshedFeed.queueVersion ?? null,
          profileCount: refreshedFeed.profiles.length,
        });
        return true;
      } catch (e: any) {
        debugDiscoveryWarn("filters_update_failed", {
          requestId,
          code: e?.code || null,
          message: e?.message || "UNKNOWN_ERROR",
        });
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      }
    },
    [
      accessToken,
      authStatus,
      persistDiscoveryFiltersForUser,
      persistViewerBootstrapCache,
      refreshDiscoveryFeedState,
      sessionOfflineFallback,
      user?.id,
    ]
  );

  const setProfilePhoto = useCallback(
    async (index: number, uri: string) => {
      const currentProfile = profileRef.current;
      const currentPhotos = normalizeStoredProfilePhotos(currentProfile.photos);
      const optimisticPhoto: UserProfilePhoto = {
        localUri: uri,
        remoteUrl: "",
        mediaAssetId: null,
        profileImageId: null,
        sortOrder: index,
        status: "pending",
      };
      const optimisticPhotos = [
        ...currentPhotos.filter((photo) => photo.sortOrder !== index),
        optimisticPhoto,
      ]
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const optimisticProfile = normalizeStoredProfile({
        ...currentProfile,
        photos: optimisticPhotos,
      });
      profileRef.current = optimisticProfile;
      setProfile(optimisticProfile);

      if (!accessToken) {
        const localPhoto = {
          ...optimisticPhoto,
          status: "ready" as const,
        };
        const localProfile = normalizeStoredProfile({
          ...profileRef.current,
          photos: optimisticPhotos
            .filter((photo) => photo.sortOrder !== index)
            .concat(localPhoto)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        });
        profileRef.current = localProfile;
        setProfile(localProfile);
        return localPhoto;
      }

      try {
        await enqueueMutation<ProfilePhotoUploadPayload>({
          userId: userRef.current?.id || 0,
          type: "profile_photo_upload",
          targetKey: getPhotoMutationTargetStorageKey(index),
          canonicalPayload: {
            slot: index,
            localUri: uri,
          },
        });
        debugLog("[media] upload queued", {
          slot: index,
          targetKey: getPhotoMutationTargetStorageKey(index),
        });
        void replayMutationQueue();
        return optimisticPhoto;
      } catch (error: any) {
        debugWarn("[media] upload failed", {
          slot: index,
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        });
        const failedPhoto: UserProfilePhoto = {
          ...optimisticPhoto,
          status: "error",
        };
        const failedProfile = normalizeStoredProfile({
          ...profileRef.current,
          photos: optimisticPhotos
            .filter((photo) => photo.sortOrder !== index)
            .concat(failedPhoto)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        });
        profileRef.current = failedProfile;
        setProfile(failedProfile);
        return failedPhoto;
      }
    },
    [accessToken, replayMutationQueue]
  );

  const removeProfilePhoto = useCallback(
    async (index: number) => {
      const currentProfile = profileRef.current;
      const photoToRemove = getProfilePhotoBySortOrder(currentProfile.photos, index);
      const nextPhotos = normalizeStoredProfilePhotos(currentProfile.photos).filter(
        (photo) => photo.sortOrder !== index
      );

      const nextUiProfile = normalizeStoredProfile({
        ...currentProfile,
        photos: nextPhotos,
      });
      profileRef.current = nextUiProfile;
      setProfile(nextUiProfile);

      if (isStoredProfilePhoto(photoToRemove?.localUri)) {
        await deleteStoredProfilePhoto(photoToRemove?.localUri).catch(() => {});
      }

      if (accessToken && userRef.current?.id) {
        await enqueueMutation<ProfilePhotoDeletePayload>({
          userId: userRef.current.id,
          type: "profile_photo_delete",
          targetKey: getPhotoMutationTargetStorageKey(index),
          canonicalPayload: {
            slot: index,
            profileImageId: photoToRemove?.profileImageId || null,
            localUri: photoToRemove?.localUri || "",
          },
        });
        void replayMutationQueue();
      }
    },
    [accessToken, replayMutationQueue]
  );

  const recordDiscoverySwipe = useCallback(
    (
      direction: "left" | "right",
      options?: { requestId?: string; targetProfileId?: number }
    ) => {
      setSessionSwipeCounts((current) => {
        const next =
          direction === "right"
            ? { ...current, likes: current.likes + 1 }
            : { ...current, dislikes: current.dislikes + 1 };
        debugDiscoveryLog("session_counters_incremented", {
          requestId: options?.requestId || null,
          targetProfileId: options?.targetProfileId || null,
          direction,
          before: current,
          after: next,
        });
        return next;
      });
    },
    []
  );

  const dismissGoalsUnlockPrompt = useCallback(async () => {
    setGoalsUnlockPromptVisible(false);
    if (!goalsUnlockStateRef.current.unlockMessagePending || !accessToken) {
      return Boolean(accessToken) || !goalsUnlockStateRef.current.unlockMessagePending;
    }

    try {
      const nextUnlockState = await acknowledgeGoalsUnlockSeenRequest(accessToken);
      setGoalsUnlockState(nextUnlockState);
      await persistViewerBootstrapCache({
        discovery: {
          likedProfileIds: likedProfilesRef.current,
          passedProfileIds: passedProfilesRef.current,
          currentDecisionCounts: {
            likes: likedProfilesRef.current.length,
            passes: passedProfilesRef.current.length,
          },
          popularAttributesByCategory: popularAttributesByCategoryRef.current,
          totalLikesCount: totalLikesCountRef.current,
          lifetimeCounts: lifetimeDiscoveryCountsRef.current,
          threshold: discoveryThresholdRef.current,
          goalsUnlock: nextUnlockState,
          lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
          filters: discoveryFiltersRef.current,
          feed: discoveryFeedRef.current,
        },
      });
      return true;
    } catch {
      return false;
    }
  }, [accessToken, persistViewerBootstrapCache]);

  const discoveryQueueRuntime = useMemo<DiscoveryQueueRuntime>(
    () => ({
      queue: {
        items: buildDiscoveryQueueSlots(discoveryFeed.profiles),
        queueVersion: discoveryFeed.queueVersion ?? null,
        policyVersion: discoveryFeed.policyVersion ?? null,
        nextCursor: discoveryFeed.nextCursor,
        hasMore: discoveryFeed.hasMore,
        source:
          discoveryQueueStatus === "hard_refreshing"
            ? "hard_refresh"
            : discoveryPendingDecision || discoveryQueuedDecisionCount > 0
              ? "decision"
              : "window",
        generatedAt: discoveryFeed.generatedAt ?? null,
        invalidationReason: discoveryFeed.queueInvalidationReason ?? null,
      },
      status: discoveryQueueStatus,
      pendingDecision: discoveryPendingDecision,
      queuedDecisionCount: discoveryQueuedDecisionCount,
      lastRequestId: discoveryQueueLastRequestId,
      lastDecisionRejectedReason: discoveryQueueLastDecisionRejectedReason,
      lastReplacementProfileId: discoveryQueueLastReplacementProfileId,
      invariantViolation: discoveryQueueInvariantViolation,
      traceSeq: discoveryQueueTraceSeq,
      traceBuffer: discoveryQueueTraceBuffer,
    }),
    [
      discoveryFeed,
      discoveryPendingDecision,
      discoveryQueuedDecisionCount,
      discoveryQueueInvariantViolation,
      discoveryQueueLastDecisionRejectedReason,
      discoveryQueueLastReplacementProfileId,
      discoveryQueueLastRequestId,
      discoveryQueueStatus,
      discoveryQueueTraceBuffer,
      discoveryQueueTraceSeq,
    ]
  );

  const biometricLockRequired =
    accessState === "authenticated_locked" || accessState === "unlocking";

  const trackAnalyticsEvent = useCallback<AppContextType["trackAnalyticsEvent"]>(
    (eventName, payload = {}) => {
      analytics.track(
        {
          eventName,
          screenName: payload.screenName,
          areaName: payload.areaName,
          durationMs: payload.durationMs,
          targetProfilePublicId: payload.targetProfilePublicId,
          targetProfileKind: payload.targetProfileKind,
          targetProfileBatchKey: payload.targetProfileBatchKey,
          metadata: payload.metadata,
        },
        {
          accessToken: accessTokenRef.current,
          sessionId: analyticsSessionIdRef.current,
        }
      );
    },
    []
  );

  const recordAnalyticsScreenTime = useCallback<AppContextType["recordAnalyticsScreenTime"]>(
    (input) => {
      analytics.screenTime({
        accessToken: accessTokenRef.current,
        sessionId: analyticsSessionIdRef.current,
        ...input,
      });
    },
    []
  );

  const recordAnalyticsProfileCardTime = useCallback<AppContextType["recordAnalyticsProfileCardTime"]>(
    (input) => {
      analytics.profileCardTime({
        accessToken: accessTokenRef.current,
        sessionId: analyticsSessionIdRef.current,
        targetProfileKind: "unknown",
        decidedAt: new Date().toISOString(),
        ...input,
      });
    },
    []
  );

  useEffect(() => {
    if (!analytics.enabled || authStatus !== "authenticated" || !accessToken || lastAppState !== "active") {
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!analyticsSessionIdRef.current) {
        analyticsSessionIdRef.current = await analytics.startSession(accessToken);
        analytics.track(
          { eventName: "app_opened", metadata: { source: "app_lifecycle" } },
          { accessToken, sessionId: analyticsSessionIdRef.current }
        );
        analytics.track(
          { eventName: "session_started", metadata: { source: "app_lifecycle" } },
          { accessToken, sessionId: analyticsSessionIdRef.current }
        );
      } else {
        analytics.track(
          { eventName: "app_foregrounded", metadata: { source: "app_lifecycle" } },
          { accessToken, sessionId: analyticsSessionIdRef.current }
        );
      }
      await analytics.flush(accessToken, analyticsSessionIdRef.current);
      if (cancelled) return;
      if (analyticsHeartbeatRef.current) {
        clearInterval(analyticsHeartbeatRef.current);
      }
      analyticsHeartbeatRef.current = setInterval(() => {
        analytics.heartbeat(accessTokenRef.current, analyticsSessionIdRef.current);
        analytics.track(
          { eventName: "session_heartbeat", metadata: { source: "app_lifecycle" } },
          {
            accessToken: accessTokenRef.current,
            sessionId: analyticsSessionIdRef.current,
          }
        );
      }, analyticsHeartbeatIntervalSeconds * 1000);
    })();

    return () => {
      cancelled = true;
      if (analyticsHeartbeatRef.current) {
        clearInterval(analyticsHeartbeatRef.current);
        analyticsHeartbeatRef.current = null;
      }
    };
  }, [accessToken, authStatus, lastAppState]);

  return (
    <AppContext.Provider
      value={{
        authStatus,
        postAuthRedirectRoute,
        clearPostAuthRedirectRoute,
        login,
        logout,
        signIn,
        signUp,
        signInWithProvider,
        user,
        authBusy,
        authError,
        hasAccessToken: Boolean(accessToken),
        isOnline,
        serverHealthStatus,
        lastServerHealthAt,
        lastServerHealthFailureReason,
        authFormPrefill,
        pendingVerificationEmail,
        verificationStatus,
        checkPendingVerificationStatus,
        resendPendingVerificationEmail,
        resetPendingVerificationState,
        handleAuthCallback,
        clearAuthFeedback,
        providerAvailability,
        needsProfileCompletion,
        hasCompletedOnboarding,
        onboardingAccessState,
        resolvedAccessGate,
        completeProfile,
        onboardingResumeStep,
        setOnboardingResumeStep,
        saveOnboardingDraft,
        finishOnboarding,
        accessState,
        biometricLockRequired,
        biometricBusy,
        biometricsEnabled,
        bootstrapComplete,
        appReadyForBiometric,
        lockCycleId,
        deferredReplayPending,
        lastLockTrigger,
        lastBiometricErrorCode,
        beginBiometricUnlock,
        setLockScreenPresence,
        forceLogoutForBiometricPolicy,
        setBiometricsEnabled,
        language,
        setLanguage,
        heightUnit,
        setHeightUnit,
        saveSettings,
        settingsSaveState,
        deleteAccount,
        t,
        goals,
        completeGoalTask,
        reorderGoalTasks,
        sessionSwipeCounts,
        lifetimeDiscoveryCounts,
        discoveryThreshold,
        goalsUnlockState,
        goalsUnlockPromptVisible,
        recordDiscoverySwipe,
        dismissGoalsUnlockPrompt,
        popularAttributesByCategory,
        totalLikesCount,
        likedProfiles,
        passedProfiles,
        discoveryFeed,
        discoveryQueueRuntime,
        discoveryFilters,
        discoveryViewPreferences,
        lastServerSyncAt,
        sessionOfflineFallback,
        saveDiscoveryFilters,
        setDiscoveryViewPreferences,
        likeProfile,
        passProfile,
        refreshDiscoveryCandidates,
        fetchNextDiscoveryWindow,
        resetDiscoveryHistory,
        armDiscoveryCursorStaleSimulation,
        trackAnalyticsEvent,
        recordAnalyticsScreenTime,
        recordAnalyticsProfileCardTime,
        recordDiscoveryQueueTrace,
        profile,
        accountProfile,
        profileSaveStates,
        saveProfileChanges,
        updateProfileField,
        setProfilePhoto,
        removeProfilePhoto,
        refreshProfileLocation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
