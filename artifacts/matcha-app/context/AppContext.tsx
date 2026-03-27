import AsyncStorage from "@react-native-async-storage/async-storage";
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
  type AuthCallbackPayload,
  type AuthUser,
  type DiscoveryFilters,
  type DiscoveryLikeResponse,
  type ViewerBootstrapResponse,
  type ProviderAvailability,
  type AuthProvider,
  checkVerificationStatus as authCheckVerificationStatus,
  completeGoal as completeGoalRequest,
  DEFAULT_DISCOVERY_FILTERS,
  deleteAccount as deleteAccountRequest,
  deleteProfilePhoto as deleteProfilePhotoRequest,
  fetchProviderAvailability,
  getViewerBootstrap,
  likeDiscoveryProfile,
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
import { getDiscoverProfilePopularInput } from "@/data/profiles";
import {
  deleteStoredProfilePhoto,
  ensureLocalProfilePhoto,
  getProfilePhotoBySortOrder,
  normalizeStoredProfilePhotos,
  type UserProfilePhoto,
} from "@/utils/profilePhotos";
import {
  createEmptyPopularAttributesByCategory,
  type PopularAttributeCategory,
  type PopularAttributeSnapshot,
} from "@/utils/popularAttributes";

export type { AuthUser };

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

export type UserProfile = {
  name: string;
  age: string;
  dateOfBirth: string;
  location: string;
  profession: string;
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  languagesSpoken: string[];
  education: string;
  childrenPreference: string;
  physicalActivity: string;
  alcoholUse: string;
  tobaccoUse: string;
  politicalInterest: string;
  religionImportance: string;
  religion: string;
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
  photos: UserProfilePhoto[];
};

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

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: "",
  dateOfBirth: "",
  location: "",
  profession: "",
  genderIdentity: "",
  pronouns: "",
  personality: "",
  relationshipGoals: "",
  languagesSpoken: [],
  education: "",
  childrenPreference: "",
  physicalActivity: "",
  alcoholUse: "",
  tobaccoUse: "",
  politicalInterest: "",
  religionImportance: "",
  religion: "",
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
  photos: [],
};

function normalizeStoredProfile(input: Partial<UserProfile> | null | undefined): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(input || {}),
    interests: Array.isArray(input?.interests) ? input.interests : [],
    photos: normalizeStoredProfilePhotos(input?.photos),
    languagesSpoken: Array.isArray(input?.languagesSpoken) ? input.languagesSpoken : [],
  };
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
  deleteAccount: () => Promise<boolean>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  completeGoalTask: (id: string) => void;
  reorderGoalTasks: (
    category: GoalCategory,
    fromIndex: number,
    toIndex: number
  ) => void;
  popularAttributesByCategory: Record<
    PopularAttributeCategory,
    PopularAttributeSnapshot
  >;
  totalLikesCount: number;
  likedProfiles: string[];
  discoveryFilters: DiscoveryFilters;
  lastServerSyncAt: string | null;
  saveDiscoveryFilters: (filters: DiscoveryFilters) => Promise<boolean>;
  likeProfile: (profileId: string) => Promise<DiscoveryLikeResponse | null>;
  profile: UserProfile;
  accountProfile: AccountProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setProfilePhoto: (index: number, uri: string) => Promise<UserProfilePhoto | null>;
  removeProfilePhoto: (index: number) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const DISCOVERY_FILTERS_STORAGE_KEY = "discoveryFiltersByUser";
const LAST_AUTH_USER_ID_STORAGE_KEY = "lastAuthUserId";
const VIEWER_BOOTSTRAP_STORAGE_PREFIX = "viewerBootstrap:";

type DiscoveryFiltersCache = Record<string, DiscoveryFilters>;
type ViewerBootstrapCache = ViewerBootstrapResponse;

