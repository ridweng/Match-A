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
import { AppState, Keyboard, Platform } from "react-native";

import {
  acknowledgeGoalsUnlockSeen as acknowledgeGoalsUnlockSeenRequest,
  type AuthCallbackPayload,
  type AuthUser,
  type DiscoveryFilters,
  type DiscoveryFeedResponse,
  type DiscoveryFeedProfileResponse,
  type DiscoveryLikeResponse,
  type DiscoveryPreferencesResponse,
  type ViewerBootstrapResponse,
  type ProviderAvailability,
  type AuthProvider,
  checkVerificationStatus as authCheckVerificationStatus,
  completeGoal as completeGoalRequest,
  DEFAULT_DISCOVERY_FILTERS,
  deleteAccount as deleteAccountRequest,
  deleteProfilePhoto as deleteProfilePhotoRequest,
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

type BiometricResult = { ok: boolean; code?: string };
type DiscoveryViewPreferences = {
  selectedTab: "discover" | "filters";
  cardDensity: "comfortable" | "compact";
  reduceMotion: boolean;
};

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
  authFormPrefill: AuthFormPrefill | null;
  pendingVerificationEmail: string | null;
  verificationStatus: VerificationStatus;
  checkPendingVerificationStatus: () => Promise<"pending" | "verified" | null>;
  resetPendingVerificationState: () => void;
  handleAuthCallback: (payload: AuthCallbackPayload) => Promise<boolean>;
  clearAuthFeedback: () => void;
  providerAvailability: ProviderAvailability;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
  completeProfile: (data: { name: string; dateOfBirth: string }) => Promise<boolean>;
  saveOnboardingDraft: (data: {
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
  }) => Promise<boolean>;
  finishOnboarding: () => Promise<boolean>;
  biometricLockRequired: boolean;
  biometricBusy: boolean;
  biometricsEnabled: boolean;
  unlockWithBiometrics: () => Promise<BiometricResult>;
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
  discoveryFilters: DiscoveryFilters;
  discoveryViewPreferences: DiscoveryViewPreferences;
  lastServerSyncAt: string | null;
  sessionOfflineFallback: boolean;
  saveDiscoveryFilters: (filters: DiscoveryFilters) => Promise<boolean>;
  setDiscoveryViewPreferences: (
    updates: Partial<DiscoveryViewPreferences>
  ) => Promise<void>;
  likeProfile: (
    profile: Pick<DiscoveryFeedProfileResponse, "id" | "categoryValues">,
    options?: DiscoveryDecisionOptions
  ) => Promise<DiscoveryLikeResponse | null>;
  passProfile: (
    profile: Pick<DiscoveryFeedProfileResponse, "id" | "categoryValues">,
    options?: DiscoveryDecisionOptions
  ) => Promise<DiscoveryLikeResponse | null>;
  refreshDiscoveryCandidates: () => Promise<boolean>;
  fetchNextDiscoveryWindow: () => Promise<boolean>;
  resetDiscoveryHistory: () => Promise<boolean>;
  profile: UserProfile;
  accountProfile: AccountProfile;
  profileSaveStates: Partial<Record<ProfileEditableField, ProfileFieldSaveState>>;
  updateProfileField: <K extends ProfileEditableField>(
    field: K,
    value: UserProfile[K]
  ) => void;
  setProfilePhoto: (index: number, uri: string) => Promise<UserProfilePhoto | null>;
  removeProfilePhoto: (index: number) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const DISCOVERY_FILTERS_STORAGE_KEY = "discoveryFiltersByUser";
const DISCOVERY_VIEW_PREFERENCES_STORAGE_KEY = "discoveryViewPreferences";
const DISCOVERY_FEED_PAGE_STORAGE_PREFIX = "discoveryFeedPage:";
const LAST_AUTH_USER_ID_STORAGE_KEY = "lastAuthUserId";
const VIEWER_BOOTSTRAP_STORAGE_PREFIX = "viewerBootstrap:";

type DiscoveryFiltersCache = Record<string, DiscoveryFilters>;
type ViewerBootstrapCache = ViewerBootstrapResponse;
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

type DiscoveryDecisionAction = "like" | "pass";
type DiscoveryDecisionOptions = {
  requestId?: string;
};
type DiscoveryDecisionRequester = typeof likeDiscoveryProfile;
type DiscoveryDecisionSnapshot = {
  totalLikesCount: number;
  lifetimeLikes: number;
  lifetimePasses: number;
  thresholdTotalLikes: number;
  thresholdTotalPasses: number;
  unlockAvailable: boolean;
  unlockPending: boolean;
};

function getViewerBootstrapStorageKey(userId: number) {
  return `${VIEWER_BOOTSTRAP_STORAGE_PREFIX}${userId}`;
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
    generatedAt: "",
    windowSize: 0,
    reserveCount: 0,
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

function createDiscoveryDecisionRequestId(
  action: DiscoveryDecisionAction,
  targetProfileId: number
) {
  return `discovery_${action}_${targetProfileId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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

function pruneDiscoveryFeedWindow(
  feed: DiscoveryFeedResponse,
  targetProfileId: number
): DiscoveryFeedResponse {
  const nextProfiles = feed.profiles.filter((profile) => profile.id !== targetProfileId);
  const removedCount = feed.profiles.length - nextProfiles.length;

  if (removedCount <= 0) {
    return feed;
  }

  const currentSupply = feed.supply || createEmptyDiscoveryFeed().supply;
  return {
    ...feed,
    profiles: nextProfiles,
    supply: {
      ...currentSupply,
      unseenCount: Math.max(0, currentSupply.unseenCount - removedCount),
      decidedCount: currentSupply.decidedCount + removedCount,
      exhausted: Math.max(0, currentSupply.unseenCount - removedCount) === 0,
      fetchedAt: new Date().toISOString(),
    },
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [, setRefreshToken] = useState<string | null>(null);
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
  const viewerBootstrapMetaRef = useRef<ViewerBootstrapMetadata>(
    createDefaultBootstrapMetadata()
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const hasCompletedOnboardingRef = useRef(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [biometricLockRequired, setBiometricLockRequired] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailability>({
    google: false,
    facebook: false,
    apple: false,
  });
  const isQueueReplayingRef = useRef(false);
  const replayMutationQueueRef = useRef<() => Promise<void>>(async () => {});
  const requestQueueReplay = useCallback(() => {
    void replayMutationQueueRef.current();
  }, []);
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
    setRefreshToken(null);
    setBiometricLockRequired(false);
    setHasCompletedOnboarding(false);
    hasCompletedOnboardingRef.current = false;
    setNeedsProfileCompletion(false);
    needsProfileCompletionRef.current = false;
    setAuthError(null);
    setAuthFormPrefill(null);
    setPendingVerificationEmail(null);
    setPendingVerificationPassword(null);
    setVerificationStatus("idle");
    setLikedProfiles([]);
    likedProfilesRef.current = [];
    setPassedProfiles([]);
    passedProfilesRef.current = [];
    setDiscoveryFeed(createEmptyDiscoveryFeed());
    discoveryFeedRef.current = createEmptyDiscoveryFeed();
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
    profileFieldRevisionRef.current = {};
    goalsRef.current = defaultGoals;
    setGoals(defaultGoals);
    viewerBootstrapMetaRef.current = createDefaultBootstrapMetadata();
  }, []);

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
    return Promise.all(photos.map((photo, index) => ensureLocalProfilePhoto(photo, index)));
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
      const bootstrap: ViewerBootstrapCache = {
        user: currentUser,
        needsProfileCompletion:
          overrides?.needsProfileCompletion ?? needsProfileCompletionRef.current,
        hasCompletedOnboarding:
          overrides?.hasCompletedOnboarding ?? hasCompletedOnboardingRef.current,
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

  const applyViewerBootstrap = useCallback(
    async (bootstrap: ViewerBootstrapCache, options?: { persist?: boolean }) => {
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
      setNeedsProfileCompletion(bootstrap.needsProfileCompletion);
      needsProfileCompletionRef.current = bootstrap.needsProfileCompletion;
      setHasCompletedOnboarding(bootstrap.hasCompletedOnboarding);
      hasCompletedOnboardingRef.current = bootstrap.hasCompletedOnboarding;
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
      discoveryFeedRef.current =
        bootstrap.discovery.feed || {
          ...createEmptyDiscoveryFeed(),
          supply: {
            ...createEmptyDiscoveryFeed().supply,
            fetchedAt: bootstrap.bootstrapGeneratedAt || new Date().toISOString(),
          },
        };
      setDiscoveryFeed(discoveryFeedRef.current);
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
    [persistViewerBootstrapCache, restoreProfilePhotos]
  );

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  const refreshProfileLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      return;
    }

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (!place) {
        return;
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
        return;
      }

      if (profileRef.current.location === nextLocation) {
        return;
      }

      const updated = normalizeStoredProfile({
        ...profileRef.current,
        location: nextLocation,
      });
      profileRef.current = updated;
      setProfile(updated);
      void persistViewerBootstrapCache({ profile: updated });

      if (accessToken) {
        void updateViewerProfile(accessToken, {
          location: nextLocation,
          country,
        }).catch(() => {});
      }
    } catch {}
  }, [accessToken, persistViewerBootstrapCache]);

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
      refreshToken: string;
      user: AuthUser;
      needsProfileCompletion: boolean;
      hasCompletedOnboarding: boolean;
    }) => {
      Keyboard.dismiss();
      const normalizedSessionUser: AuthUser = {
        ...session.user,
        dateOfBirth: normalizeIsoDateString(session.user.dateOfBirth),
      };
      debugLog("[auth] applySession", {
        userId: normalizedSessionUser.id,
        needsProfileCompletion: session.needsProfileCompletion,
        hasCompletedOnboarding: session.hasCompletedOnboarding,
      });
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setUser(normalizedSessionUser);
      setAuthFormPrefill(null);
      setPendingVerificationEmail(null);
      setPendingVerificationPassword(null);
      setVerificationStatus("idle");
      setAuthError(null);
      setNeedsProfileCompletion(session.needsProfileCompletion);
      setHasCompletedOnboarding(session.hasCompletedOnboarding);
      setSessionOfflineFallback(false);
      await Promise.all([
        AsyncStorage.setItem(LAST_AUTH_USER_ID_STORAGE_KEY, String(normalizedSessionUser.id)),
        AsyncStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem("profile"),
        AsyncStorage.removeItem("goals"),
        SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken),
      ]);

      let bootstrap: ViewerBootstrapCache;
      try {
        bootstrap = await getViewerBootstrap(session.accessToken);
        debugLog("[auth] bootstrap fetched", {
          userId: normalizedSessionUser.id,
          viewerVersion: bootstrap.viewerVersion,
          bootstrapGeneratedAt: bootstrap.bootstrapGeneratedAt,
        });
      } catch {
        debugWarn("[auth] bootstrap fetch failed, using fallback cache seed", {
          userId: normalizedSessionUser.id,
        });
        bootstrap = {
          user: normalizedSessionUser,
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

      await applyViewerBootstrap(bootstrap);
      debugLog("[auth] session applied", {
        userId: normalizedSessionUser.id,
      });
      setAuthStatus("authenticated");
      requestQueueReplay();
    },
    [applyViewerBootstrap, requestQueueReplay]
  );

  const hydrateSessionFromTokens = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      const me = await getMe(tokens.accessToken);
      await applySession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: me.user,
        needsProfileCompletion: me.needsProfileCompletion,
        hasCompletedOnboarding: me.hasCompletedOnboarding,
      });
    },
    [applySession]
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
      await applySession(session);
      debugLog("[auth] pending verification auto-login succeeded");
      return true;
    } catch (e: any) {
      debugWarn("[auth] pending verification auto-login failed", e?.code || e?.message);
      const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
      setAuthError(code);
      setSignInPrefill(pendingVerificationEmail);
      resetPendingVerificationState();
      setAuthStatus("unauthenticated");
      return false;
    }
  }, [
    applySession,
    pendingVerificationEmail,
    pendingVerificationPassword,
    resetPendingVerificationState,
    setSignInPrefill,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [
          lang,
          savedDiscoveryFilters,
          savedDiscoveryViewPreferences,
          savedLastAuthUserId,
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
        const cachedBootstrapRaw =
          lastAuthUserId && Number.isFinite(lastAuthUserId)
            ? await AsyncStorage.getItem(getViewerBootstrapStorageKey(lastAuthUserId))
            : null;

        if (cachedBootstrapRaw) {
          try {
            await applyViewerBootstrap(
              JSON.parse(cachedBootstrapRaw) as ViewerBootstrapCache,
              { persist: false }
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

        if (lastAuthUserId && cachedDiscoveryFilters?.[String(lastAuthUserId)]) {
          setDiscoveryFilters({
            ...DEFAULT_DISCOVERY_FILTERS,
            ...cachedDiscoveryFilters[String(lastAuthUserId)],
          });
        }

        const bioEnabled = savedBiometrics === "true";
        setBiometricsEnabledState(bioEnabled);

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
            await applySession(session);
            refreshProfileLocation().catch(() => {});
            if (bioEnabled && Platform.OS !== "web") {
              setBiometricLockRequired(true);
            }
          } catch (error) {
            if (cachedBootstrapRaw && !isInvalidRefreshError(error)) {
              debugWarn("[auth] refresh failed, keeping warm-start cache", {
                reason: error instanceof Error ? error.message : "unknown",
              });
              setSessionOfflineFallback(true);
              setAuthStatus("authenticated");
              if (bioEnabled && Platform.OS !== "web") {
                setBiometricLockRequired(true);
              }
              return;
            }

            debugWarn("[auth] refresh failed, clearing authenticated state", {
              reason: error instanceof Error ? error.message : "unknown",
            });
            resetClientState();
            await clearStoredSessionTokens();
            await Promise.all([
              clearUserScopedCachedState(lastAuthUserId),
              AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
            ]);
            setAuthStatus("unauthenticated");
          }
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    })();
  }, [
    applySession,
    applyViewerBootstrap,
    clearUserScopedCachedState,
    clearStoredSessionTokens,
    persistProfile,
    refreshProfileLocation,
    resetClientState,
    restoreProfilePhotos,
  ]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshProfileLocation().catch(() => {});
        requestQueueReplay();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshProfileLocation, requestQueueReplay]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        requestQueueReplay();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [requestQueueReplay]);

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
      Keyboard.dismiss();
      setAuthBusy(true);
      setAuthError(null);
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

        await enqueueMutation<SettingsSavePayload>({
          userId: userRef.current.id,
          type: "settings_save",
          targetKey: "settings:save",
          canonicalPayload: {
            profileFields,
            profilePatch,
            settingsPatch: {
              language: input.language,
              heightUnit: input.heightUnit,
            },
            mePatch,
            completed: {
              profile: false,
              settings: false,
              account: false,
            },
            resolvedProfile: {
              name: resolvedName,
              dateOfBirth: resolvedDateOfBirth,
              profession: nextProfile.profession,
              genderIdentity: nextProfile.genderIdentity,
              pronouns: nextProfile.pronouns,
              personality: nextProfile.personality,
            },
            resolvedSettings: {
              language: nextSettings.language,
              heightUnit: nextSettings.heightUnit,
            },
          },
        });
        setSettingsSaveState("queued");
        debugLog("[settings] save queued", {
          userId: userRef.current.id,
          hasDateOfBirth: Boolean(resolvedDateOfBirth),
          hasName: Boolean(resolvedName),
        });
        requestQueueReplay();

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
    [accessToken, requestQueueReplay]
  );

  const login = useCallback(async () => {
    await applySession({
      accessToken: "demo-access-token",
      refreshToken: "demo-refresh-token",
      user: {
        id: 1,
        email: "demo@matcha.app",
        name: "Alejandro",
        dateOfBirth: "1995-06-15",
        profession: "Demo User",
        emailVerified: true,
      },
      needsProfileCompletion: false,
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
        await applySession(session);
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession]
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const result = await authSignUp(input);
        if (result.status === "verification_pending") {
          setAuthStatus("verification_pending");
          setPendingVerificationEmail(result.email);
          setPendingVerificationPassword(input.password);
          setSignInPrefill(result.email);
          setVerificationStatus("pending");
        }
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
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
        await applySession(session);
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession]
  );

  const handleAuthCallback = useCallback(
    async (payload: AuthCallbackPayload) => {
      Keyboard.dismiss();
      setAuthBusy(true);
      setAuthError(null);

      debugLog("[auth-callback] payload", {
        status: payload.status,
        provider: payload.provider,
        code: payload.code,
        email: payload.email,
      });

      try {
        if (
          payload.status === "success" &&
          payload.accessToken &&
          payload.refreshToken
        ) {
          await hydrateSessionFromTokens({
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          });
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
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
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
      completePendingVerificationSignIn,
      hydrateSessionFromTokens,
      resetPendingVerificationState,
      setSignInPrefill,
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
      const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
      setAuthError(code);
      setVerificationStatus("pending");
      return null;
    }
  }, [completePendingVerificationSignIn, pendingVerificationEmail]);

  const logout = useCallback(async () => {
    try {
      if (accessToken) await authSignOut(accessToken);
    } catch {}
    const currentUserId = userRef.current?.id;
    setAuthStatus("unauthenticated");
    resetClientState();
    await Promise.all([
      clearStoredSessionTokens(),
      clearUserScopedCachedState(currentUserId),
      AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
    ]);
  }, [accessToken, clearStoredSessionTokens, clearUserScopedCachedState, resetClientState]);

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
  }, [accessToken, clearStoredSessionTokens, clearUserScopedCachedState, resetClientState]);

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
    if (!currentUserId || !accessToken || isQueueReplayingRef.current) {
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
              setNeedsProfileCompletion(me.needsProfileCompletion);
              setHasCompletedOnboarding(me.hasCompletedOnboarding);
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
          setNeedsProfileCompletion(result.needsProfileCompletion);
          setHasCompletedOnboarding(result.hasCompletedOnboarding);
          await persistConfirmedProfileWithBootstrap(updated);
          await applyConfirmedProfileFields(["name", "dateOfBirth"], updated);
        } else {
          await persistConfirmedProfileWithBootstrap(updated);
          await persistViewerBootstrapCache({
            profile: updated,
            needsProfileCompletion: false,
          });
        }
        setNeedsProfileCompletion(false);
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

  const saveOnboardingDraft = useCallback(
    async (data: {
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
    }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
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

        if (accessToken) {
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
          const nextRevision = Math.max(
            ...fields.map((field) => {
              const revision = (profileFieldRevisionRef.current[field] || 0) + 1;
              profileFieldRevisionRef.current[field] = revision;
              return revision;
            })
          );
          await queueProfileFieldMutation(fields, updated, {
            revision: nextRevision,
          });
        }
        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      accessToken,
      queueProfileFieldMutation,
    ]
  );

  const finishOnboarding = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (accessToken) {
        const result = await completeOnboardingRequest(accessToken);
        setHasCompletedOnboarding(result.hasCompletedOnboarding);
        await persistViewerBootstrapCache({
          hasCompletedOnboarding: result.hasCompletedOnboarding,
        });
      } else {
        setHasCompletedOnboarding(true);
        await persistViewerBootstrapCache({
          hasCompletedOnboarding: true,
        });
      }
      return true;
    } catch (e: any) {
      setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [accessToken, persistViewerBootstrapCache]);

  const unlockWithBiometrics = useCallback(async (): Promise<BiometricResult> => {
    if (Platform.OS === "web") {
      setBiometricLockRequired(false);
      return { ok: true };
    }
    setBiometricBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear MatchA",
        fallbackLabel: "Usar contraseña",
        cancelLabel: "Cancelar",
      });
      if (result.success) {
        setBiometricLockRequired(false);
        return { ok: true };
      }
      if (result.error === "user_cancel" || result.error === "system_cancel") {
        return { ok: false, code: "BIOMETRIC_CANCELLED" };
      }
      return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
    } catch {
      return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
    } finally {
      setBiometricBusy(false);
    }
  }, []);

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
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmar biometría",
          cancelLabel: "Cancelar",
        });
        if (!result.success) return { ok: false, code: "BIOMETRIC_CANCELLED" };
      }
      setBiometricsEnabledState(enabled);
      await AsyncStorage.setItem("biometricsEnabled", enabled ? "true" : "false");
      return { ok: true };
    },
    []
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

      const previousFeed = discoveryFeedRef.current;
      const feed = await refreshDiscoveryFeed(token);
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
      discoveryFeedRef.current = feed;
      setDiscoveryFeed(feed);
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
    [persistViewerBootstrapCache]
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

      const nextFeed = await getNextDiscoveryFeedWindow(token, currentFeed.nextCursor);
      const knownIds = new Set(currentFeed.profiles.map((profile) => profile.id));
      const mergedFeed: DiscoveryFeedResponse = {
        profiles: [
          ...currentFeed.profiles,
          ...nextFeed.profiles.filter((profile) => !knownIds.has(profile.id)),
        ],
        nextCursor: nextFeed.nextCursor,
        hasMore: nextFeed.hasMore,
        supply: nextFeed.supply,
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

      discoveryFeedRef.current = mergedFeed;
      setDiscoveryFeed(mergedFeed);
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
          feed: mergedFeed,
        },
      });

      return mergedFeed;
    },
    [persistViewerBootstrapCache]
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

  const submitDiscoveryDecision = useCallback(
    async (
      action: DiscoveryDecisionAction,
      requestDecision: DiscoveryDecisionRequester,
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "categoryValues">,
      options?: DiscoveryDecisionOptions
    ) => {
      if (!accessToken) {
        return null;
      }

      const requestId =
        options?.requestId || createDiscoveryDecisionRequestId(action, profile.id);
      const queueVersion =
        Number.isFinite(discoveryFeedRef.current.queueVersion) &&
        Number(discoveryFeedRef.current.queueVersion) > 0
          ? Number(discoveryFeedRef.current.queueVersion)
          : null;
      const before = getDiscoveryDecisionSnapshot({
        totalLikesCount: totalLikesCountRef.current,
        lifetimeCounts: lifetimeDiscoveryCountsRef.current,
        threshold: discoveryThresholdRef.current,
        goalsUnlock: goalsUnlockStateRef.current,
      });
      const startedAt = Date.now();

      debugDiscoveryLog("decision_request_sent", {
        requestId,
        action,
        targetProfileId: profile.id,
        before,
      });

      try {
        const result = await requestDecision(accessToken, {
          targetProfileId: profile.id,
          categoryValues: profile.categoryValues,
          requestId,
          queueVersion,
        });
        const latencyMs = Date.now() - startedAt;
        applyDiscoveryPreferenceResult(result, {
          requestId,
          action,
          targetProfileId: profile.id,
          latencyMs,
          before,
        });
        const authoritativeFeed = result.feed;
        const nextFeed = authoritativeFeed
          ? authoritativeFeed
          : result.decisionApplied
            ? pruneDiscoveryFeedWindow(discoveryFeedRef.current, result.targetProfileId)
            : await refreshDiscoveryFeedState(accessToken, {
                reason: "decision_not_applied",
                requestId,
                targetProfileId: result.targetProfileId,
              });
        if (authoritativeFeed) {
          debugDiscoveryLog("feed_window_authoritative", {
            requestId,
            action,
            targetProfileId: result.targetProfileId,
            queueVersion: authoritativeFeed.queueVersion ?? null,
            returnedProfileIds: authoritativeFeed.profiles.map(
              (item: DiscoveryFeedProfileResponse) => item.id
            ),
            reserveCount: authoritativeFeed.reserveCount ?? null,
            generatedAt: authoritativeFeed.generatedAt ?? null,
            latencyMs,
          });
        } else if (result.decisionApplied) {
          debugDiscoveryLog("feed_window_pruned", {
            requestId,
            action,
            targetProfileId: result.targetProfileId,
            previousProfileCount: discoveryFeedRef.current.profiles.length,
            nextProfileCount: nextFeed.profiles.length,
            previousUnseenCount: discoveryFeedRef.current.supply?.unseenCount ?? null,
            nextUnseenCount: nextFeed.supply?.unseenCount ?? null,
            latencyMs,
          });
        }
        discoveryFeedRef.current = nextFeed;
        setDiscoveryFeed(nextFeed);
        setLastServerSyncAt(
          result.threshold.lastDecisionEventAt ||
            nextFeed.supply?.fetchedAt ||
            new Date().toISOString()
        );
        await persistViewerBootstrapCache({
          discovery: {
            ...result,
            feed: nextFeed,
          },
        });
        debugDiscoveryLog("decision_request_completed", {
          requestId,
          action,
          targetProfileId: result.targetProfileId,
          decisionApplied: result.decisionApplied,
          decisionRejectedReason: result.decisionRejectedReason ?? null,
          queueAction: authoritativeFeed
            ? "replace-authoritative-window"
            : result.decisionApplied
              ? "prune"
              : "refresh-first-window",
          latencyMs,
        });
        return result;
      } catch (error: any) {
        debugDiscoveryWarn("decision_request_failed", {
          requestId,
          action,
          targetProfileId: profile.id,
          latencyMs: Date.now() - startedAt,
          code: error?.code || null,
          message: error?.message || "UNKNOWN_ERROR",
        });
        return null;
      }
    },
    [
      accessToken,
      applyDiscoveryPreferenceResult,
      persistViewerBootstrapCache,
      refreshDiscoveryFeedState,
    ]
  );

  const likeProfile = useCallback(
    async (
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "categoryValues">,
      options?: DiscoveryDecisionOptions
    ) => submitDiscoveryDecision("like", likeDiscoveryProfile, profile, options),
    [submitDiscoveryDecision]
  );

  const passProfile = useCallback(
    async (
      profile: Pick<DiscoveryFeedProfileResponse, "id" | "categoryValues">,
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
      setDiscoveryFeed(createEmptyDiscoveryFeed());
      discoveryFeedRef.current = createEmptyDiscoveryFeed();
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
      setDiscoveryFeed(refreshedFeed);
      return true;
    } catch {
      return false;
    }
  }, [accessToken, persistViewerBootstrapCache, refreshDiscoveryFeedState]);

  const refreshDiscoveryCandidates = useCallback(async () => {
    if (!accessToken) {
      return false;
    }

    try {
      await refreshDiscoveryFeedState(accessToken);
      return true;
    } catch {
      return false;
    }
  }, [accessToken, refreshDiscoveryFeedState]);

  const fetchNextDiscoveryWindow = useCallback(async () => {
    if (!accessToken) {
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
      const nextFilters = {
        ...DEFAULT_DISCOVERY_FILTERS,
        ...filters,
      };

      setDiscoveryFilters(nextFilters);
      if (user?.id) {
        await persistDiscoveryFiltersForUser(user.id, nextFilters);
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
          filters: nextFilters,
        },
      });

      if (!accessToken) {
        return true;
      }

      try {
        const result = await updateDiscoveryPreferences(accessToken, nextFilters);
        const refreshedFeed = await refreshDiscoveryFeedState(accessToken);
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
        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      }
    },
    [
      accessToken,
      persistDiscoveryFiltersForUser,
      persistViewerBootstrapCache,
      refreshDiscoveryFeedState,
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

  return (
    <AppContext.Provider
      value={{
        authStatus,
        login,
        logout,
        signIn,
        signUp,
        signInWithProvider,
        user,
        authBusy,
        authError,
        authFormPrefill,
        pendingVerificationEmail,
        verificationStatus,
        checkPendingVerificationStatus,
        resetPendingVerificationState,
        handleAuthCallback,
        clearAuthFeedback,
        providerAvailability,
        needsProfileCompletion,
        hasCompletedOnboarding,
        completeProfile,
        saveOnboardingDraft,
        finishOnboarding,
        biometricLockRequired,
        biometricBusy,
        biometricsEnabled,
        unlockWithBiometrics,
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
        profile,
        accountProfile,
        profileSaveStates,
        updateProfileField,
        setProfilePhoto,
        removeProfilePhoto,
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