function getViewerBootstrapStorageKey(userId: number) {
  return `${VIEWER_BOOTSTRAP_STORAGE_PREFIX}${userId}`;
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
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const likedProfilesRef = useRef<string[]>([]);
  const [discoveryFilters, setDiscoveryFilters] =
    useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const discoveryFiltersRef = useRef<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [popularAttributesByCategory, setPopularAttributesByCategory] = useState<
    Record<PopularAttributeCategory, PopularAttributeSnapshot>
  >(() => createEmptyPopularAttributesByCategory());
  const popularAttributesByCategoryRef = useRef<
    Record<PopularAttributeCategory, PopularAttributeSnapshot>
  >(createEmptyPopularAttributesByCategory());
  const [totalLikesCount, setTotalLikesCount] = useState(0);
  const totalLikesCountRef = useRef(0);
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
  const profileSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetClientState = useCallback(() => {
    const emptyPopularAttributes = createEmptyPopularAttributesByCategory();
    const defaultGoals = normalizeStoredGoals(DEFAULT_GOALS);

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
    setDiscoveryFilters(DEFAULT_DISCOVERY_FILTERS);
    discoveryFiltersRef.current = DEFAULT_DISCOVERY_FILTERS;
    setPopularAttributesByCategory(emptyPopularAttributes);
    popularAttributesByCategoryRef.current = emptyPopularAttributes;
    setTotalLikesCount(0);
    totalLikesCountRef.current = 0;
    setLastServerSyncAt(null);
    profileRef.current = DEFAULT_PROFILE;
    setProfile(DEFAULT_PROFILE);
    goalsRef.current = defaultGoals;
    setGoals(defaultGoals);
  }, []);

  const persistProfile = useCallback(async (nextProfile: UserProfile) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

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
        ...(overrides?.profile || profileRef.current),
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
      const nextDiscovery = overrides?.discovery ?? {
        likedProfileIds: likedProfilesRef.current,
        popularAttributesByCategory: popularAttributesByCategoryRef.current,
        totalLikesCount: totalLikesCountRef.current,
        lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
        filters: discoveryFiltersRef.current,
      };
      const nextGoals = normalizeStoredGoals(
        (overrides?.goals as Goal[] | undefined) ?? goalsRef.current
      );
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
        syncedAt: overrides?.syncedAt ?? new Date().toISOString(),
      };

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
      const nextProfile = normalizeStoredProfile({
        ...bootstrap.profile,
        photos: mergeRemotePhotosWithLocal(profileRef.current.photos, bootstrap.photos),
      });

      userRef.current = bootstrap.user;
      setUser(bootstrap.user);
      setNeedsProfileCompletion(bootstrap.needsProfileCompletion);
      needsProfileCompletionRef.current = bootstrap.needsProfileCompletion;
      setHasCompletedOnboarding(bootstrap.hasCompletedOnboarding);
      hasCompletedOnboardingRef.current = bootstrap.hasCompletedOnboarding;
      setLanguageState(bootstrap.settings.language);
      languageRef.current = bootstrap.settings.language;
      setHeightUnitState(bootstrap.settings.heightUnit);
      heightUnitRef.current = bootstrap.settings.heightUnit;
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      goalsRef.current = normalizeStoredGoals(bootstrap.goals as Goal[]);
      setGoals(goalsRef.current);
      likedProfilesRef.current = bootstrap.discovery.likedProfileIds;
      setLikedProfiles(bootstrap.discovery.likedProfileIds);
      discoveryFiltersRef.current = {
        ...DEFAULT_DISCOVERY_FILTERS,
        ...(bootstrap.discovery.filters || {}),
      };
      setDiscoveryFilters(discoveryFiltersRef.current);
      popularAttributesByCategoryRef.current =
        bootstrap.discovery.popularAttributesByCategory;
      setPopularAttributesByCategory(bootstrap.discovery.popularAttributesByCategory);
      totalLikesCountRef.current = bootstrap.discovery.totalLikesCount;
      setTotalLikesCount(bootstrap.discovery.totalLikesCount);
      setLastServerSyncAt(bootstrap.syncedAt || new Date().toISOString());

      void restoreProfilePhotos(nextProfile.photos)
        .then((restoredPhotos) => {
          const restoredProfile = normalizeStoredProfile({
            ...nextProfile,
            photos: restoredPhotos,
          });
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
    discoveryFiltersRef.current = discoveryFilters;
  }, [discoveryFilters]);

  useEffect(() => {
    popularAttributesByCategoryRef.current = popularAttributesByCategory;
  }, [popularAttributesByCategory]);

  useEffect(() => {
    totalLikesCountRef.current = totalLikesCount;
  }, [totalLikesCount]);

  useEffect(() => {
    needsProfileCompletionRef.current = needsProfileCompletion;
  }, [needsProfileCompletion]);

  useEffect(() => {
    hasCompletedOnboardingRef.current = hasCompletedOnboarding;
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    return () => {
      if (profileSyncTimeoutRef.current) {
        clearTimeout(profileSyncTimeoutRef.current);
      }
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

      setProfile((prev) => {
        if (prev.location === nextLocation) {
          return prev;
        }
        const updated = normalizeStoredProfile({ ...prev, location: nextLocation });
        profileRef.current = updated;
        void persistViewerBootstrapCache({ profile: updated });
        return updated;
      });
    } catch {}
  }, [persistViewerBootstrapCache]);

  const setLanguage = useCallback((lang: "es" | "en") => {
    setLanguageState(lang);
    AsyncStorage.setItem("language", lang).catch(() => {});
  }, []);

  const setHeightUnit = useCallback((unit: HeightUnit) => {
    setHeightUnitState(unit);
    AsyncStorage.setItem("heightUnit", unit).catch(() => {});
  }, []);

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
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setUser(session.user);
      setAuthFormPrefill(null);
      setPendingVerificationEmail(null);
      setPendingVerificationPassword(null);
      setVerificationStatus("idle");
      setAuthError(null);
      setNeedsProfileCompletion(session.needsProfileCompletion);
      setHasCompletedOnboarding(session.hasCompletedOnboarding);
      await Promise.all([
        AsyncStorage.setItem(LAST_AUTH_USER_ID_STORAGE_KEY, String(session.user.id)),
        AsyncStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem("profile"),
        AsyncStorage.removeItem("goals"),
        SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken),
      ]);

      let bootstrap: ViewerBootstrapCache;
      try {
        bootstrap = await getViewerBootstrap(session.accessToken);
      } catch {
        bootstrap = {
          user: session.user,
          needsProfileCompletion: session.needsProfileCompletion,
          hasCompletedOnboarding: session.hasCompletedOnboarding,
          profile: normalizeStoredProfile({
            ...DEFAULT_PROFILE,
            name: session.user.name || "",
            dateOfBirth: session.user.dateOfBirth || "",
            profession: session.user.profession || "",
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
            popularAttributesByCategory: popularAttributesByCategoryRef.current,
            totalLikesCount: totalLikesCountRef.current,
            lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
            filters: discoveryFiltersRef.current,
          },
          syncedAt: new Date().toISOString(),
        };
      }

      await applyViewerBootstrap(bootstrap);
      setAuthStatus("authenticated");
    },
    [applyViewerBootstrap]
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
      if (__DEV__) {
        console.log("[auth] pending verification auto-login succeeded");
      }
      return true;
    } catch (e: any) {
      if (__DEV__) {
        console.log("[auth] pending verification auto-login failed", e?.code || e?.message);
      }
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
          savedLastAuthUserId,
          savedBiometrics,
          savedHeightUnit,
          legacyGoals,
          legacyProfile,
        ] =
          await Promise.all([
            AsyncStorage.getItem("language"),
            AsyncStorage.getItem(DISCOVERY_FILTERS_STORAGE_KEY),
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
          } catch {
            resetClientState();
            await clearStoredSessionTokens();
            await Promise.all([
              lastAuthUserId
                ? AsyncStorage.removeItem(getViewerBootstrapStorageKey(lastAuthUserId))
                : Promise.resolve(),
              AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
              AsyncStorage.removeItem("profile"),
              AsyncStorage.removeItem("goals"),
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
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshProfileLocation]);

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
      setAuthBusy(true);
      setAuthError(null);
      try {
        let nextProfile = normalizeStoredProfile({
          ...profileRef.current,
          name: input.name,
          dateOfBirth: input.dateOfBirth,
          profession: input.profession,
          genderIdentity: input.genderIdentity,
          pronouns: input.pronouns,
          personality: input.personality,
        });
        let nextSettings = {
          language: input.language,
          heightUnit: input.heightUnit,
          genderIdentity: input.genderIdentity,
          pronouns: input.pronouns,
          personality: input.personality,
        };

        if (accessToken) {
          const [profileResult, settingsResult] = await Promise.all([
            updateViewerProfile(accessToken, {
              name: input.name,
              dateOfBirth: input.dateOfBirth,
              profession: input.profession,
              genderIdentity: input.genderIdentity,
              pronouns: input.pronouns,
              personality: input.personality,
            }),
            updateSettings(accessToken, {
              language: input.language,
              heightUnit: input.heightUnit,
            }),
          ]);

          nextProfile = normalizeStoredProfile({
            ...profileRef.current,
            ...profileResult.profile,
            photos: profileRef.current.photos,
          });
          nextSettings = {
            ...settingsResult.settings,
            genderIdentity: nextProfile.genderIdentity,
            pronouns: nextProfile.pronouns,
            personality: nextProfile.personality,
          };

          const me = await updateMe(accessToken, {
            name: input.name,
            dateOfBirth: input.dateOfBirth,
            profession: input.profession,
          });
          setUser(me.user);
          setNeedsProfileCompletion(me.needsProfileCompletion);
          setHasCompletedOnboarding(me.hasCompletedOnboarding);
        }

        profileRef.current = nextProfile;
        setProfile(nextProfile);
        setLanguageState(nextSettings.language);
        setHeightUnitState(nextSettings.heightUnit);
        await AsyncStorage.setItem("language", nextSettings.language);
        await AsyncStorage.setItem("heightUnit", nextSettings.heightUnit);

        setUser((prev) =>
          prev
            ? {
                ...prev,
                name: input.name,
                dateOfBirth: input.dateOfBirth,
                profession: input.profession,
              }
            : prev
        );
        await persistViewerBootstrapCache({
          profile: nextProfile,
          settings: nextSettings,
          needsProfileCompletion: !(input.name && input.dateOfBirth),
        });

        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [accessToken, persistViewerBootstrapCache]
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

      if (__DEV__) {
        console.log("[auth-callback] payload", {
          status: payload.status,
          provider: payload.provider,
          code: payload.code,
          email: payload.email,
        });
      }

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
      currentUserId
        ? AsyncStorage.removeItem(getViewerBootstrapStorageKey(currentUserId))
        : Promise.resolve(),
      AsyncStorage.removeItem(LAST_AUTH_USER_ID_STORAGE_KEY),
      AsyncStorage.removeItem("profile"),
      AsyncStorage.removeItem("goals"),
    ]);
  }, [accessToken, clearStoredSessionTokens, resetClientState]);

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
        currentUserId
          ? AsyncStorage.removeItem(getViewerBootstrapStorageKey(currentUserId))
          : Promise.resolve(),
        AsyncStorage.removeItem("profile"),
        AsyncStorage.removeItem("goals"),
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
  }, [accessToken, clearStoredSessionTokens, resetClientState]);

  const accountProfile = useMemo(
    () => ({
      ...normalizeStoredProfile(profile),
      email: user?.email || "",
    }),
    [profile, user?.email]
  );

  const syncProfileToServer = useCallback(
    async (nextProfile: UserProfile) => {
      if (!accessToken) {
        await persistViewerBootstrapCache({ profile: nextProfile });
        return nextProfile;
      }

      const result = await updateViewerProfile(accessToken, {
        name: nextProfile.name,
        dateOfBirth: nextProfile.dateOfBirth,
        location: nextProfile.location,
        profession: nextProfile.profession,
        genderIdentity: nextProfile.genderIdentity,
        pronouns: nextProfile.pronouns,
        personality: nextProfile.personality,
        relationshipGoals: nextProfile.relationshipGoals,
        languagesSpoken: nextProfile.languagesSpoken,
        education: nextProfile.education,
        childrenPreference: nextProfile.childrenPreference,
        physicalActivity: nextProfile.physicalActivity,
        alcoholUse: nextProfile.alcoholUse,
        tobaccoUse: nextProfile.tobaccoUse,
        politicalInterest: nextProfile.politicalInterest,
        religionImportance: nextProfile.religionImportance,
        religion: nextProfile.religion,
        bio: nextProfile.bio,
        bodyType: nextProfile.bodyType,
        height: nextProfile.height,
        hairColor: nextProfile.hairColor,
        ethnicity: nextProfile.ethnicity,
        interests: nextProfile.interests,
      });

      const syncedProfile = normalizeStoredProfile({
        ...nextProfile,
        ...result.profile,
        photos: nextProfile.photos,
      });

      profileRef.current = syncedProfile;
      setProfile(syncedProfile);
      await persistViewerBootstrapCache({
        profile: syncedProfile,
      });
      return syncedProfile;
    },
    [accessToken, persistViewerBootstrapCache]
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
          await syncProfileToServer(updated);
        } else {
          profileRef.current = updated;
          setProfile(updated);
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
    [accessToken, persistViewerBootstrapCache, syncProfileToServer]
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
          genderIdentity: data.genderIdentity,
          pronouns: data.pronouns,
          personality: data.personality,
          relationshipGoals: data.relationshipGoals,
          childrenPreference: data.childrenPreference,
          languagesSpoken: data.languagesSpoken,
          education: data.education,
          physicalActivity: data.physicalActivity,
          bodyType: data.bodyType,
          photos: data.photos,
        });

        profileRef.current = updated;
        setProfile(updated);

        if (accessToken) {
          await syncProfileToServer(updated);
        } else {
          await persistViewerBootstrapCache({
            profile: updated,
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
    [accessToken, persistViewerBootstrapCache, syncProfileToServer]
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

  const scheduleProfileSync = useCallback(
    (nextProfile: UserProfile) => {
      if (profileSyncTimeoutRef.current) {
        clearTimeout(profileSyncTimeoutRef.current);
      }

      profileSyncTimeoutRef.current = setTimeout(() => {
        void syncProfileToServer(nextProfile).catch(() => {});
      }, 700);
    },
    [syncProfileToServer]
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

  const likeProfile = useCallback(
    async (profileId: string) => {
      if (!accessToken) {
        return null;
      }

      const categoryValues = getDiscoverProfilePopularInput(profileId);
      if (!categoryValues) {
        return null;
      }

      try {
        const result = await likeDiscoveryProfile(accessToken, {
          likedProfileId: profileId,
          categoryValues,
        });
        setLikedProfiles(result.likedProfileIds);
        setPopularAttributesByCategory(result.popularAttributesByCategory);
        setTotalLikesCount(result.totalLikesCount);
        await persistViewerBootstrapCache({
          discovery: result,
        });
        return result;
      } catch {
        return null;
      }
    },
    [accessToken, persistViewerBootstrapCache]
  );

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
          popularAttributesByCategory: popularAttributesByCategoryRef.current,
          totalLikesCount: totalLikesCountRef.current,
          lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
          filters: nextFilters,
        },
      });

      if (!accessToken) {
        return true;
      }

      try {
        const result = await updateDiscoveryPreferences(accessToken, nextFilters);
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
            popularAttributesByCategory: popularAttributesByCategoryRef.current,
            totalLikesCount: totalLikesCountRef.current,
            lastNotifiedPopularModeChangeAtLikeCount: totalLikesCountRef.current,
            filters: syncedFilters,
          },
        });
        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      }
    },
    [accessToken, persistDiscoveryFiltersForUser, persistViewerBootstrapCache, user?.id]
  );

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    const updated = normalizeStoredProfile({ ...profileRef.current, ...updates });
    profileRef.current = updated;
    setProfile(updated);
    void persistViewerBootstrapCache({ profile: updated });
    scheduleProfileSync(updated);
  }, [persistViewerBootstrapCache, scheduleProfileSync]);

  const setProfilePhoto = useCallback(
    async (index: number, uri: string) => {
      const currentPhotos = normalizeStoredProfilePhotos(profile.photos);
      const previousPhoto = getProfilePhotoBySortOrder(currentPhotos, index);
      const optimisticPhoto: UserProfilePhoto = {
        localUri: uri,
        remoteUrl: previousPhoto?.remoteUrl || "",
        mediaAssetId: previousPhoto?.mediaAssetId || null,
        profileImageId: previousPhoto?.profileImageId || null,
        sortOrder: index,
        status: "pending",
      };
      const optimisticPhotos = [...currentPhotos.filter((photo) => photo.sortOrder !== index), optimisticPhoto]
        .sort((a, b) => a.sortOrder - b.sortOrder);

      await persistProfile(
        normalizeStoredProfile({
          ...profile,
          photos: optimisticPhotos,
        })
      );
      await persistViewerBootstrapCache({
        profile: normalizeStoredProfile({
          ...profile,
          photos: optimisticPhotos,
        }),
      });

      if (!accessToken) {
        const localPhoto = {
          ...optimisticPhoto,
          status: "ready" as const,
        };
        await persistProfile(
          normalizeStoredProfile({
            ...profile,
            photos: optimisticPhotos
              .filter((photo) => photo.sortOrder !== index)
              .concat(localPhoto)
              .sort((a, b) => a.sortOrder - b.sortOrder),
          })
        );
        await persistViewerBootstrapCache({
          profile: normalizeStoredProfile({
            ...profile,
            photos: optimisticPhotos
              .filter((photo) => photo.sortOrder !== index)
              .concat(localPhoto)
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }),
        });
        return localPhoto;
      }

      const uploaded = await uploadProfilePhotoRequest(accessToken, index, uri);
      const syncedPhoto: UserProfilePhoto = {
        localUri: uri,
        remoteUrl: uploaded.remoteUrl,
        mediaAssetId: uploaded.mediaAssetId,
        profileImageId: uploaded.profileImageId,
        sortOrder: uploaded.sortOrder,
        status: uploaded.status === "pending" ? "pending" : "ready",
      };

      await persistProfile(
        normalizeStoredProfile({
          ...profile,
          photos: optimisticPhotos
            .filter((photo) => photo.sortOrder !== index)
            .concat(syncedPhoto)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        })
      );
      await persistViewerBootstrapCache({
        profile: normalizeStoredProfile({
          ...profile,
          photos: optimisticPhotos
            .filter((photo) => photo.sortOrder !== index)
            .concat(syncedPhoto)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }),
      });

      return syncedPhoto;
    },
    [accessToken, persistProfile, persistViewerBootstrapCache, profile]
  );

  const removeProfilePhoto = useCallback(
    async (index: number) => {
      const photoToRemove = getProfilePhotoBySortOrder(profile.photos, index);
      const nextPhotos = normalizeStoredProfilePhotos(profile.photos).filter(
        (photo) => photo.sortOrder !== index
      );

      await persistProfile(
        normalizeStoredProfile({
          ...profile,
          photos: nextPhotos,
        })
      );
      await persistViewerBootstrapCache({
        profile: normalizeStoredProfile({
          ...profile,
          photos: nextPhotos,
        }),
      });

      if (accessToken && photoToRemove?.profileImageId) {
        await deleteProfilePhotoRequest(accessToken, photoToRemove.profileImageId);
      }
    },
    [accessToken, persistProfile, persistViewerBootstrapCache, profile]
  );

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
        deleteAccount,
        t,
        goals,
        completeGoalTask,
        reorderGoalTasks,
        popularAttributesByCategory,
        totalLikesCount,
        likedProfiles,
        discoveryFilters,
        lastServerSyncAt,
        saveDiscoveryFilters,
        likeProfile,
        profile,
        accountProfile,
        updateProfile,
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
